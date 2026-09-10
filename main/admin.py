from django.contrib import admin

from .models import Case


@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
    list_display = ("case_id", "name", "status", "assigned_to", "created_at")
    list_filter = ("status",)
    readonly_fields = (
        "case_id", "name", "phone", "email", "survey", "description", "transcript", "exchanges", "files",
        "match", "records", "timeline", "created_at", "updated_at",
    )
