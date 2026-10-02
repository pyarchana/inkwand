# inkwand

A free study site for GATE CSE. Every subject in the syllabus is a book on a shelf, and every chapter has short notes, a practice paper and a deck of flashcards.

I built this for students like I was: self-taught, from a small town, no coaching, no money for paid courses, usually on an old laptop with patchy internet. Studying alone for GATE gets lonely. inkwand tries to feel like your own school notebook, with gold stars for right answers and a calendar that shows you showing up every day.

Live site: (add your Render URL here)

## Features

- **The whole GATE 2027 CS syllabus.** 13 books (Discrete Maths, Linear Algebra, Calculus, Probability, Digital Logic, COA, Programming and Data Structures, Algorithms, TOC, Compilers, OS, DBMS, Computer Networks) and 86 chapters, taken from the official syllabus.
- **Notes** for every chapter, written like a senior's notes: a simple explanation, one worked example, common traps, and one line to remember.
- **Practice papers** of 5 GATE-style MCQs. Pick an answer and you get a tick or a cross and a short explanation.
- **Flashcards** you tap to flip, with shuffle.
- **Stickers.** Every right answer earns a sticker (gold star, medal, crown, "Very good!"). Full marks earns a trophy.
- **Study calendar.** Each day you study gets a green tick, and it tracks your streak.
- **Progress.** A chapter is done when you have read the notes, finished the paper and flipped every card. Finished chapters get a green tick, and each book shows a progress bar.
- **Ask about anything.** Each book has a box where you can type any topic and get fresh notes, a paper or flashcards written on the spot.
- **No login, no database.** Stickers, progress and the calendar are saved in your own browser.
- **Light.** Plain HTML, CSS and JavaScript with no build step and no image files. The pre-written library loads instantly, even on a slow connection.

## How it works

The content is written by Gemma, Google's open-weight model, through the Gemini API.

Gemma 4 thinks before it answers, and on the free tier one answer takes one to two minutes. That is too slow to make students wait for every page. So `scripts/build_library.py` writes the whole library once and saves it as JSON files in `data/library/`. The site serves those files, so opening a chapter is instant and costs nothing.

Live writing is still used for the "ask about anything" box and the "write me a fresh paper" buttons. Those take about a minute and the page says so.

Everything the model writes is checked before it is shown. MCQs and flashcards must come back as JSON in the right shape (4 options, one correct index, an explanation, and so on). If the reply does not parse, the server asks once more with a stricter prompt, and if that also fails the student sees a friendly error.

## Project layout

```
app/
  main.py          FastAPI app, serves the API and the static site
  config.py        site name, links, and the syllabus (books and chapters)
  prompts.py       every prompt sent to the model
  llm.py           small wrapper around the google-genai SDK
  content.py       writing content and reading/saving the library
  schemas.py       Pydantic models and JSON parsing
  routes/api.py    API routes
static/            index.html, styles.css, app.js, favicon
data/library/      pre-written chapters, one JSON file per chapter
scripts/
  list_models.py   lists the Gemma models your API key can use
  build_library.py writes the library
tests/             pytest tests (the model is mocked)
render.yaml        Render deploy config
```

## Setup on Windows (PowerShell)

You need Python 3.11 or newer and a free Gemini API key.

1. Get an API key from https://aistudio.google.com/apikey

2. Clone the repo and create a virtual environment:

   ```powershell
   git clone https://github.com/pyarchana/inkwand.git
   cd inkwand
   python -m venv .venv
   .\.venv\Scripts\python -m pip install -r requirements.txt
   ```

3. Create your `.env` file and paste your key into it:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

   `.env` is in `.gitignore`, so your key never gets committed.

4. Check which Gemma models your key can use:

   ```powershell
   .\.venv\Scripts\python scripts\list_models.py
   ```

   Put the one you want in `.env` as `GEMMA_MODEL`. The default is `gemma-4-26b-a4b-it`, which is the faster of the two Gemma 4 models.

## Run locally

```powershell
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000

Run the tests:

```powershell
.\.venv\Scripts\python -m pytest -q
```

### Writing or refreshing the library

The repo already includes the written chapters. To write any that are missing:

```powershell
.\.venv\Scripts\python scripts\build_library.py
```

It skips anything already written, so you can stop it and run it again later. Some handy options:

```powershell
# only one book
.\.venv\Scripts\python scripts\build_library.py --book os
# rewrite one chapter
.\.venv\Scripts\python scripts\build_library.py --book os --chapter deadlock --force
# fewer parallel requests if you hit rate limits
.\.venv\Scripts\python scripts\build_library.py --workers 2
```

To add a subject or chapter, edit `BOOKS` in `app/config.py` and run the script again.

## Deploy on Render

The repo has a `render.yaml`, so Render can set everything up from it.

1. Push the repo to GitHub.
2. In the Render dashboard, click **New**, then **Blueprint**, and pick this repo. Render reads `render.yaml` and creates a web service called `inkwand`.
3. When it asks for environment variables, set:

   | Variable | Value |
   |---|---|
   | `GEMINI_API_KEY` | your Gemini API key (required, keep it secret) |
   | `GEMMA_MODEL` | already set to `gemma-4-26b-a4b-it` by `render.yaml`, change it if you want |
   | `PYTHON_VERSION` | already set to `3.11.9` by `render.yaml` |

4. Deploy. The start command is `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, and Render checks `/api/health` to know the app is up.

The pre-written library is part of the repo, so it works on Render with no extra steps. Only live writing needs the API key.

On the free plan the service sleeps after about 15 minutes with no visitors, and the next visit takes around a minute to wake it. To keep it always on, change `plan: free` to `plan: starter` in `render.yaml`.

## Why open-weight models

- **Free to use.** Gemma costs nothing on the Gemini API free tier, which matters when the whole point is helping students who cannot pay for courses.
- **No vendor lock-in.** The weights are public. If the hosted API changes or goes away, the same model can be run somewhere else, and nothing in this app has to change except `app/llm.py`.
- **It can run fully offline.** Anyone with better hardware than my 8 GB laptop can download Gemma and run it locally with no internet and no API key. A coaching centre or a college lab could host the whole thing for its students.

## A note on accuracy

All notes, questions and flashcards are written by a model. They are usually right, but not always. If something looks off, trust your textbook, and feel free to open an issue so it can be fixed.

## License

MIT, see [LICENSE](LICENSE). Made by Archana.
