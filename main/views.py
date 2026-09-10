import json

from django.contrib.auth import login as auth_login, logout as auth_logout
from django.contrib.auth.decorators import user_passes_test
from django.contrib.auth.forms import AuthenticationForm
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
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


def is_counsel(user):
    return user.is_authenticated and user.is_staff


def console_login(request):
    if is_counsel(request.user):
        return redirect("console")

    form = AuthenticationForm(request, data=request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = form.get_user()
        if not user.is_staff:
            form.add_error(None, "This account does not have counsel access.")
        else:
            auth_login(request, user)
            return redirect("console")
    return render(request, "main/console_login.html", {"form": form})


def console_logout(request):
    auth_logout(request)
    return redirect("console_login")


@user_passes_test(is_counsel, login_url="console_login")
def console(request):
    return render(request, "main/console.html")


def _relative_age(dt):
    seconds = (timezone.now() - dt).total_seconds()
    if seconds < 3600:
        return str(max(1, int(seconds // 60))) + "m"
    if seconds < 86400:
        return str(int(seconds // 3600)) + "h"
    if seconds < 604800:
        return str(int(seconds // 86400)) + "d"
    return str(int(seconds // 604800)) + "w"


def _case_row(case):
    return {
        "id": case.case_id,
        "client": case.name or ("Case " + case.case_id),
        "where": " · ".join(filter(None, [case.survey.get("area"), case.survey.get("governorate")])) or "Not given",
        "age": _relative_age(case.created_at),
        "line": (case.description or "No free-text description given.")[:140],
        "status": case.status,
    }


FACT_LABELS = [("area", "Field"), ("governorate", "Governorate"), ("filed", "Case filed"), ("deadline", "Deadline")]


def _case_detail(case, user):
    mine = case.assigned_to_id == user.id
    return {
        "id": case.case_id,
        "status": case.status,
        "mine": mine,
        "client": case.name or ("Case " + case.case_id),
        "meta": (case.survey.get("governorate") or "Unknown") + " · opened " + _relative_age(case.created_at) + " ago",
        "summary": case.description or "No free-text description was given.",
        "provenance": "Written by the intake agent from the survey and conversation.",
        "facts": [{"name": label, "value": case.survey.get(key) or "Not given"} for key, label in FACT_LABELS],
        "exchanges": case.exchanges,
        "files": case.files,
        "email": case.email,
        "phone": case.phone,
        "records": case.records,
        "stageNames": Case.STAGE_NAMES,
        "fee": case.fee or None,
        "notes": case.notes if mine else "",
        "timeline": case.timeline,
    }


@user_passes_test(is_counsel, login_url="console_login")
def console_case_list(request):
    status = request.GET.get("status", "pending")
    qs = Case.objects.all()
    if status != "all":
        qs = qs.filter(status=status)
    qs = qs.order_by("-created_at")
    counts = {value: Case.objects.filter(status=value).count() for value, _ in Case.STATUS_CHOICES}
    return JsonResponse({"rows": [_case_row(c) for c in qs], "counts": counts})


@user_passes_test(is_counsel, login_url="console_login")
def console_case_detail(request, case_id):
    case = get_object_or_404(Case, case_id=case_id)
    return JsonResponse(_case_detail(case, request.user))


@user_passes_test(is_counsel, login_url="console_login")
@require_POST
def console_case_action(request, case_id):
    case = get_object_or_404(Case, case_id=case_id)
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "invalid JSON body"}, status=400)

    action = payload.get("action")
    user = request.user
    now = timezone.now().isoformat()

    if action == "accept":
        if case.status != Case.STATUS_PENDING:
            return JsonResponse({"error": "this case is no longer pending"}, status=409)
        case.status = Case.STATUS_ONGOING
        case.assigned_to = user
        case.timeline.append({"when": now, "what": f"Taken on by {user.get_username()}."})

    elif action == "decline":
        if case.status == Case.STATUS_PENDING:
            case.timeline.append({"when": now, "what": f"Declined by {user.get_username()}."})
        elif case.status == Case.STATUS_ONGOING and case.assigned_to_id == user.id:
            case.timeline.append({"when": now, "what": f"Handed back by {user.get_username()}."})
        else:
            return JsonResponse({"error": "you cannot decline this case"}, status=403)
        case.status = Case.STATUS_PENDING
        case.assigned_to = None

    elif action == "record_stage":
        if case.status != Case.STATUS_ONGOING or case.assigned_to_id != user.id:
            return JsonResponse({"error": "this case is not yours to record"}, status=403)
        if len(case.records) >= len(Case.STAGE_NAMES):
            return JsonResponse({"error": "every stage is already recorded"}, status=409)
        text = (payload.get("text") or "").strip()
        if not text:
            return JsonResponse({"error": "a note is required"}, status=400)
        stage = len(case.records)
        case.records.append({"stage": stage, "text": text, "file": payload.get("file")})
        case.timeline.append({"when": now, "what": f"Recorded: {Case.STAGE_NAMES[stage]}."})

    elif action == "send_quote":
        if case.status != Case.STATUS_ONGOING or case.assigned_to_id != user.id:
            return JsonResponse({"error": "this case is not yours to quote"}, status=403)
        fee_type = payload.get("type") or "Fixed"
        amount = (payload.get("amount") or "").strip()
        if not amount:
            return JsonResponse({"error": "an amount is required"}, status=400)
        case.fee = {"type": fee_type, "amount": amount, "accepted": False}
        case.timeline.append({"when": now, "what": f"Quote sent: {fee_type} · {amount}."})

    elif action == "complete":
        if case.status != Case.STATUS_ONGOING or case.assigned_to_id != user.id:
            return JsonResponse({"error": "this case is not yours to close"}, status=403)
        if len(case.records) < len(Case.STAGE_NAMES):
            return JsonResponse({"error": "record every stage first"}, status=409)
        case.status = Case.STATUS_REVIEW
        case.timeline.append({"when": now, "what": "Sent for verification."})

    elif action == "withdraw":
        if case.status != Case.STATUS_REVIEW or case.assigned_to_id != user.id:
            return JsonResponse({"error": "this case is not in review for you"}, status=403)
        case.status = Case.STATUS_ONGOING
        case.timeline.append({"when": now, "what": "Pulled back from review."})

    elif action == "reopen":
        if case.status != Case.STATUS_CLOSED:
            return JsonResponse({"error": "this case is not closed"}, status=409)
        case.status = Case.STATUS_ONGOING
        if not case.assigned_to_id:
            case.assigned_to = user
        case.timeline.append({"when": now, "what": f"Reopened by {user.get_username()}."})

    elif action == "save_note":
        if case.assigned_to_id != user.id:
            return JsonResponse({"error": "this case is not yours"}, status=403)
        case.notes = payload.get("note") or ""

    else:
        return JsonResponse({"error": "unknown action"}, status=400)

    case.save()
    return JsonResponse(_case_detail(case, user))


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
            "name": payload.get("name") or "",
            "phone": payload.get("phone") or "",
            "email": payload.get("email") or "",
            "survey": payload.get("survey") or {},
            "description": payload.get("description") or "",
            "transcript": payload.get("transcript") or [],
            "exchanges": payload.get("exchanges") or [],
            "files": payload.get("files") or [],
            "match": payload.get("match") or {},
            "status": Case.STATUS_PENDING,
            "timeline": [{"when": timezone.now().isoformat(), "what": "Intake completed."}],
        },
    )
    return JsonResponse({"ok": True})
