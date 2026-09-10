from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("intake/", views.intake, name="intake"),
    path("conversation/", views.conversation, name="conversation"),
    path("conversation/turn/", views.conversation_turn, name="conversation_turn"),
    path("conversation/upload/", views.conversation_upload, name="conversation_upload"),
    path("conversation/submit/", views.conversation_submit, name="conversation_submit"),
]