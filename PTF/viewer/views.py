from .models import Scene, Feedback
from django.contrib.auth.models import User
from django.views.decorators.http import require_POST
import json
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.middleware.csrf import get_token
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse


def home(request):
    models = Scene.objects.all().order_by('-created_at')
    return render(request, 'viewer/home.html', {'models': models})


def _scene_lighting_fields(scene):
    """Return all per-scene lighting/AR fields as a dict for JSON responses."""
    return {
        'exposure':             scene.exposure,
        'shadow_intensity':     scene.shadow_intensity,
        'shadow_softness':      scene.shadow_softness,
        'tone_mapping':         scene.tone_mapping,
        # Prefer a custom HDR URL if set, otherwise use the named preset.
        'environment_image':    scene.environment_image_url or scene.environment_image,
        'ar_scale':             scene.ar_scale,
        'webxr_model_scale':    scene.webxr_model_scale,
    }


def api_scene(request, pk):
    scene = get_object_or_404(Scene, pk=pk)
    return JsonResponse({
        'id':          str(scene.id),
        'name':        scene.name,
        'description': scene.description,
        'parent':      scene.parent,
        'glb_url':     request.build_absolute_uri(scene.glb_file.url) if scene.glb_file else None,
        'usdz_url':    request.build_absolute_uri(scene.usdz_file.url) if scene.usdz_file else None,
        **_scene_lighting_fields(scene),
    })


def api_dishes(request):
    if request.user.is_authenticated and request.user.is_staff:
        scenes = Scene.objects.all().order_by('-created_at')
    elif request.user.is_authenticated:
        scenes = Scene.objects.filter(owner=request.user).order_by('-created_at')
    else:
        scenes = Scene.objects.all().order_by('-created_at')

    data = []
    for scene in scenes:
        data.append({
            'owner':       scene.owner_id,
            'id':          str(scene.id),
            'name':        scene.name,
            'description': scene.description,
            'parent':      scene.parent,
            'glb_url':     request.build_absolute_uri(scene.glb_file.url) if scene.glb_file else None,
            'usdz_url':    request.build_absolute_uri(scene.usdz_file.url) if scene.usdz_file else None,
            'ar_url':      f"/ar-view/{scene.id}/",
            **_scene_lighting_fields(scene),
        })

    return JsonResponse({'dishes': data})


def _parse_float(value, default):
    """Safely parse a float from POST data, falling back to default."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


@require_POST
def upload_scene(request):
    if not (request.user.is_authenticated and request.user.is_staff):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    target_username = request.POST.get('target_username', '').strip()
    owner = get_object_or_404(User, username=target_username) if target_username else request.user

    name     = request.POST.get('name', '').strip()
    description = request.POST.get('description', '').strip()
    parent   = request.POST.get('parent', '').strip() or 'general'
    glb_file  = request.FILES.get('glb_file')
    usdz_file = request.FILES.get('usdz_file')

    if not name or not glb_file:
        return JsonResponse({'error': 'Name and GLB file are required.'}, status=400)

    # --- Lighting / AR fields (all optional; defaults come from the model) ---
    exposure          = _parse_float(request.POST.get('exposure'), 1.0)
    shadow_intensity  = _parse_float(request.POST.get('shadow_intensity'), 1.0)
    shadow_softness   = _parse_float(request.POST.get('shadow_softness'), 1.0)
    tone_mapping      = request.POST.get('tone_mapping', 'neutral').strip()
    environment_image = request.POST.get('environment_image', 'neutral').strip()
    environment_image_url = request.POST.get('environment_image_url', '').strip()
    ar_scale          = request.POST.get('ar_scale', 'fixed').strip()
    webxr_model_scale = _parse_float(request.POST.get('webxr_model_scale'), 1.0)

    # Validate choice fields against what the model actually allows.
    valid_tone_mappings   = {c[0] for c in Scene.TONE_MAPPING_CHOICES}
    valid_ar_scales       = {c[0] for c in Scene.AR_SCALE_CHOICES}
    valid_environments    = {c[0] for c in Scene.ENVIRONMENT_CHOICES}

    if tone_mapping not in valid_tone_mappings:
        tone_mapping = 'neutral'
    if ar_scale not in valid_ar_scales:
        ar_scale = 'fixed'
    if environment_image not in valid_environments:
        environment_image = 'neutral'

    scene = Scene.objects.create(
        owner=owner,
        name=name,
        description=description,
        parent=parent,
        glb_file=glb_file,
        usdz_file=usdz_file,
        exposure=exposure,
        shadow_intensity=shadow_intensity,
        shadow_softness=shadow_softness,
        tone_mapping=tone_mapping,
        environment_image=environment_image,
        environment_image_url=environment_image_url,
        ar_scale=ar_scale,
        webxr_model_scale=webxr_model_scale,
    )

    return JsonResponse({
        'id':          str(scene.id),
        'name':        scene.name,
        'description': scene.description,
        'parent':      scene.parent,
        'glb_url':     f"/media/{scene.glb_file}",
        'usdz_url':    f"/media/{scene.usdz_file}" if scene.usdz_file else None,
        'ar_url':      f"/ar-view/{scene.id}/",
        **_scene_lighting_fields(scene),
    })


@require_POST
def delete_scene(request, pk):
    scene = get_object_or_404(Scene, pk=pk)

    # Original code had an inverted condition:
    #   `not (request.user.is_staff and scene.owner != request.user)`
    # which allowed deletion only when the owner was *not* the requester —
    # the opposite of what's intended. Fixed to: staff can delete anything,
    # owners can delete their own scenes, everyone else is rejected.
    is_owner = scene.owner == request.user
    if not request.user.is_authenticated or not (request.user.is_staff or is_owner):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    scene.glb_file.delete(save=False)
    if scene.usdz_file:
        scene.usdz_file.delete(save=False)
    scene.delete()
    return JsonResponse({'success': True})


@ensure_csrf_cookie
def csrf_token_view(request):
    return JsonResponse({'csrfToken': get_token(request)})


def me_view(request):
    if request.user.is_authenticated:
        return JsonResponse({
            'is_staff': request.user.is_staff,
            'is_user':  True,
            'username': request.user.username,
        })
    return JsonResponse({'is_staff': False, 'is_user': False})


@require_POST
def user_login_view(request):
    data = json.loads(request.body)
    user = authenticate(request, username=data.get('username'), password=data.get('password'))
    if user:
        login(request, user)
        return JsonResponse({'success': True, 'username': user.username})
    return JsonResponse({'error': 'Invalid credentials'}, status=401)


@require_POST
def user_logout_view(request):
    logout(request)
    return JsonResponse({'success': True})


def user_me_view(request):
    if request.user.is_authenticated:
        return JsonResponse({'is_user': True, 'username': request.user.username})
    return JsonResponse({'is_user': False})


@require_POST
def user_register_view(request):
    data = json.loads(request.body)
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return JsonResponse({'error': 'Username and password are required.'}, status=400)
    if User.objects.filter(username=username).exists():
        return JsonResponse({'error': 'Username already exists.'}, status=400)
    user = User.objects.create_user(username=username, password=password)
    login(request, user)
    return JsonResponse({'success': True, 'username': user.username})


@csrf_exempt
def submit_feedback(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            message = data.get("message", "").strip()
            if not message:
                return JsonResponse({"error": "Message is required"}, status=400)
            Feedback.objects.create(message=message)
            return JsonResponse({"ok": True}, status=201)
        except Exception:
            return JsonResponse({"error": "Server error"}, status=500)
    return JsonResponse({"error": "Method not allowed"}, status=405)