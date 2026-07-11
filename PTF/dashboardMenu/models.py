from django.db import models
from django.contrib.auth.models import User


class Restaurant(models.Model):
    """One restaurant per client account."""
    owner        = models.OneToOneField(User, on_delete=models.CASCADE, related_name="restaurant")
    name         = models.CharField(max_length=100)
    slug         = models.SlugField(unique=True, help_text="URL-friendly name e.g. 'cheezious'")
    logo         = models.ImageField(upload_to="restaurants/logos/")
    description  = models.TextField(blank=True)
    primary_color = models.CharField(max_length=7, default="#FFC200", help_text="Hex color e.g. #FFC200")
    header_bg    = models.CharField(max_length=7, default="#f7f5f5")
    is_active    = models.BooleanField(default=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Category(models.Model):
    """Menu categories e.g. Thin Crust Pizza, Burgers."""
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="categories")
    name       = models.CharField(max_length=100)
    image      = models.ImageField(upload_to="restaurants/categories/")
    order      = models.PositiveIntegerField(default=0, help_text="Display order")
    is_active  = models.BooleanField(default=True)

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return f"{self.restaurant.name} — {self.name}"


class Dish(models.Model):
    """Individual dish inside a category."""
    category      = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="dishes")
    name          = models.CharField(max_length=100)
    description   = models.TextField(blank=True)
    price         = models.PositiveIntegerField(help_text="Price in PKR")
    starting_price = models.BooleanField(default=False, help_text="Show 'Starting Price' badge")
    image         = models.ImageField(upload_to="restaurants/dishes/images/")
    glb_file      = models.FileField(upload_to="restaurants/dishes/models/", blank=True, null=True, help_text="3D AR model (.glb)")
    usdz_file     = models.FileField(upload_to="restaurants/dishes/models/", blank=True, null=True, help_text="AR model for iOS (.usdz)")
    is_active     = models.BooleanField(default=True)
    order         = models.PositiveIntegerField(default=0)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return f"{self.category.restaurant.name} — {self.name}"