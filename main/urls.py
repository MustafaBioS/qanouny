from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("intake/", views.intake, name="intake"),
    path("conversation/", views.conversation, name="conversation"),
    path("conversation/turn/", views.conversation_turn, name="conversation_turn"),
    path("conversation/upload/", views.conversation_upload, name="conversation_upload"),
    path("conversation/submit/", views.conversation_submit, name="conversation_submit"),
    path("console/login/", views.console_login, name="console_login"),
    path("console/logout/", views.console_logout, name="console_logout"),
    path("console/", views.console, name="console"),
    path("console/api/cases/", views.console_case_list, name="console_case_list"),
    path("console/api/cases/<str:case_id>/", views.console_case_detail, name="console_case_detail"),
    path("console/api/cases/<str:case_id>/action/", views.console_case_action, name="console_case_action"),
]