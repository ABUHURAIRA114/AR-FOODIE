import uuid
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

def scene_upload_path(instance, filename):
    parent = instance.parent or 'general'
    return f"scenes/{parent}/{filename}"

class Scene(models.Model):

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

    # --- Identity ---
    owner       = models.ForeignKey(
        'auth.User', on_delete=models.CASCADE,
        related_name="scenes", null=True, blank=True,
    )
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name        = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    parent      = models.CharField(max_length=100, blank=True, default='general')
    created_at  = models.DateTimeField(auto_now_add=True)

    # --- Files ---
    glb_file    = models.FileField(upload_to=scene_upload_path)
    usdz_file   = models.FileField(upload_to=scene_upload_path, blank=True, null=True)

    # --- Lighting ---
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

    # --- AR / placement ---
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

    def __str__(self):
        return f"{self.name} ({self.parent})"

class Response(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()

    def __str__(self):
        return f"{self.name} ({self.description})"
    

class Feedback(models.Model):
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Feedback {self.id} — {self.created_at.strftime('%Y-%m-%d %H:%M')}"