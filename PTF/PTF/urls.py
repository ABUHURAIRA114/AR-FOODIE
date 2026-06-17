from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('viewer.urls')),

]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# urlpatterns = [
#      # Catch-all: serve React SPA for every other path
#     re_path(r'^(?!admin/|view/|api/|media/).*$',
#             TemplateView.as_view(template_name='index.html'), name='index'),
# ]