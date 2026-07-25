from django.urls import path
from . import views

urlpatterns = [
    path("restaurants/", views.restaurant_list, name="restaurant_list"),
    path("my-dishes/", views.my_dishes, name="my_dishes"),
    path("dish/<uuid:pk>/", views.api_dish, name="api_dish"),
    path("<slug:slug>/", views.menu, name="restaurant_menu"),
]