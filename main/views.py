from django.shortcuts import render

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
