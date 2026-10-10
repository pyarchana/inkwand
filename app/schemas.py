import json
import re
from typing import Annotated, Literal

from pydantic import BaseModel, Field, TypeAdapter, ValidationError, field_validator, model_validator

Kind = Literal["notes", "short", "practice", "flashcards"]


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


class _Question(BaseModel):
    question: str = Field(min_length=1)
    explanation: str = Field(min_length=1)

    @field_validator("question", "explanation")
    @classmethod
    def strip_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v


class _WithOptions(_Question):
    options: list[str] = Field(min_length=4, max_length=4)

    @field_validator("options")
    @classmethod
    def clean_options(cls, v: list[str]) -> list[str]:
        v = [str(o).strip() for o in v]
        if any(not o for o in v):
            raise ValueError("options must not be blank")
        return v


class MCQ(_WithOptions):
    """Exactly one correct option."""

    type: Literal["mcq"] = "mcq"
    correct_index: int = Field(ge=0, le=3)


class MSQ(_WithOptions):
    """One or more correct options. Like GATE, it only counts if you pick all of them."""

    type: Literal["msq"]
    correct_indices: list[Annotated[int, Field(ge=0, le=3)]] = Field(min_length=1, max_length=4)

    @field_validator("correct_indices")
    @classmethod
    def unique_sorted(cls, v: list[int]) -> list[int]:
        return sorted(set(v))


class NAT(_Question):
    """Numerical answer type: no options, the student types a number."""

    type: Literal["nat"]
    answer: float = Field(allow_inf_nan=False)
    tolerance: float = 0

    @model_validator(mode="after")
    def round_off_range(self):
        # Whole numbers must match exactly. Anything else is "rounded off to two
        # decimal places" in the question, so allow 0.01 either way.
        self.tolerance = 0 if self.answer.is_integer() else 0.01
        return self


Question = Annotated[MCQ | MSQ | NAT, Field(discriminator="type")]
_question_adapter = TypeAdapter(Question)
QUESTION_ORDER = {"mcq": 0, "msq": 1, "nat": 2}


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


# Kept for readability at call sites that deal with questions.
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


def _parse_list(text: str, key: str, validate, expected: int, minimum: int):
    data = _extract_json(text)
    items = data.get(key) if isinstance(data, dict) else data
    if not isinstance(items, list):
        raise ParseError(f"JSON has no list of {key}")
    try:
        parsed = [validate(item) for item in items]
    except ValidationError as e:
        raise ParseError(f"{key} failed validation: {e.error_count()} error(s)") from e
    if len(parsed) < minimum:
        raise ParseError(f"Expected {expected} {key}, got {len(parsed)}")
    return parsed[:expected]


def _validate_question(item) -> MCQ | MSQ | NAT:
    # A question without a type is an MCQ (that's all older papers had).
    if isinstance(item, dict):
        item = {**item, "type": str(item.get("type") or "mcq").strip().lower()}
    return _question_adapter.validate_python(item)


def parse_questions(text: str, expected: int, mix: dict[str, int] | None = None) -> list[MCQ | MSQ | NAT]:
    """Parse a practice paper. With a mix, every question type in it must show up."""
    questions = _parse_list(text, "questions", _validate_question, expected, minimum=expected)
    if mix:
        missing = {t for t, n in mix.items() if n} - {q.type for q in questions}
        if missing:
            raise ParseError(f"Paper has no {', '.join(sorted(missing))} questions")
    return sorted(questions, key=lambda q: QUESTION_ORDER[q.type])


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
    return _parse_list(text, "cards", Flashcard.model_validate, expected, minimum=max(1, expected - 2))
