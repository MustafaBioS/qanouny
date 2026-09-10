from django.db import models


class Case(models.Model):
    case_id = models.CharField(max_length=16, unique=True)
    email = models.EmailField(blank=True)
    survey = models.JSONField(default=dict)
    description = models.TextField(blank=True)
    transcript = models.JSONField(default=list)
    match = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.case_id
