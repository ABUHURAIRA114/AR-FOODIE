from django import forms
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
    # Selecting the restaurant for a category is already a plain, unambiguous
    # FK dropdown — nothing extra needed here beyond making it searchable so
    # DishAdmin's autocomplete (below) can find categories by restaurant name.
    list_display  = ["name", "restaurant", "order", "is_active"]
    list_filter   = ["restaurant"]
    search_fields = ["name", "restaurant__business_name"]
    inlines       = [DishInline]


class RestaurantScopedCategorySelect(forms.Select):
    """
    A plain <select>, except every <option> also carries
    data-restaurant-id="<pk>" — read by restaurant_category_filter.js to
    show/hide options as the "Restaurant" field above it changes, without
    needing any AJAX call (the whole category list is small enough to embed
    directly in the page this way).
    """
    def __init__(self, *args, category_restaurant_map=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.category_restaurant_map = category_restaurant_map or {}

    def create_option(self, name, value, label, selected, index, subindex=None, attrs=None):
        option = super().create_option(name, value, label, selected, index, subindex=subindex, attrs=attrs)
        restaurant_id = self.category_restaurant_map.get(str(value))
        if restaurant_id is not None:
            option["attrs"]["data-restaurant-id"] = restaurant_id
        return option


class DishAdminForm(forms.ModelForm):
    """
    Adds a "Restaurant" field that isn't on the Dish model at all — it exists
    purely to scope the `category` dropdown client-side via restaurant_category_filter.js,
    so staff managing many restaurants can't accidentally attach a dish to
    another restaurant's category. When editing an existing dish, this is
    pre-filled from dish.category.restaurant so the category list is already
    correctly scoped on load.
    """
    restaurant = forms.ModelChoiceField(
        queryset=Restaurant.objects.all().order_by("business_name"),
        required=False,
        help_text="Pick the restaurant first — the Category list below will filter to just that restaurant's categories.",
    )

    class Meta:
        model = Dish
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Order categories by restaurant so the filtered-out state (before
        # JS runs, or if JS is disabled) still groups sensibly, and label
        # each option as "Restaurant — Category" so it's unambiguous even
        # without the JS filtering.
        self.fields["category"].queryset = (
            Category.objects.select_related("restaurant").order_by("restaurant__business_name", "order", "name")
        )
        self.fields["category"].label_from_instance = lambda c: f"{c.restaurant.business_name} — {c.name}"

        category_restaurant_map = {
            str(c.pk): c.restaurant_id for c in self.fields["category"].queryset
        }
        self.fields["category"].widget = RestaurantScopedCategorySelect(
            category_restaurant_map=category_restaurant_map
        )
        # Re-attach choices to the freshly-swapped widget — ModelChoiceField
        # normally wires this up automatically when .queryset is assigned,
        # but only for whichever widget instance existed at that moment.
        self.fields["category"].widget.choices = self.fields["category"].choices

        if self.instance and self.instance.pk and self.instance.category_id:
            self.fields["restaurant"].initial = self.instance.category.restaurant_id


@admin.register(Dish)
class DishAdmin(admin.ModelAdmin):
    form          = DishAdminForm
    list_display  = ["name", "get_restaurant", "category", "price", "starting_price", "is_active"]
    list_filter   = ["category__restaurant", "category"]
    search_fields = ["name", "category__name", "category__restaurant__business_name"]

    # Ships a small vanilla-JS file (no extra admin packages needed) that:
    #  1. Reads a restaurant_id -> [category_id, ...] map embedded in the
    #     page (rendered via a data attribute on the category <select>).
    #  2. On page load and whenever "Restaurant" changes, hides/shows
    #     <option> elements in the "Category" <select> to match.
    class Media:
        js = ("dashboardMenu/restaurant_category_filter.js",)

    def get_restaurant(self, obj):
        return obj.category.restaurant.business_name
    get_restaurant.short_description = "Restaurant"
    get_restaurant.admin_order_field = "category__restaurant__business_name"