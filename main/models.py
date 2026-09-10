from django.conf import settings
from django.db import models


class Case(models.Model):
    STATUS_PENDING = "pending"
    STATUS_ONGOING = "ongoing"
    STATUS_REVIEW = "review"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending review"),
        (STATUS_ONGOING, "Ongoing"),
        (STATUS_REVIEW, "In firm review"),
        (STATUS_CLOSED, "Closed"),
    ]
    STAGE_NAMES = [
        "Instructions confirmed",
        "Documents gathered",
        "Advice given",
        "Filed or negotiated",
    ]

    case_id = models.CharField(max_length=16, unique=True)
    name = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    survey = models.JSONField(default=dict)
    description = models.TextField(blank=True)
    transcript = models.JSONField(default=list)
    exchanges = models.JSONField(default=list, blank=True)
    files = models.JSONField(default=list, blank=True)
    match = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="cases"
    )
    records = models.JSONField(default=list, blank=True)
    fee = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)
    timeline = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.case_id
