from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from .models import Restaurant, Category, Dish


def _dish_ar_fields(dish):
    """Return all per-dish lighting/AR fields as a dict for JSON responses."""
    return {
        'exposure':             dish.exposure,
        'shadow_intensity':     dish.shadow_intensity,
        'shadow_softness':      dish.shadow_softness,
        'tone_mapping':         dish.tone_mapping,
        # Prefer a custom HDR URL if set, otherwise use the named preset.
        'environment_image':    dish.environment_image_url or dish.environment_image,
        'ar_scale':             dish.ar_scale,
        'webxr_model_scale':    dish.webxr_model_scale,
    }


def api_dish(request, pk):
    """
    Single-dish AR data for the full AR viewer (SceneViewer.tsx, reached via
    the frontend's /ar-view/<id> route) — everything it needs to render the
    3D model with the right lighting/AR settings, plus the optional
    image-tracking .mind target.

    mind_target lives on Restaurant, not Dish — one marker image per
    restaurant (e.g. a printed table tent), shared by every dish on that
    restaurant's menu. Scanning that one marker and picking a dish shows
    that dish's model on top of the same restaurant-level target, rather
    than needing a separate marker printed per dish.
    """
    dish = get_object_or_404(
        Dish.objects.select_related('category__restaurant'), pk=pk, is_active=True
    )
    restaurant = dish.category.restaurant
    return JsonResponse({
        'id':          dish.id,
        'name':        dish.name,
        'description': dish.description,
        'glb_url':     request.build_absolute_uri(dish.glb_file.url) if dish.glb_file else None,
        'usdz_url':    request.build_absolute_uri(dish.usdz_file.url) if dish.usdz_file else None,
        'mind_target_url': request.build_absolute_uri(restaurant.mind_target.url) if restaurant.mind_target else None,
        'primary_color': restaurant.primary_color,
        **_dish_ar_fields(dish),
    })


def my_dishes(request):
    """
    List view for the frontend's staff/owner "Models" page (ModelsPage.tsx).
    Direct replacement for the removed Scene-based api_dishes — same
    ownership rules, just keyed off Dish -> Category -> Restaurant.owner
    instead of Scene.owner.
    """
    if request.user.is_authenticated and request.user.is_staff:
        dishes = Dish.objects.select_related('category__restaurant').order_by('-created_at')
    elif request.user.is_authenticated:
        dishes = Dish.objects.select_related('category__restaurant').filter(
            category__restaurant__owner=request.user
        ).order_by('-created_at')
    else:
        return JsonResponse({'dishes': []})

    data = []
    for d in dishes:
        data.append({
            'id':          str(d.id),
            'name':        d.name,
            'description': d.description,
            'restaurant':  d.category.restaurant.business_name,
            'category':    d.category.name,
            'glb_url':     request.build_absolute_uri(d.glb_file.url) if d.glb_file else None,
            'usdz_url':    request.build_absolute_uri(d.usdz_file.url) if d.usdz_file else None,
            'ar_url':      f"/ar-view/{d.id}" if d.glb_file else None,
            'owner':       d.category.restaurant.owner_id,
        })

    return JsonResponse({'dishes': data})


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
                    "arViewUrl":     f"/ar-view/{d.id}" if d.glb_file else None,
                    "categoryId":    cat.id,
                }
                for d in dishes
            ],
        })

    return JsonResponse(data)