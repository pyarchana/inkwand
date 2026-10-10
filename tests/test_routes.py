import asyncio
import json
from collections import Counter

import pytest
from fastapi.testclient import TestClient

from app import content, llm
from app.config import FLASHCARDS_PER_DECK, MOCK_COUNT, MOCK_MINUTES, PAPER_MIX, QUESTIONS_PER_PAPER
from app.main import app

client = TestClient(app)


def _paper_question(kind, i):
    q = {"type": kind, "question": f"Q{i}?", "explanation": "Worked out."}
    if kind == "nat":
        return {**q, "answer": 12}
    q["options"] = ["a", "b", "c", "d"]
    return {**q, "correct_indices": [0, 2]} if kind == "msq" else {**q, "correct_index": 2}


# Written NAT first to check the paper comes back in GATE order (MCQ, MSQ, NAT).
GOOD_PAPER = json.dumps(
    {
        "questions": [
            _paper_question(kind, i)
            for i, kind in enumerate(k for k in reversed(PAPER_MIX) for _ in range(PAPER_MIX[k]))
        ]
    }
)
GOOD_CARDS = json.dumps(
    {"cards": [{"front": f"F{i}", "back": f"B{i}"} for i in range(FLASHCARDS_PER_DECK)]}
)


@pytest.fixture(autouse=True)
def temp_library(tmp_path, monkeypatch):
    monkeypatch.setattr(content, "LIBRARY_DIR", tmp_path)
    monkeypatch.setattr(content, "MOCKS_DIR", tmp_path / "mocks")
    return tmp_path


def fake_llm(monkeypatch, replies):
    """Make llm.generate return each reply in turn (or raise it if it's an exception)."""
    calls = []
    replies = list(replies)

    async def fake_generate(prompt, **kwargs):
        calls.append(prompt)
        reply = replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr(llm, "generate", fake_generate)
    return calls


def test_index_and_config():
    assert client.get("/").status_code == 200
    cfg = client.get("/api/config").json()
    assert cfg["site_name"] == "inkwand"
    assert len(cfg["books"]) == 13
    assert all(b["chapters"] for b in cfg["books"])


def test_library_chapter_empty_then_saved():
    r = client.get("/api/library/os/deadlock")
    assert r.status_code == 200
    assert r.json()["notes"] is None

    content.save_part("os", "deadlock", "notes", "Deadlock notes.", "test-model")
    data = client.get("/api/library/os/deadlock").json()
    assert data["notes"] == "Deadlock notes."
    assert data["title"] == "Deadlock"
    assert data["practice"] is None


def test_library_unknown_book_and_chapter():
    assert client.get("/api/library/nope/deadlock").status_code == 404
    assert client.get("/api/library/os/nope").status_code == 404


def test_generate_notes_for_chapter(monkeypatch):
    calls = fake_llm(monkeypatch, ["Simple notes.\n\nRemember this: it works."])
    r = client.post("/api/generate", json={"book": "toc", "chapter": "pumping-lemma", "kind": "notes"})
    assert r.status_code == 200
    assert r.json()["content"].endswith("Remember this: it works.")
    assert "Theory of Computation" in calls[0]
    assert "Pumping Lemma" in calls[0]


def test_generate_for_custom_topic(monkeypatch):
    calls = fake_llm(monkeypatch, [GOOD_CARDS])
    r = client.post("/api/generate", json={"book": "dbms", "topic": "Armstrong's axioms", "kind": "flashcards"})
    assert r.status_code == 200
    assert len(r.json()["content"]) == FLASHCARDS_PER_DECK
    assert "Armstrong's axioms" in calls[0]


def test_generate_practice_ok(monkeypatch):
    fake_llm(monkeypatch, [GOOD_PAPER])
    r = client.post("/api/generate", json={"book": "os", "chapter": "deadlock", "kind": "practice"})
    assert r.status_code == 200
    qs = r.json()["content"]
    assert len(qs) == QUESTIONS_PER_PAPER
    assert [q["type"] for q in qs] == [k for k in PAPER_MIX for _ in range(PAPER_MIX[k])]
    assert qs[0]["correct_index"] == 2
    assert qs[-1]["answer"] == 12 and qs[-1]["tolerance"] == 0


def test_generate_practice_retries_once_then_succeeds(monkeypatch):
    calls = fake_llm(monkeypatch, ["not json at all", GOOD_PAPER])
    r = client.post("/api/generate", json={"book": "dbms", "chapter": "sql", "kind": "practice"})
    assert r.status_code == 200
    assert len(calls) == 2
    assert "could not be parsed" in calls[1]


def test_generate_practice_fails_after_retry(monkeypatch):
    calls = fake_llm(monkeypatch, ["nope", '{"questions": []}'])
    r = client.post("/api/generate", json={"book": "dbms", "chapter": "sql", "kind": "practice"})
    assert r.status_code == 502
    assert len(calls) == 2
    assert "smudged" in r.json()["detail"]


def test_generate_rate_limited(monkeypatch):
    fake_llm(monkeypatch, [llm.LLMError("Too many requests.", status_code=429)])
    r = client.post("/api/generate", json={"book": "os", "chapter": "threads", "kind": "notes"})
    assert r.status_code == 429
    assert r.json()["detail"] == "Too many requests."


def test_generate_bad_input_gives_friendly_message():
    r = client.post("/api/generate", json={"book": "os", "kind": "notes"})
    assert r.status_code == 422
    assert "chapter" in r.json()["detail"]


def test_generate_unknown_chapter(monkeypatch):
    fake_llm(monkeypatch, [])
    r = client.post("/api/generate", json={"book": "os", "chapter": "nope", "kind": "notes"})
    assert r.status_code == 404


def test_missing_api_key_gives_clear_error(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(llm, "_client", None)
    r = client.post("/api/generate", json={"book": "os", "chapter": "threads", "kind": "notes"})
    assert r.status_code == 503
    assert "GEMINI_API_KEY" in r.json()["detail"]


def test_pages_are_revalidated_not_cached_stale():
    for path in ("/", "/static/styles.css", "/static/app.js"):
        r = client.get(path)
        assert r.status_code == 200
        assert r.headers["cache-control"] == "no-cache"
    # unchanged files come back as a cheap 304
    etag = client.get("/static/styles.css").headers["etag"]
    assert client.get("/static/styles.css", headers={"If-None-Match": etag}).status_code == 304


def test_falls_back_to_second_model_on_server_error(monkeypatch):
    import asyncio
    from google.genai import errors

    calls = []

    async def fake_ask(client, model, prompt, temperature, max_tokens):
        calls.append(model)
        if len(calls) == 1:
            raise errors.ServerError(500, {"error": {"code": 500, "message": "Internal", "status": "INTERNAL"}})

        class R:
            text = "Notes from the backup model."
            candidates = []
        return R()

    monkeypatch.setenv("GEMINI_API_KEY", "test")
    monkeypatch.setenv("GEMMA_MODEL", "main-model")
    monkeypatch.setenv("GEMMA_FALLBACK_MODEL", "backup-model")
    monkeypatch.setattr(llm, "_client", object())
    monkeypatch.setattr(llm, "_ask", fake_ask)
    assert asyncio.run(llm.generate("hi")) == "Notes from the backup model."
    assert calls == ["main-model", "backup-model"]


def test_no_fallback_for_client_errors(monkeypatch):
    import asyncio
    from google.genai import errors

    calls = []

    async def fake_ask(client, model, prompt, temperature, max_tokens):
        calls.append(model)
        raise errors.ClientError(429, {"error": {"code": 429, "message": "slow down", "status": "RESOURCE_EXHAUSTED"}})

    monkeypatch.setenv("GEMMA_MODEL", "main-model")
    monkeypatch.setattr(llm, "_client", object())
    monkeypatch.setattr(llm, "_ask", fake_ask)
    with pytest.raises(llm.LLMError) as e:
        asyncio.run(llm.generate("hi"))
    assert e.value.status_code == 429
    assert calls == ["main-model"]


REPORT_REQ = {
    "subjects": [
        {"book": "os", "chapters_done": 2, "progress_pct": 30, "avg_score_pct": 80, "papers": 2},
        {"book": "dbms", "chapters_done": 0, "progress_pct": 5, "avg_score_pct": None, "papers": 0},
        {"book": "not-a-book", "chapters_done": 1, "progress_pct": 50},
    ],
    "days_studied": 4, "streak": 3, "stickers": 9,
}
GOOD_REPORT = json.dumps({
    "overall": "Steady work, keep the streak going.",
    "subjects": [
        {"book": "os", "remark": "Great scores in OS."},
        {"book": "dbms", "remark": "Try one DBMS paper this week."},
        {"book": "made-up", "remark": "Should be dropped."},
    ],
})


def test_report_ok(monkeypatch):
    calls = fake_llm(monkeypatch, [GOOD_REPORT])
    r = client.post("/api/report", json=REPORT_REQ)
    assert r.status_code == 200
    data = r.json()
    assert data["overall"].startswith("Steady")
    assert [s["book"] for s in data["subjects"]] == ["os", "dbms"]   # unknown book dropped
    # titles come from our config, and unknown books never reach the prompt
    assert "Operating Systems" in calls[0] and "not-a-book" not in calls[0]


def test_report_retries_once_then_fails(monkeypatch):
    calls = fake_llm(monkeypatch, ["nope", '{"overall": "x", "subjects": []}'])
    r = client.post("/api/report", json=REPORT_REQ)
    assert r.status_code == 502
    assert len(calls) == 2


def test_report_needs_a_known_subject(monkeypatch):
    fake_llm(monkeypatch, [])
    r = client.post("/api/report", json={"subjects": [{"book": "nope", "chapters_done": 0, "progress_pct": 1}]})
    assert r.status_code == 422


def test_service_worker_served_from_root():
    r = client.get("/sw.js")
    assert r.status_code == 200
    assert "javascript" in r.headers["content-type"]
    assert r.headers["cache-control"] == "no-cache"
    assert "const CACHE = \"inkwand-v" in r.text


def test_generate_short_notes(monkeypatch):
    calls = fake_llm(monkeypatch, ["Must know:\n- Four conditions."])
    r = client.post("/api/generate", json={"book": "os", "chapter": "deadlock", "kind": "short"})
    assert r.status_code == 200
    assert r.json()["content"].startswith("Must know:")
    assert "last month before GATE" in calls[0]


# ---------- mock tests ----------

def _mock_part_questions(part):
    return [{**_paper_question(s["type"], i), "marks": part["marks"], "book": part["book"]["id"]}
            for i, s in enumerate(part["slots"])]


def test_every_mock_matches_the_gate_cs_section():
    for n in range(1, MOCK_COUNT + 1):
        slots = [(p["marks"], s["type"]) for p in content.mock_plan(n) for s in p["slots"]]
        assert len(slots) == 55
        assert sum(m for m, _ in slots) == 85
        assert Counter(m for m, _ in slots) == {1: 25, 2: 30}
        assert Counter(t for _, t in slots) == {"mcq": 30, "nat": 15, "msq": 10}


def test_mocks_rotate_chapters():
    first, second = content.mock_plan(1), content.mock_plan(2)
    assert [s["chapter"] for p in first for s in p["slots"]] != [s["chapter"] for p in second for s in p["slots"]]


def test_write_mock_part_tags_marks_and_subject(monkeypatch):
    part = next(p for p in content.mock_plan(1) if p["marks"] == 2 and len(p["slots"]) >= 3)
    reply = json.dumps({"questions": [_paper_question(s["type"], i) for i, s in enumerate(part["slots"])]})
    calls = fake_llm(monkeypatch, [reply])
    qs = asyncio.run(content.write_mock_part(part))
    assert len(qs) == len(part["slots"])
    assert {q["marks"] for q in qs} == {2}
    assert {q["book"] for q in qs} == {part["book"]["id"]}
    assert "carries 2 marks" in calls[0]
    assert part["slots"][0]["chapter"] in calls[0]


def test_mock_is_listed_only_once_complete():
    assert client.get("/api/mocks").json() == {"mocks": []}
    assert client.get("/api/mocks/1").status_code == 404

    plan = content.mock_plan(1)
    for part in plan[:-1]:
        content.save_mock_part(1, part["key"], _mock_part_questions(part), "test-model")
    assert client.get("/api/mocks").json() == {"mocks": []}
    assert [p["key"] for p in content.missing_mock_parts(1)] == [plan[-1]["key"]]

    content.save_mock_part(1, plan[-1]["key"], _mock_part_questions(plan[-1]), "test-model")
    assert client.get("/api/mocks").json() == {
        "mocks": [{"id": 1, "title": "Mock test 1", "minutes": MOCK_MINUTES, "marks": 85, "questions": 55}]
    }
    mock = client.get("/api/mocks/1").json()
    assert len(mock["questions"]) == 55
    assert mock["questions"][0]["book"] == "discrete-math"
    assert client.get(f"/api/mocks/{MOCK_COUNT + 1}").status_code == 404
