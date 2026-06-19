from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from .models import Scene, UserRegister
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
import json
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from django.views.decorators.http import require_POST
import io
import base64
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse


def home(request):
    models = Scene.objects.all().order_by('-created_at')
    return render(request, 'viewer/home.html', {'models': models})

def view_model(request, pk):
    model = get_object_or_404(Scene, pk=pk)
    return render(request, 'viewer/view_model.html', {'model': model})

def api_dishes(request):
    if request.user.is_authenticated and request.user.is_staff:
        dishes = Scene.objects.all().order_by('-created_at').values(
            'id', 'name', 'parent', 'description', 'glb_file', 'usdz_file', 'created_at', 'owner'
        )
    elif request.user.is_authenticated:
        dishes = Scene.objects.filter(owner=request.user).order_by('-created_at').values(
            'id', 'name', 'parent', 'description', 'glb_file', 'usdz_file', 'created_at', 'owner'
        )
    else:

        dishes = Scene.objects.all().order_by('-created_at').values(
            'id', 'name', 'parent', 'description', 'glb_file', 'usdz_file', 'created_at', 'owner'
    )
    data = []
    for d in dishes:
        data.append({
            'owner': d['owner'],
            'id': d['id'],
            'name': d['name'],
            'description': d['description'],
            'parent': d['parent'],
            'glb_url': f"/media/{d['glb_file']}" if d['glb_file'] else None,
            'usdz_url': f"/media/{d['usdz_file']}" if d['usdz_file'] else None,
            'ar_url': f"/view/{d['id']}/"
        })

    return JsonResponse({'dishes': data})

@require_POST
def upload_scene(request):
    if not (request.user.is_authenticated and request.user.is_staff):
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    target_username = request.POST.get('target_username',''.strip())
    owner = get_object_or_404(User, username=target_username) if target_username else request.user
    name = request.POST.get('name', '').strip()
    description = request.POST.get('description', '').strip()
    parent = request.POST.get('parent', '').strip() or 'general'
    glb_file = request.FILES.get('glb_file')
    usdz_file = request.FILES.get('usdz_file')

    if not name or not glb_file:
        return JsonResponse({'error': 'Name and GLB file are required.'}, status=400)

    scene = Scene.objects.create(
         owner=owner,
        name=name,
        description=description,
        parent=parent,
        glb_file=glb_file, 
        usdz_file=usdz_file,
    )

    return JsonResponse({
        'id': scene.id,
        'name': scene.name,
        'description': scene.description,
        'parent': scene.parent,
        'glb_url': f"/media/{scene.glb_file}",
        'usdz_url': f"/media/{scene.usdz_file}" if scene.usdz_file else None,
        'ar_url': f"/view/{scene.id}/",
    })

@require_POST
def delete_scene(request, pk):
    scene = get_object_or_404(Scene, pk=pk)
    if not (request.user.is_staff and scene.owner != request.user):
        return JsonResponse({'error': 'Unauthorized'}, status=403)

    scene = get_object_or_404(Scene, pk=pk)
    scene.glb_file.delete(save=False)
    if scene.usdz_file:
        scene.usdz_file.delete(save=False)
    scene.delete()
    return JsonResponse({'success': True})

@ensure_csrf_cookie
def csrf_token_view(request):
    return JsonResponse({'csrfToken': get_token(request)})

# @require_POST
# def login_view(request):
#     data = json.loads(request.body)
#     user = authenticate(request, username=data.get('username'), password=data.get('password'))
#     if user and user.is_staff:
#         login(request, user)
#         return JsonResponse({'success': True, 'username': user.username})
#     return JsonResponse({'error': 'Invalid credentials'}, status=401)


# @require_POST
# def logout_view(request):
#     logout(request)
#     return JsonResponse({'success': True})

def me_view(request):
    if request.user.is_authenticated:
        return JsonResponse({'is_staff': request.user.is_staff, 'is_user': True, 'username': request.user.username})
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
    return JsonResponse({'success': True, 'username': user.username})