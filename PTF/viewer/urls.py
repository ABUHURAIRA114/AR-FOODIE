from django.urls import path
from . import views

urlpatterns = [
    path('api/csrf/', views.csrf_token_view, name='csrf_token'),
    path('api/me/', views.me_view, name='me'),
    path('api/user-login/', views.user_login_view, name='user_login'),
    path('api/user-logout/', views.user_logout_view, name='user_logout'),
    path('api/user-me/', views.user_me_view, name='user_me'),
    path('api/user-register/', views.user_register_view, name='user-register'),
    path("api/feedback/", views.submit_feedback, name="submit_feedback"),
]