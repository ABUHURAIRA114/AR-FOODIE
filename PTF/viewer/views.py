from dashboardMenu.models import Restaurant

from .models import Feedback
from django.contrib.auth.models import User
from django.views.decorators.http import require_POST
import json
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.middleware.csrf import get_token
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
import re


def _parse_float(value, default):
    """Safely parse a float from POST data, falling back to default."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


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
@csrf_exempt
@require_POST
def user_register_view(request):
    data = json.loads(request.body)

    username      = data.get('username')
    password      = data.get('password')
    business_name = data.get('business_name')
    owner_name    = data.get('owner_name')
    phone         = data.get('phone')
    city          = data.get('city')

    if User.objects.filter(username=username).exists():
        return JsonResponse({'error': 'Username already exists.'}, status=400)

    if Restaurant.objects.filter(phone=phone).exists():
        return JsonResponse({'error': 'An account with this phone number already exists.'}, status=400)

    user = User.objects.create_user(username=username, password=password)

    Restaurant.objects.create(
        owner=user,
        business_name=business_name,
        owner_name=owner_name,
        phone=phone,
        city=city,
    )

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