import json

import requests
from django.conf import settings

AI_ENDPOINT = "https://ai.hackclub.com/proxy/v1/chat/completions"
AI_MODEL = "google/gemini-3.8-flash"
CDN_ENDPOINT = "https://cdn.hackclub.com/api/v4/upload"

MAX_TURNS = 6

SYSTEM_PROMPT = """You are Qanouny's intake assistant, gathering facts about a legal matter in Egypt before the case is handed to a specialist lawyer. You are not a lawyer and must never give legal advice or opinions on the merits of the matter.

Known from an earlier multiple-choice survey:
{survey_summary}

Free-text description the user gave at the start:
{description}

Conversation so far:
{transcript}

You are about to ask question {turn_number} of at most {max_turns}.

Decide the single next thing to ask, or whether you already have enough to hand this off. Ask about ONE thing per turn, in plain, warm, direct language with no legal jargon. Never repeat a question that has already been answered or skipped. Only ask for a file upload when a real document would help (a contract, notice, or ID) and do this at most once or twice in the whole conversation. Conclude (done: true) once you have a clear picture of what happened, who is involved, and any documents worth having, and always conclude by question {max_turns} at the latest. Never invent or promise a specific lawyer, fee, or timeline.

Respond with ONLY a JSON object and no other text, matching exactly one of these shapes:
{{"done": false, "message": "<next question>", "prompt": {{"type": "text", "placeholder": "<short placeholder>", "rows": <int 2-8>, "skippable": <bool>}}}}
{{"done": false, "message": "<question asking for a document>", "prompt": {{"type": "file", "hint": "<short hint about accepted file types>", "accept": "<comma separated extensions, e.g. .pdf,.jpg,.png>", "skippable": <bool>}}}}
{{"done": true, "message": "<short closing statement>"}}
"""

FALLBACK_QUESTION = {
    "done": False,
    "message": "Could you tell me a bit more about what happened?",
    "prompt": {"type": "text", "placeholder": "Type your answer", "rows": 4, "skippable": True},
}

FALLBACK_CLOSING_MESSAGE = "Thanks — I think I have a clear enough picture to bring in a specialist."

DEADLINE_ETA = {
    "Yes, within a week": "within one business day",
    "Yes, within a month": "within two business days",
}
DEFAULT_ETA = "within one business day"


def _format_survey(survey):
    if not survey:
        return "(nothing on file)"
    return "\n".join(f"- {key}: {value}" for key, value in survey.items() if value)


def _format_transcript(transcript):
    if not transcript:
        return "(nothing yet, this is the first question)"
    lines = []
    for turn in transcript:
        speaker = "Agent" if turn.get("role") == "agent" else "User"
        lines.append(f"{speaker}: {turn.get('text', '')}")
    return "\n".join(lines)


def _agent_turn_count(transcript):
    return sum(1 for turn in transcript if turn.get("role") == "agent")


def _extract_json(content):
    content = content.strip()
    if content.startswith("```"):
        content = content.strip("`")
        if content.startswith("json"):
            content = content[4:]
    start, end = content.find("{"), content.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object found in model output")
    return json.loads(content[start:end + 1])


def _validate_turn(data):
    if not isinstance(data, dict) or "message" not in data or not str(data["message"]).strip():
        raise ValueError("missing message")
    if data.get("done"):
        return {"done": True, "message": str(data["message"])}
    prompt = data.get("prompt") or {}
    prompt_type = prompt.get("type")
    if prompt_type == "file":
        return {
            "done": False,
            "message": str(data["message"]),
            "prompt": {
                "type": "file",
                "hint": str(prompt.get("hint", "")),
                "accept": str(prompt.get("accept", "")),
                "skippable": bool(prompt.get("skippable", True)),
            },
        }
    rows = prompt.get("rows", 4)
    rows = rows if isinstance(rows, int) and 2 <= rows <= 8 else 4
    return {
        "done": False,
        "message": str(data["message"]),
        "prompt": {
            "type": "text",
            "placeholder": str(prompt.get("placeholder", "Type your answer")),
            "rows": rows,
            "skippable": bool(prompt.get("skippable", True)),
        },
    }


def _call_ai(messages):
    response = requests.post(
        AI_ENDPOINT,
        headers={
            "Authorization": f"Bearer {settings.HC_AI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={"model": AI_MODEL, "messages": messages, "temperature": 0.6},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def get_next_turn(survey, description, transcript):
    turn_number = _agent_turn_count(transcript) + 1
    if turn_number > MAX_TURNS:
        return {"done": True, "message": FALLBACK_CLOSING_MESSAGE}

    prompt = SYSTEM_PROMPT.format(
        survey_summary=_format_survey(survey),
        description=description or "(nothing given)",
        transcript=_format_transcript(transcript),
        turn_number=turn_number,
        max_turns=MAX_TURNS,
    )
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Produce the next JSON response now."},
    ]

    for attempt in range(2):
        try:
            content = _call_ai(messages)
            return _validate_turn(_extract_json(content))
        except Exception:
            messages.append({
                "role": "user",
                "content": "That was not a single valid JSON object. Respond again with ONLY the JSON object.",
            })
            continue

    return FALLBACK_QUESTION if turn_number < MAX_TURNS else {"done": True, "message": FALLBACK_CLOSING_MESSAGE}


def build_match(survey):
    governorate = survey.get("governorate") or "your area"
    eta = DEADLINE_ETA.get(survey.get("deadline"), DEFAULT_ETA)
    return {"area": survey.get("area"), "governorate": governorate, "eta": eta}


def upload_file(django_file):
    response = requests.post(
        CDN_ENDPOINT,
        headers={"Authorization": f"Bearer {settings.HC_CDN_API_KEY}"},
        files={"file": (django_file.name, django_file, django_file.content_type)},
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return {
        "name": data["filename"],
        "size": data["size"],
        "mime": data["content_type"],
        "url": data["url"],
    }
