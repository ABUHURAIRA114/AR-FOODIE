from django.db import models


# Kept for backward compatibility with historical migrations only — Django
# migrations reference FileField upload_to callables by their real import
# path, so this must keep existing even though the Scene model that used it
# is gone. Do not remove; do not use in any new code.
def scene_upload_path(instance, filename):
    parent = getattr(instance, "parent", None) or "general"
    return f"scenes/{parent}/{filename}"


class Response(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()

    def __str__(self):
        return f"{self.name} ({self.description})"
    

class Feedback(models.Model):
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Feedback {self.id} — {self.created_at.strftime('%Y-%m-%d %H:%M')}"