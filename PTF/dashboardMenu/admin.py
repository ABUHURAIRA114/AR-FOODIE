from django.contrib import admin
from .models import Restaurant, Category, Dish


class CategoryInline(admin.TabularInline):
    model = Category
    extra = 1
    fields = ["name", "image", "order", "is_active"]


class DishInline(admin.TabularInline):
    model = Dish
    extra = 1
    fields = ["name", "description", "price", "starting_price", "image", "glb_file", "usdz_file", "order", "is_active"]


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display  = ["name", "slug", "owner", "is_active", "created_at"]
    prepopulated_fields = {"slug": ("name",)}
    inlines = [CategoryInline]


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display  = ["name", "restaurant", "order", "is_active"]
    list_filter   = ["restaurant"]
    inlines       = [DishInline]


@admin.register(Dish)
class DishAdmin(admin.ModelAdmin):
    list_display  = ["name", "category", "price", "starting_price", "is_active"]
    list_filter   = ["category__restaurant", "category"]
    search_fields = ["name"]