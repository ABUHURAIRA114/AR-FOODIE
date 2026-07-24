from django.urls import path
from . import views

urlpatterns = [
    path("restaurants/", views.restaurant_list, name="restaurant_list"),
    path("dish/<int:pk>/", views.api_dish, name="api_dish"),
    path("<slug:slug>/", views.menu, name="restaurant_menu"),
]