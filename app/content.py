"""Writing notes, practice papers, flashcards and mock tests, and the saved library on disk."""

import json
import logging
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from app import llm, prompts
from app.config import (
    BOOKS,
    BOOKS_BY_ID,
    FLASHCARDS_PER_DECK,
    MOCK_BLUEPRINT,
    MOCK_COUNT,
    MOCK_MINUTES,
    PAPER_MIX,
    QUESTIONS_PER_PAPER,
)
from app.schemas import (
    QUESTION_ORDER,
    Kind,
    ParseError,
    ReportRequest,
    parse_flashcards,
    parse_questions,
    parse_report,
)

log = logging.getLogger("inkwand.content")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
LIBRARY_DIR = DATA_DIR / "library"
MOCKS_DIR = DATA_DIR / "mocks"
KINDS: tuple[Kind, ...] = ("notes", "short", "practice", "flashcards")


async def write(kind: Kind, book: str, chapter: str, scope: str):
    """Ask the model for one piece of content and return it validated.

    notes and short -> str, practice -> list of question dicts, flashcards -> list of card dicts.
    JSON kinds get one retry if the reply does not parse.
    """
    if kind == "notes":
        return await llm.generate(prompts.notes_prompt(book, chapter, scope), temperature=0.5)
    if kind == "short":
        return await llm.generate(prompts.short_notes_prompt(book, chapter, scope), temperature=0.4)

    if kind == "practice":
        prompt = prompts.practice_prompt(book, chapter, scope, PAPER_MIX)
        parse = lambda t: parse_questions(t, QUESTIONS_PER_PAPER, PAPER_MIX)  # noqa: E731
    else:
        prompt = prompts.flashcards_prompt(book, chapter, scope, FLASHCARDS_PER_DECK)
        parse = lambda t: parse_flashcards(t, FLASHCARDS_PER_DECK)  # noqa: E731
    return await _write_json(prompt, parse, kind)


async def _write_json(prompt: str, parse, what: str) -> list[dict]:
    for attempt in range(2):
        text = await llm.generate(
            prompt if attempt == 0 else prompt + prompts.RETRY_SUFFIX,
            temperature=0.7 if attempt == 0 else 0.3,
        )
        try:
            return [item.model_dump() for item in parse(text)]
        except ParseError as e:
            log.warning("%s parse failed (attempt %d): %s", what, attempt + 1, e)
    raise llm.LLMError(
        "The page came out smudged (the model's answer was not in the right shape). "
        "Please try again."
    )


async def write_report(req: ReportRequest) -> dict:
    """Ask Gemma for report card remarks. Subject titles come from our config, never the client."""
    subjects = [s for s in req.subjects if s.book in BOOKS_BY_ID]
    if not subjects:
        raise llm.LLMError("No studied subjects to write a report about yet.", status_code=422)
    lines = []
    for s in subjects:
        book = BOOKS_BY_ID[s.book]
        score = f"{s.avg_score_pct}% average over {s.papers} practice paper(s)" if s.papers else "no practice papers yet"
        lines.append(
            f"- id={s.book}; subject={book['title']}; chapters fully done {s.chapters_done} of "
            f"{len(book['chapters'])}; overall progress {s.progress_pct}%; {score}"
        )
    lines.append(f"Overall: studied on {req.days_studied} day(s), current streak {req.streak} day(s), {req.stickers} sticker(s) earned.")
    prompt = prompts.report_prompt("\n".join(lines))
    books = {s.book for s in subjects}

    for attempt in range(2):
        text = await llm.generate(
            prompt if attempt == 0 else prompt + prompts.RETRY_SUFFIX,
            temperature=0.6 if attempt == 0 else 0.3,
        )
        try:
            return parse_report(text, books).model_dump()
        except ParseError as e:
            log.warning("report parse failed (attempt %d): %s", attempt + 1, e)
    raise llm.LLMError("The teacher's handwriting came out smudged. Please try again.")


# ---------- files on disk ----------

def _read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        log.exception("Could not read %s", path)
        return {}


def _write_json_file(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)


def _stamp(model: str) -> dict:
    return {"model": model, "written_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}


# ---------- saved library ----------

def chapter_path(book_id: str, chapter_id: str) -> Path:
    return LIBRARY_DIR / book_id / f"{chapter_id}.json"


def load_chapter(book_id: str, chapter_id: str) -> dict:
    return _read_json(chapter_path(book_id, chapter_id))


def save_part(book_id: str, chapter_id: str, kind: Kind, value, model: str) -> None:
    path = chapter_path(book_id, chapter_id)
    data = load_chapter(book_id, chapter_id)
    data[kind] = value
    data.setdefault("meta", {})[kind] = _stamp(model)
    _write_json_file(path, data)


def available_kinds(book_id: str, chapter_id: str) -> list[str]:
    data = load_chapter(book_id, chapter_id)
    return [k for k in KINDS if data.get(k)]


# ---------- mock tests ----------
# A mock is written in parts: each subject's 1-mark questions, then its 2-mark
# ones. Over the 55 questions this pattern gives 30 MCQ, 15 NAT and 10 MSQ.
_TYPE_CYCLE = ("mcq", "nat", "mcq", "msq", "mcq", "nat", "mcq", "mcq", "nat", "msq", "mcq")


def mock_plan(n: int) -> list[dict]:
    """The parts of mock n (counting from 1). Every question slot gets a type and a
    chapter, rotated from mock to mock so no two mocks test the same things."""
    parts = []
    slot = (n - 1) * 4
    for book in BOOKS:
        ones, twos = MOCK_BLUEPRINT[book["id"]]
        chapters = book["chapters"]
        c = (n - 1) * (ones + twos)
        for marks, count in ((1, ones), (2, twos)):
            slots = []
            for _ in range(count):
                _, title, scope = chapters[c % len(chapters)]
                slots.append({"type": _TYPE_CYCLE[slot % len(_TYPE_CYCLE)], "chapter": title, "scope": scope})
                slot += 1
                c += 1
            if slots:
                slots.sort(key=lambda s: QUESTION_ORDER[s["type"]])
                parts.append({"key": f"{book['id']}-{marks}", "book": book, "marks": marks, "slots": slots})
    return parts


async def write_mock_part(part: dict) -> list[dict]:
    slots = part["slots"]
    mix = dict(Counter(s["type"] for s in slots))
    prompt = prompts.mock_prompt(part["book"]["title"], part["marks"], slots)
    questions = await _write_json(prompt, lambda t: parse_questions(t, len(slots), mix), "mock")
    return [{**q, "book": part["book"]["id"], "marks": part["marks"]} for q in questions]


def mock_path(n: int) -> Path:
    return MOCKS_DIR / f"mock-{n}.json"


def save_mock_part(n: int, key: str, questions: list[dict], model: str) -> None:
    path = mock_path(n)
    data = _read_json(path)
    data.setdefault("parts", {})[key] = questions
    data.setdefault("meta", {})[key] = _stamp(model)
    _write_json_file(path, data)


def missing_mock_parts(n: int) -> list[dict]:
    have = _read_json(mock_path(n)).get("parts", {})
    return [p for p in mock_plan(n) if p["key"] not in have]


def load_mock(n: int) -> dict | None:
    """A whole mock in paper order, or None if it isn't fully written yet."""
    if not 1 <= n <= MOCK_COUNT:
        return None
    parts = _read_json(mock_path(n)).get("parts", {})
    plan = mock_plan(n)
    if any(p["key"] not in parts for p in plan):
        return None
    questions = [q for p in plan for q in parts[p["key"]]]
    return {
        "id": n,
        "title": f"Mock test {n}",
        "minutes": MOCK_MINUTES,
        "marks": sum(q["marks"] for q in questions),
        "questions": questions,
    }


def list_mocks() -> list[dict]:
    mocks = []
    for n in range(1, MOCK_COUNT + 1):
        mock = load_mock(n)
        if mock:
            mocks.append({**{k: mock[k] for k in ("id", "title", "minutes", "marks")}, "questions": len(mock["questions"])})
    return mocks
