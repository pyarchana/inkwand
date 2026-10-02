import json

import pytest
from pydantic import ValidationError

from app.schemas import GenerateRequest, ParseError, parse_flashcards, parse_mcqs


def make_q(i=0, correct=1):
    return {
        "question": f"Question {i}?",
        "options": ["A", "B", "C", "D"],
        "correct_index": correct,
        "explanation": "Because B.",
    }


def payload(n=5, **overrides):
    qs = [make_q(i) for i in range(n)]
    qs[0].update(overrides)
    return json.dumps({"questions": qs})


def test_parses_clean_json():
    qs = parse_mcqs(payload(), 5)
    assert len(qs) == 5
    assert qs[0].correct_index == 1
    assert qs[0].options == ["A", "B", "C", "D"]


def test_parses_json_inside_code_fence_with_chatter():
    text = "Here is your paper:\n```json\n" + payload() + "\n```\nGood luck!"
    assert len(parse_mcqs(text, 5)) == 5


def test_parses_bare_list():
    text = json.dumps([make_q(i) for i in range(5)])
    assert len(parse_mcqs(text, 5)) == 5


def test_extra_questions_are_trimmed():
    assert len(parse_mcqs(payload(n=7), 5)) == 5


def test_rejects_non_json():
    with pytest.raises(ParseError):
        parse_mcqs("Sorry, I cannot help with that.", 5)


def test_rejects_too_few_questions():
    with pytest.raises(ParseError):
        parse_mcqs(payload(n=4), 5)


@pytest.mark.parametrize(
    "override",
    [
        {"options": ["A", "B", "C"]},
        {"options": ["A", "B", "C", "D", "E"]},
        {"options": ["A", "", "C", "D"]},
        {"correct_index": 4},
        {"correct_index": -1},
        {"explanation": "   "},
        {"question": ""},
    ],
)
def test_rejects_invalid_question(override):
    with pytest.raises(ParseError):
        parse_mcqs(payload(**override), 5)


def test_rejects_missing_field():
    qs = [make_q(i) for i in range(5)]
    del qs[1]["explanation"]
    with pytest.raises(ParseError):
        parse_mcqs(json.dumps({"questions": qs}), 5)


def cards(n):
    return json.dumps({"cards": [{"front": f"F{i}", "back": f"B{i}"} for i in range(n)]})


def test_flashcards_parse_and_trim():
    assert len(parse_flashcards(cards(8), 8)) == 8
    assert len(parse_flashcards(cards(10), 8)) == 8


def test_flashcards_allow_a_slightly_short_deck():
    assert len(parse_flashcards(cards(6), 8)) == 6
    with pytest.raises(ParseError):
        parse_flashcards(cards(5), 8)


def test_flashcards_reject_blank_side():
    bad = json.dumps({"cards": [{"front": "x", "back": " "}] * 8})
    with pytest.raises(ParseError):
        parse_flashcards(bad, 8)


def test_generate_request_needs_chapter_or_topic():
    with pytest.raises(ValidationError):
        GenerateRequest(book="os", kind="notes")
    with pytest.raises(ValidationError):
        GenerateRequest(book="os", kind="quiz", chapter="deadlock")


def test_generate_request_topic_whitespace_is_normalised():
    req = GenerateRequest(book="os", kind="notes", topic="  Banker's \n  algorithm ")
    assert req.topic == "Banker's algorithm"
