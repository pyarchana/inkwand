import asyncio

from fastapi import APIRouter, HTTPException

from app import content, llm
from app.config import BOOKS_BY_ID, CHAPTERS, public_config
from app.schemas import GenerateRequest, ReportRequest

router = APIRouter(prefix="/api")

# Live writing is slow and the free tier is small, so only a few at once.
_live_slots = asyncio.Semaphore(3)


def _book_or_404(book_id: str) -> dict:
    book = BOOKS_BY_ID.get(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="That book is not on the shelf.")
    return book


def _chapter_or_404(book_id: str, chapter_id: str) -> dict:
    chapter = CHAPTERS.get((book_id, chapter_id))
    if not chapter:
        raise HTTPException(status_code=404, detail="That chapter is not in this book.")
    return chapter


@router.get("/config")
async def get_config() -> dict:
    return public_config()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/library/{book_id}/{chapter_id}")
async def get_chapter(book_id: str, chapter_id: str) -> dict:
    """Pre-written notes, practice paper and flashcards for one chapter."""
    _book_or_404(book_id)
    chapter = _chapter_or_404(book_id, chapter_id)
    data = content.load_chapter(book_id, chapter_id)
    return {
        "book": book_id,
        "chapter": chapter_id,
        "title": chapter["title"],
        **{kind: data.get(kind) for kind in content.KINDS},
    }


@router.post("/report")
async def report(req: ReportRequest) -> dict:
    """Report card remarks from the 'class teacher', written live by Gemma."""
    async with _live_slots:
        try:
            return await content.write_report(req)
        except llm.LLMError as e:
            raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.post("/generate")
async def generate(req: GenerateRequest) -> dict:
    """Write fresh content live. Takes about a minute with Gemma 4."""
    book = _book_or_404(req.book)
    if req.topic:
        title, scope = req.topic, f"{req.topic} (as tested in GATE {book['title']})"
    else:
        chapter = _chapter_or_404(req.book, req.chapter)
        title, scope = chapter["title"], chapter["scope"]

    async with _live_slots:
        try:
            value = await content.write(req.kind, book["title"], title, scope)
        except llm.LLMError as e:
            raise HTTPException(status_code=e.status_code, detail=e.message) from e

    return {"book": book["id"], "kind": req.kind, "title": title, "content": value}
