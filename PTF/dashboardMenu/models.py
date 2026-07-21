from django.db import models
from django.contrib.auth.models import User
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
    category       = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="dishes")
    name           = models.CharField(max_length=100)
    description    = models.TextField(blank=True)
    price          = models.PositiveIntegerField(help_text="Price in PKR")
    starting_price = models.BooleanField(default=False)
    image          = models.ImageField(upload_to=dish_image_path,)
    glb_file       = models.FileField(upload_to=dish_glb_path, blank=True, null=True)
    usdz_file      = models.FileField(upload_to=dish_glb_path, blank=True, null=True)
    is_active      = models.BooleanField(default=True)
    order          = models.PositiveIntegerField(default=0)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return f"{self.category.restaurant.business_name} — {self.name}"