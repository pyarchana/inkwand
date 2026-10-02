"""Writing notes, practice papers and flashcards, and the saved library on disk."""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from app import llm, prompts
from app.config import FLASHCARDS_PER_DECK, MCQS_PER_PAPER
from app.schemas import Kind, ParseError, parse_flashcards, parse_mcqs

log = logging.getLogger("inkwand.content")

LIBRARY_DIR = Path(__file__).resolve().parent.parent / "data" / "library"
KINDS: tuple[Kind, ...] = ("notes", "practice", "flashcards")


async def write(kind: Kind, book: str, chapter: str, scope: str):
    """Ask the model for one piece of content and return it validated.

    notes -> str, practice -> list of question dicts, flashcards -> list of card dicts.
    JSON kinds get one retry if the reply does not parse.
    """
    if kind == "notes":
        return await llm.generate(prompts.notes_prompt(book, chapter, scope), temperature=0.5)

    if kind == "practice":
        prompt = prompts.practice_prompt(book, chapter, scope, MCQS_PER_PAPER)
        parse = lambda t: parse_mcqs(t, MCQS_PER_PAPER)  # noqa: E731
    else:
        prompt = prompts.flashcards_prompt(book, chapter, scope, FLASHCARDS_PER_DECK)
        parse = lambda t: parse_flashcards(t, FLASHCARDS_PER_DECK)  # noqa: E731

    for attempt in range(2):
        text = await llm.generate(
            prompt if attempt == 0 else prompt + prompts.RETRY_SUFFIX,
            temperature=0.7 if attempt == 0 else 0.3,
        )
        try:
            return [item.model_dump() for item in parse(text)]
        except ParseError as e:
            log.warning("%s parse failed (attempt %d): %s", kind, attempt + 1, e)
    raise llm.LLMError(
        "The page came out smudged (the model's answer was not in the right shape). "
        "Please try again."
    )


# ---------- saved library ----------

def chapter_path(book_id: str, chapter_id: str) -> Path:
    return LIBRARY_DIR / book_id / f"{chapter_id}.json"


def load_chapter(book_id: str, chapter_id: str) -> dict:
    path = chapter_path(book_id, chapter_id)
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        log.exception("Could not read %s", path)
        return {}


def save_part(book_id: str, chapter_id: str, kind: Kind, value, model: str) -> None:
    path = chapter_path(book_id, chapter_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    data = load_chapter(book_id, chapter_id)
    data[kind] = value
    data.setdefault("meta", {})[kind] = {
        "model": model,
        "written_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)


def available_kinds(book_id: str, chapter_id: str) -> list[str]:
    data = load_chapter(book_id, chapter_id)
    return [k for k in KINDS if data.get(k)]
