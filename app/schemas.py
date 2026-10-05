import json
import re
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

Kind = Literal["notes", "practice", "flashcards"]


class GenerateRequest(BaseModel):
    """Ask for fresh content, either for a syllabus chapter or a custom topic."""

    book: str = Field(min_length=1, max_length=40)
    kind: Kind
    chapter: str | None = Field(default=None, max_length=60)
    topic: str | None = Field(default=None, max_length=150)

    @field_validator("topic")
    @classmethod
    def clean_topic(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = " ".join(v.split())
        return v or None

    @model_validator(mode="after")
    def need_chapter_or_topic(self):
        if not self.chapter and not self.topic:
            raise ValueError("Give a chapter or a topic")
        if self.topic is not None and len(self.topic) < 2:
            raise ValueError("Topic is too short")
        return self


class MCQ(BaseModel):
    question: str = Field(min_length=1)
    options: list[str] = Field(min_length=4, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    explanation: str = Field(min_length=1)

    @field_validator("question", "explanation")
    @classmethod
    def strip_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("options")
    @classmethod
    def clean_options(cls, v: list[str]) -> list[str]:
        v = [str(o).strip() for o in v]
        if any(not o for o in v):
            raise ValueError("options must not be blank")
        return v


class Flashcard(BaseModel):
    front: str = Field(min_length=1)
    back: str = Field(min_length=1)

    @field_validator("front", "back")
    @classmethod
    def strip_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v


class ParseError(ValueError):
    pass


# Kept for readability at call sites that deal with MCQs.
MCQParseError = ParseError

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)


def _extract_json(text: str):
    """Pull the JSON value out of a model reply that may have fences or chatter."""
    text = text.strip()
    fenced = _FENCE_RE.search(text)
    if fenced:
        text = fenced.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Fall back to the outermost {...} or [...] block.
    for open_ch, close_ch in (("{", "}"), ("[", "]")):
        start, end = text.find(open_ch), text.rfind(close_ch)
        if start != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                continue
    raise ParseError("Reply was not valid JSON")


def _parse_list(text: str, key: str, model: type[BaseModel], expected: int, minimum: int):
    data = _extract_json(text)
    items = data.get(key) if isinstance(data, dict) else data
    if not isinstance(items, list):
        raise ParseError(f"JSON has no list of {key}")
    try:
        parsed = [model.model_validate(item) for item in items]
    except ValidationError as e:
        raise ParseError(f"{key} failed validation: {e.error_count()} error(s)") from e
    if len(parsed) < minimum:
        raise ParseError(f"Expected {expected} {key}, got {len(parsed)}")
    return parsed[:expected]


def parse_mcqs(text: str, expected: int) -> list[MCQ]:
    return _parse_list(text, "questions", MCQ, expected, minimum=expected)


class SubjectProgress(BaseModel):
    """What the browser knows about one subject. Titles come from the server's config."""

    book: str = Field(min_length=1, max_length=40)
    chapters_done: int = Field(ge=0, le=200)
    progress_pct: int = Field(ge=0, le=100)
    avg_score_pct: int | None = Field(default=None, ge=0, le=100)
    papers: int = Field(default=0, ge=0, le=10_000)


class ReportRequest(BaseModel):
    subjects: list[SubjectProgress] = Field(min_length=1, max_length=40)
    days_studied: int = Field(default=0, ge=0, le=10_000)
    streak: int = Field(default=0, ge=0, le=10_000)
    stickers: int = Field(default=0, ge=0, le=100_000)


class SubjectRemark(BaseModel):
    book: str = Field(min_length=1, max_length=40)
    remark: str = Field(min_length=1, max_length=400)

    @field_validator("remark")
    @classmethod
    def strip_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v


class ReportRemarks(BaseModel):
    overall: str = Field(min_length=1, max_length=600)
    subjects: list[SubjectRemark]


def parse_report(text: str, books: set[str]) -> ReportRemarks:
    data = _extract_json(text)
    try:
        report = ReportRemarks.model_validate(data)
    except ValidationError as e:
        raise ParseError(f"report failed validation: {e.error_count()} error(s)") from e
    report.subjects = [s for s in report.subjects if s.book in books]
    if not report.subjects:
        raise ParseError("report has no remarks for the subjects asked about")
    return report


def parse_flashcards(text: str, expected: int) -> list[Flashcard]:
    # A deck one or two cards short is still useful.
    return _parse_list(text, "cards", Flashcard, expected, minimum=max(1, expected - 2))
