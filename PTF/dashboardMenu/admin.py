from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from .models import Restaurant, Category, Dish


class CategoryInline(admin.TabularInline):
    model  = Category
    extra  = 1
    fields = ["name", "image", "order", "is_active"]


class DishInline(admin.TabularInline):
    model  = Dish
    extra  = 1
    fields = ["name", "price", "starting_price", "image", "glb_file", "order", "is_active"]


class RestaurantInline(admin.StackedInline):
    model       = Restaurant
    can_delete  = False
    fields      = ["business_name", "owner_name", "phone", "city", "plan", "is_verified", "is_active"]


# Replace default User admin
admin.site.unregister(User)

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    inlines      = [RestaurantInline]
    list_display = ["username", "get_business", "get_city", "get_plan", "get_verified", "date_joined"]
    list_filter  = ["restaurant__plan", "restaurant__is_verified", "restaurant__city"]
    search_fields = ["username", "restaurant__business_name", "restaurant__phone"]

    def get_business(self, obj):
        try: return obj.restaurant.business_name
        except: return "—"
    get_business.short_description = "Business"

    def get_city(self, obj):
        try: return obj.restaurant.city
        except: return "—"
    get_city.short_description = "City"

    def get_plan(self, obj):
        try: return obj.restaurant.plan
        except: return "—"
    get_plan.short_description = "Plan"

    def get_verified(self, obj):
        try: return obj.restaurant.is_verified
        except: return False
    get_verified.short_description = "Verified"
    get_verified.boolean = True


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display  = ["business_name", "owner", "city", "plan", "is_verified", "is_active", "joined_at"]
    list_filter   = ["plan", "is_verified", "city"]
    search_fields = ["business_name", "owner__username", "phone"]
    prepopulated_fields = {"slug": ("business_name",)}
    inlines       = [CategoryInline]


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "restaurant", "order", "is_active"]
    list_filter  = ["restaurant"]
    inlines      = [DishInline]


@admin.register(Dish)
class DishAdmin(admin.ModelAdmin):
    list_display  = ["name", "category", "price", "starting_price", "is_active"]
    list_filter   = ["category__restaurant", "category"]
    search_fields = ["name"]