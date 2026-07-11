from django.urls import path
from . import views

urlpatterns = [
    path("<slug:slug>/", views.menu, name="restaurant_menu"),
]