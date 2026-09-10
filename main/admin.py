from django.contrib import admin

from .models import Case


@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
    list_display = ("case_id", "email", "created_at")
    readonly_fields = ("case_id", "email", "survey", "description", "transcript", "match", "created_at")
