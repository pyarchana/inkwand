"""All prompts sent to the model live here.

Gemma on the Gemini API does not accept a separate system instruction,
so the voice is written into each prompt.
"""

VOICE = (
    "You write study material for inkwand, a free GATE CSE prep site for "
    "self-taught students who cannot afford coaching. Write like a friendly senior "
    "who cleared GATE and is sharing their own notes: simple English, encouraging, "
    "never condescending. Being correct matters more than anything else. "
    "Think briefly, then answer."
)

FORMAT_RULES = (
    "Formatting: plain text only. You may use **bold** for key terms, `backticks` for "
    "code or symbols, and lines starting with '- ' for bullet points. No headings with #, "
    "no tables, no LaTeX. Write maths in plain text, like O(n log n), a^2, x_1, sqrt(n)."
)


def _where(book: str, chapter: str, scope: str) -> str:
    return f'Subject: {book}\nTopic: {chapter}\nGATE syllabus scope: {scope}'


def notes_prompt(book: str, chapter: str, scope: str) -> str:
    return f"""{VOICE}

Write short revision notes on this GATE CSE topic.
{_where(book, chapter, scope)}

Structure:
1. The core idea, explained simply (2 to 4 short paragraphs or bullet lists).
2. A line "Example:" followed by one small GATE-style worked example, solved step by step.
3. A line "Common traps:" followed by 1 or 2 bullet points on mistakes students make.
4. A final line that starts exactly with "Remember this:" followed by a one-line summary.

Keep it under 320 words.
{FORMAT_RULES}
If the topic does not belong to the subject, gently say so and cover the closest GATE topic instead.
"""


def short_notes_prompt(book: str, chapter: str, scope: str) -> str:
    return f"""{VOICE}

Write the short notes a student reads in the last month before GATE: a one-glance revision
sheet for this topic, with only what is worth remembering on exam day.
{_where(book, chapter, scope)}

Use exactly these three labelled parts, each a list of bullet points starting with '- ':
Must know: 4 to 6 key facts, definitions or results.
Formulas and rules: the formulas, standard results and quick rules GATE questions use.
Watch out: 2 or 3 traps that cost students marks.

Every bullet fits on one line (at most 20 words). No examples, no paragraphs, no intro or
closing line. Keep it under 180 words.
{FORMAT_RULES}
"""


QUESTION_TYPES = """The three question types of the real GATE paper:
- "mcq": exactly 4 options and exactly one correct option. "correct_index" is the 0-based
  index of the correct option (0, 1, 2 or 3).
- "msq": exactly 4 options, one or more of them correct (usually two or three).
  "correct_indices" lists the 0-based index of every correct option. A student only gets it
  right by picking all of them and nothing else, so each option must be clearly right or wrong.
- "nat": no options. The answer is one number the student types in. Give it as "answer", a
  JSON number with no units (put any units in the question). If the answer is not a whole
  number, end the question with "(Round off to two decimal places.)" and give the answer
  rounded to two decimal places."""

QUESTION_STYLE = """Do not put letters like "A)" in front of options. Keep each explanation to 1 to 3
sentences, and for a NAT question show the short working.
Double check every answer before you write it."""

QUESTIONS_JSON = """Return ONLY valid JSON, with no text before or after it and no markdown code fences.
Use exactly this shape:
{
  "questions": [
    {
      "type": "mcq",
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correct_index": 0,
      "explanation": "string"
    },
    {
      "type": "msq",
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correct_indices": [0, 2],
      "explanation": "string"
    },
    {
      "type": "nat",
      "question": "string",
      "answer": 12,
      "explanation": "string"
    }
  ]
}"""


def practice_prompt(book: str, chapter: str, scope: str, mix: dict[str, int]) -> str:
    total = sum(mix.values())
    return f"""{VOICE}

Write a GATE CSE practice paper of {total} questions: {mix["mcq"]} MCQ, {mix["msq"]} MSQ and
{mix["nat"]} NAT, in that order.
{_where(book, chapter, scope)}

{QUESTION_TYPES}

Mix concept checks with small numerical or tracing problems, like real GATE questions.
{QUESTION_STYLE}
{FORMAT_RULES}

{QUESTIONS_JSON}
"""


def mock_prompt(book: str, marks: int, slots: list[dict]) -> str:
    plan = "\n".join(
        f"{i}. {s['type'].upper()} on {s['chapter']} ({s['scope']})" for i, s in enumerate(slots, 1)
    )
    weight = (
        "a quick concept check or a one-step problem"
        if marks == 1
        else "a multi-step problem that takes two to four minutes, like a real 2-mark question"
    )
    return f"""{VOICE}

Write {len(slots)} questions for a full-length GATE CSE mock test.
Subject: {book}
Every question here carries {marks} mark{"s" if marks > 1 else ""}, so each one is {weight}.
Write exactly these questions, in this order:
{plan}

{QUESTION_TYPES}

Make them as close as you can to real GATE questions in style and difficulty.
{QUESTION_STYLE}
{FORMAT_RULES}

{QUESTIONS_JSON}
"""


def flashcards_prompt(book: str, chapter: str, scope: str, count: int) -> str:
    return f"""{VOICE}

Write {count} revision flashcards.
{_where(book, chapter, scope)}

The front is a short question, term or formula prompt (at most 15 words).
The back is a crisp answer a student can memorise (at most 40 words).
Cover the facts, formulas and definitions most often tested in GATE.
{FORMAT_RULES}

Return ONLY valid JSON, with no text before or after it and no markdown code fences.
Use exactly this shape:
{{
  "cards": [
    {{"front": "string", "back": "string"}}
  ]
}}
"""


def report_prompt(progress: str) -> str:
    return f"""You are the class teacher writing remarks on a student's report card for their
GATE CSE preparation on inkwand, a free study notebook. Be warm, honest and specific, like a
teacher who believes in the student. Mention their actual numbers. Praise real progress, and
for weak or barely started subjects, give one small, concrete next step. Never be harsh.

The student's progress (one line per subject they have started, then their overall habits):
{progress}

Write one remark per subject listed, at most 25 words each, and one overall remark of at most
40 words. Plain text only inside the strings, no markdown, no emojis.

Return ONLY valid JSON, with no text before or after it and no markdown code fences.
Use exactly this shape, with "book" copied exactly from the subject's id:
{{
  "overall": "string",
  "subjects": [
    {{"book": "string", "remark": "string"}}
  ]
}}
"""


RETRY_SUFFIX = """
Your previous reply could not be parsed. Reply again with ONLY the JSON object,
exactly in the shape described above, and nothing else.
"""
