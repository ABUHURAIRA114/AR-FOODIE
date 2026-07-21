from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from .models import Restaurant, Category, Dish


def restaurant_list(request):
    """
    Public directory of all active restaurants, for a landing/listing page
    that links out to each restaurant's menu (/menu/<slug>/).
    """
    restaurants = Restaurant.objects.filter(is_active=True).order_by("business_name")

    data = {
        "restaurants": [
            {
                "id":          r.id,
                "name":        r.business_name,
                "slug":        r.slug,
                "city":        r.city,
                "description": r.description,
                "logo":        request.build_absolute_uri(r.logo.url) if r.logo else None,
                "primaryColor": r.primary_color,
                "headerBg":     r.header_bg,
                "plan":        r.plan,
                "isVerified":  r.is_verified,
            }
            for r in restaurants
        ]
    }
    return JsonResponse(data)


def menu(request, slug):
    restaurant = get_object_or_404(Restaurant, slug=slug, is_active=True)
    categories = Category.objects.filter(restaurant=restaurant, is_active=True)

    data = {
        "restaurant": {
            "name":          restaurant.business_name,
            "logo":          request.build_absolute_uri(restaurant.logo.url) if restaurant.logo else None,
            "primary_color": restaurant.primary_color,
            "header_bg":     restaurant.header_bg,
            "description":   restaurant.description,
        },
        "categories": [],
    }

    for cat in categories:
        dishes = Dish.objects.filter(category=cat, is_active=True)
        data["categories"].append({
            "id":    cat.id,
            "name":  cat.name,
            "image": request.build_absolute_uri(cat.image.url) if cat.image else None,
            "dishes": [
                {
                    "id":            d.id,
                    "name":          d.name,
                    "description":   d.description,
                    "price":         d.price,
                    "startingPrice": d.starting_price,
                    "image":         request.build_absolute_uri(d.image.url) if d.image else None,
                    "arModelUrl":    request.build_absolute_uri(d.glb_file.url) if d.glb_file else None,
                    "usdzUrl":       request.build_absolute_uri(d.usdz_file.url) if d.usdz_file else None,
                    "categoryId":    cat.id,
                }
                for d in dishes
            ],
        })

    return JsonResponse(data)