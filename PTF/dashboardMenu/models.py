import uuid
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils.text import slugify



def restaurant_logo_path(instance, filename):
    return f"restaurants/{instance.business_name}/logo/{filename}"

def category_image_path(instance, filename):
    return f"restaurants/{instance.restaurant.business_name}/categories/{instance.name}/{filename}"

def dish_image_path(instance, filename):
    return f"restaurants/{instance.category.restaurant.business_name}/{instance.category.name}/{instance.name}/image/{filename}"

def dish_glb_path(instance, filename):
    return f"restaurants/{instance.category.restaurant.business_name}/{instance.category.name}/{instance.name}/model/{filename}"




class Restaurant(models.Model):
    """
    One restaurant per client.
    Handles both business profile AND menu branding.
    When dashboard UI is ready — this is what the restaurant manages themselves.
    """
    # Auth
    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name="restaurant")

    # Business info
    business_name = models.CharField(max_length=100)
    owner_name    = models.CharField(max_length=100 )
    phone         = models.CharField(max_length=20 )
    city          = models.CharField(max_length=50)
    address       = models.TextField(blank=True,)

    # Menu branding (used by CheziousARMenu component)
    slug          = models.SlugField(unique=True, blank=True)
    logo          = models.ImageField(upload_to=restaurant_logo_path, null=True, blank=True)
    description   = models.TextField(blank=True)
    primary_color = models.CharField(max_length=7, default="#FFC200")
    header_bg     = models.CharField(max_length=7, default="#f7f5f5")

    # Plan & status
    plan = models.CharField(max_length=20, choices=[
        ("Lite Menu", "Lite Menu"),
        ("Standard Menu", "Standard Menu"),
        ("Pro Menu", "Pro Menu"),
    ], default="Standard Menu")
    is_verified     = models.BooleanField(default=False)
    is_active       = models.BooleanField(default=True)
    joined_at       = models.DateTimeField(auto_now_add=True)
    plan_expires_at = models.DateField(null=True, blank=True)

    def save(self, *args, **kwargs):
        # Auto generate slug from business name
        if not self.slug:
            self.slug = slugify(self.business_name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.business_name} ({self.plan})"


class Category(models.Model):
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="categories")
    name       = models.CharField(max_length=100)
    image      = models.ImageField(upload_to=category_image_path, null=True, blank=True)
    order      = models.PositiveIntegerField(default=0)
    is_active  = models.BooleanField(default=True)

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return f"{self.restaurant.business_name} — {self.name}"


class Dish(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    TONE_MAPPING_CHOICES = [
        ("neutral", "Neutral (Khronos PBR — accurate colours, good for food)"),
        ("aces",    "ACES (cinematic, slightly warm/contrasty)"),
        ("agx",     "AgX (natural, handles blown highlights well)"),
        ("linear",  "Linear (no tone mapping — raw output)"),
        ("commerce", "Commerce (Khronos variant tuned for product shots)"),
    ]

    ENVIRONMENT_CHOICES = [
        ("neutral",  "Neutral studio"),
        ("legacy",   "Legacy (warm, pre-v4 default)"),
    ]
    # model-viewer also accepts a URL to a custom HDR/EXR — stored
    # separately in environment_image_url for that case (see below).

    AR_SCALE_CHOICES = [
        ("auto",  "Auto (model-viewer scales to fit the space)"),
        ("fixed", "Fixed (real-world scale — 1 glTF unit = 1 metre)"),
    ]

    category       = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="dishes")
    name           = models.CharField(max_length=100)
    description    = models.TextField(blank=True)
    price          = models.PositiveIntegerField(help_text="Price in PKR")
    starting_price = models.BooleanField(default=False)
    image          = models.ImageField(upload_to=dish_image_path,)
    is_active      = models.BooleanField(default=True)
    order          = models.PositiveIntegerField(default=0)
    created_at     = models.DateTimeField(auto_now_add=True)

    # --- 3D / AR files (formerly on the standalone Scene model) ---
    glb_file       = models.FileField(upload_to=dish_glb_path, blank=True, null=True)
    usdz_file      = models.FileField(upload_to=dish_glb_path, blank=True, null=True)
    mind_target    = models.FileField(
        upload_to=dish_glb_path, blank=True, null=True,
        help_text=(
            "Compiled MindAR .mind target file for the image-tracking AR "
            "fallback, generated from a marker image via MindAR's compiler: "
            "https://hiukim.github.io/mind-ar-js-doc/tools/compile"
        ),
    )

    # --- Lighting (formerly on Scene) ---
    exposure = models.FloatField(
        default=1.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(4.0)],
        help_text=(
            "Overall brightness multiplier for the 3D viewer. "
            "1.0 = default. Raise for dim models, lower for blown-out ones. "
            "Has no effect inside Scene Viewer or Quick Look AR — those use "
            "the device's own light estimation."
        ),
    )
    shadow_intensity = models.FloatField(
        default=1.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(2.0)],
        help_text="Contact shadow strength beneath the model. 0 = none, 1 = default, 2 = very dark.",
    )
    shadow_softness = models.FloatField(
        default=1.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Shadow edge blur. 0 = hard edge, 1 = fully soft.",
    )
    tone_mapping = models.CharField(
        max_length=20,
        choices=TONE_MAPPING_CHOICES,
        default="neutral",
        help_text=(
            "Tone mapping operator used to convert HDR → display range. "
            "'neutral' is the Khronos PBR standard and is the right default "
            "for food/product shots."
        ),
    )
    environment_image = models.CharField(
        max_length=20,
        choices=ENVIRONMENT_CHOICES,
        default="neutral",
        help_text=(
            "Named environment preset used for IBL (image-based lighting). "
            "Leave blank to use environment_image_url instead."
        ),
        blank=True,
    )
    environment_image_url = models.URLField(
        blank=True,
        help_text=(
            "URL to a custom HDR/EXR environment map. "
            "Takes precedence over environment_image if set."
        ),
    )

    # --- AR / placement (formerly on Scene) ---
    ar_scale = models.CharField(
        max_length=10,
        choices=AR_SCALE_CHOICES,
        default="fixed",
        help_text=(
            "'fixed' places the model at real-world scale (1 glTF unit = 1 m). "
            "Use this for dishes/objects whose physical size matters. "
            "'auto' lets Scene Viewer/Quick Look scale it to fit — useful when "
            "the GLB's native units are wrong and you can't re-export."
        ),
    )
    webxr_model_scale = models.FloatField(
        default=1.0,
        validators=[MinValueValidator(0.001), MaxValueValidator(100.0)],
        help_text=(
            "Extra scale multiplier applied on top of bounding-box normalisation "
            "in the custom WebXR tap-to-place viewer (WebXRPlacementViewer). "
            "The viewer normalises the model to ~25 cm by default; set this to "
            "e.g. 1.5 to make a specific dish appear 50% larger in AR. "
            "Has no effect on the model-viewer / Scene Viewer / Quick Look paths."
        ),
    )

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return f"{self.category.restaurant.business_name} — {self.name}"