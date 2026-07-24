from django.contrib import admin
from .models import Response, Feedback

admin.site.register(Response)

@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "message")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)