import uuid
from django.db import models

def scene_upload_path(instance, filename):
    parent = instance.parent or 'general'
    return f"scenes/{parent}/{filename}"

class Scene(models.Model):
    owner = models.ForeignKey('auth.User', on_delete=models.CASCADE,related_name = "scenes", null=True, blank=True)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    parent = models.CharField(max_length=100, blank=True, default='general')
    glb_file = models.FileField(upload_to=scene_upload_path)
    usdz_file = models.FileField(upload_to=scene_upload_path, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.parent})"

class UserRegister(models.Model):

    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    username = models.CharField(max_length=40, unique=True)
    password = models.CharField(max_length=128)  # Store hashed password
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Register for {self.user.username} at {self.created_at}"