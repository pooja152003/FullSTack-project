from django.urls import path
from . import views

urlpatterns = [
    path("upload_report/", views.upload_report, name="upload_report"),
]
