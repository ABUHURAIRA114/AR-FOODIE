from django.db import models

# Create your models here.

class DashboardMenu(models.Model):
    name = models.CharField(max_length=100)
    logo = models.ImageField(upload_to='dashboard_menu/logos/')
    description = models.TextField(blank=True)
    date = models.DateTimeField(auto_now_add=True)
