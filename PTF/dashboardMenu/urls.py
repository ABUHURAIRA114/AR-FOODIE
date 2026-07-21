from django.urls import path
from . import views

urlpatterns = [
    path("restaurants/", views.restaurant_list, name="restaurant_list"),
    path("<slug:slug>/", views.menu, name="restaurant_menu"),
]