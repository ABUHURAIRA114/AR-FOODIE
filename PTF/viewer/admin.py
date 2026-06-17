from django.contrib import admin
from .models import Scene
from .models import UserRegister


admin.site.register(UserRegister)
admin.site.register(Scene)