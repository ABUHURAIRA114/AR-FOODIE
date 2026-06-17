from django.urls import path
from . import views

urlpatterns = [
    path('view/<uuid:pk>/', views.view_model, name='view_model'),
    path('api/dishes/', views.api_dishes, name='api_dishes'),
    path('api/upload/', views.upload_scene, name='upload_scene'),
    path('api/delete/<uuid:pk>/', views.delete_scene, name='delete_scene'),
    path('api/csrf/', views.csrf_token_view, name='csrf_token'),
    # path('api/login/', views.login_view, name='login'),
    # path('api/logout/', views.logout_view, name='logout'),
    path('api/me/', views.me_view, name='me'),
    path('api/user-login/', views.user_login_view, name='user_login'),
    path('api/user-logout/', views.user_logout_view, name='user_logout'),
    path('api/user-me/', views.user_me_view, name='user_me'),
    path('api/user-register/', views.user_register_view, name='user_register'),
]