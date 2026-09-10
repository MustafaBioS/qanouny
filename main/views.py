import json

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST

from . import services
from .models import Case

INTAKE_STEPS = [
    {
        "key": "area",
        "heading": "Roughly what is this about?",
        "style": "list",
        "options": [
            "Family or marital",
            "Employment",
            "Property or rent",
            "Contracts or business",
            "Money owed or consumer",
            "Criminal or police",
            "Inheritance or wills",
            "Immigration or travel",
            {"text": "I am not sure", "muted": True},
        ],
    },
    {
        "key": "parties",
        "heading": "Who else is involved?",
        "style": "list",
        "options": [
            "Only me",
            "A family member or spouse",
            "An employer or a company",
            "A landlord, neighbour or stranger",
            "A government body",
        ],
    },
    {
        "key": "when",
        "heading": "When did it start?",
        "style": "list",
        "options": [
            "It is happening right now",
            "Within the last month",
            "One to six months ago",
            "More than a year ago",
            {"text": "I am not sure", "muted": True},
        ],
    },
    {
        "key": "filed",
        "heading": "Has a case been filed already?",
        "style": "list",
        "options": [
            "Yes, I filed it",
            "Yes, it was filed against me",
            "No, nothing has been filed",
            {"text": "I am not sure", "muted": True},
        ],
    },
    {
        "key": "deadline",
        "heading": "Is anything on a deadline?",
        "style": "list",
        "options": [
            "Yes, within a week",
            "Yes, within a month",
            "No deadline that I know of",
            {"text": "I am not sure", "muted": True},
        ],
    },
    {
        "key": "governorate",
        "heading": "Where are you?",
        "style": "chips",
        "options": [
            "Cairo", "Giza", "Alexandria", "Qalyubia", "Sharqia", "Dakahlia",
            "Beheira", "Gharbia", "Menoufia", "Kafr El Sheikh", "Damietta",
            "Port Said", "Ismailia", "Suez", "North Sinai", "South Sinai",
            "Faiyum", "Beni Suef", "Minya", "Asyut", "Sohag", "Qena", "Luxor",
            "Aswan", "Red Sea", "New Valley", "Matrouh", "Outside Egypt",
        ],
    },
]


def _build_steps_context():
    steps = []
    for step in INTAKE_STEPS:
        options = []
        for index, option in enumerate(step["options"]):
            if isinstance(option, dict):
                text, muted = option["text"], option.get("muted", False)
            else:
                text, muted = option, False
            letter = chr(65 + index) if step["style"] == "list" else None
            options.append({"index": index, "letter": letter, "text": text, "muted": muted})
        steps.append({"key": step["key"], "heading": step["heading"], "style": step["style"], "options": options})
    return steps


def index(request):
    return render(request, "main/index.html")


def intake(request):
    return render(request, "main/intake.html", {"steps": _build_steps_context()})


@ensure_csrf_cookie
def conversation(request):
    return render(request, "main/conversation.html")


@require_POST
def conversation_turn(request):
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "invalid JSON body"}, status=400)

    survey = payload.get("survey") or {}
    description = payload.get("description") or ""
    transcript = payload.get("transcript") or []
    if not isinstance(survey, dict) or not isinstance(transcript, list):
        return JsonResponse({"error": "invalid payload"}, status=400)

    turn = services.get_next_turn(survey, description, transcript)
    if turn.get("done"):
        turn["match"] = services.build_match(survey)
    return JsonResponse(turn)


@require_POST
def conversation_upload(request):
    uploaded = request.FILES.get("file")
    if not uploaded:
        return JsonResponse({"error": "no file provided"}, status=400)
    if uploaded.size > 15 * 1024 * 1024:
        return JsonResponse({"error": "file is larger than 15MB"}, status=400)

    try:
        result = services.upload_file(uploaded)
    except Exception:
        return JsonResponse({"error": "upload failed, please try again"}, status=502)
    return JsonResponse(result)


@require_POST
def conversation_submit(request):
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "invalid JSON body"}, status=400)

    case_id = payload.get("caseId") or ""
    if not case_id:
        return JsonResponse({"error": "missing caseId"}, status=400)

    Case.objects.update_or_create(
        case_id=case_id,
        defaults={
            "email": payload.get("email") or "",
            "survey": payload.get("survey") or {},
            "description": payload.get("description") or "",
            "transcript": payload.get("transcript") or [],
            "match": payload.get("match") or {},
        },
    )
    return JsonResponse({"ok": True})
