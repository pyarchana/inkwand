import json

import pytest
from fastapi.testclient import TestClient

from app import content, llm
from app.config import FLASHCARDS_PER_DECK, MCQS_PER_PAPER
from app.main import app

client = TestClient(app)

GOOD_PAPER = json.dumps(
    {
        "questions": [
            {"question": f"Q{i}?", "options": ["a", "b", "c", "d"],
             "correct_index": 2, "explanation": "c is right."}
            for i in range(MCQS_PER_PAPER)
        ]
    }
)
GOOD_CARDS = json.dumps(
    {"cards": [{"front": f"F{i}", "back": f"B{i}"} for i in range(FLASHCARDS_PER_DECK)]}
)


@pytest.fixture(autouse=True)
def temp_library(tmp_path, monkeypatch):
    monkeypatch.setattr(content, "LIBRARY_DIR", tmp_path)
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
    assert len(qs) == MCQS_PER_PAPER
    assert qs[0]["correct_index"] == 2


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
