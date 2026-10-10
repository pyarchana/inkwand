import json

import pytest
from pydantic import ValidationError

from app.schemas import GenerateRequest, ParseError, parse_flashcards, parse_questions


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
    qs = parse_questions(payload(), 5)
    assert len(qs) == 5
    assert qs[0].correct_index == 1
    assert qs[0].options == ["A", "B", "C", "D"]


def test_parses_json_inside_code_fence_with_chatter():
    text = "Here is your paper:\n```json\n" + payload() + "\n```\nGood luck!"
    assert len(parse_questions(text, 5)) == 5


def test_parses_bare_list():
    text = json.dumps([make_q(i) for i in range(5)])
    assert len(parse_questions(text, 5)) == 5


def test_extra_questions_are_trimmed():
    assert len(parse_questions(payload(n=7), 5)) == 5


def test_rejects_non_json():
    with pytest.raises(ParseError):
        parse_questions("Sorry, I cannot help with that.", 5)


def test_rejects_too_few_questions():
    with pytest.raises(ParseError):
        parse_questions(payload(n=4), 5)


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
        parse_questions(payload(**override), 5)


def test_rejects_missing_field():
    qs = [make_q(i) for i in range(5)]
    del qs[1]["explanation"]
    with pytest.raises(ParseError):
        parse_questions(json.dumps({"questions": qs}), 5)


# ---------- MSQ and NAT ----------

def msq(correct=(0, 2)):
    return {"type": "msq", "question": "Which hold?", "options": ["A", "B", "C", "D"],
            "correct_indices": list(correct), "explanation": "A and C."}


def nat(answer=12):
    return {"type": "nat", "question": "How many?", "answer": answer, "explanation": "Count them."}


MIX = {"mcq": 3, "msq": 1, "nat": 1}


def test_mixed_paper_parses_in_gate_order():
    text = json.dumps({"questions": [nat(), msq(), make_q(0), make_q(1), make_q(2)]})
    qs = parse_questions(text, 5, MIX)
    assert [q.type for q in qs] == ["mcq", "mcq", "mcq", "msq", "nat"]
    assert qs[3].correct_indices == [0, 2]
    assert qs[4].answer == 12 and qs[4].tolerance == 0


def test_question_without_type_is_mcq():
    assert parse_questions(payload(), 5)[0].type == "mcq"
    assert parse_questions(payload(type="MCQ "), 5)[0].type == "mcq"


def test_msq_indices_are_deduplicated_and_sorted():
    text = json.dumps({"questions": [msq(correct=(3, 1, 3))]})
    assert parse_questions(text, 1)[0].correct_indices == [1, 3]


def test_nat_rounded_answers_accept_a_small_range():
    text = json.dumps({"questions": [nat(answer="2.33")]})
    q = parse_questions(text, 1)[0]
    assert q.answer == 2.33 and q.tolerance == 0.01


@pytest.mark.parametrize(
    "bad",
    [
        msq(correct=()),
        msq(correct=(4,)),
        {**msq(), "options": ["A", "B", "C"]},
        nat(answer="about twelve"),
        nat(answer=None),
        {**make_q(), "type": "essay"},
    ],
)
def test_rejects_invalid_msq_and_nat(bad):
    with pytest.raises(ParseError):
        parse_questions(json.dumps({"questions": [bad]}), 1)


def test_mix_needs_every_question_type():
    only_mcqs = json.dumps({"questions": [make_q(i) for i in range(5)]})
    with pytest.raises(ParseError, match="msq, nat"):
        parse_questions(only_mcqs, 5, MIX)


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
