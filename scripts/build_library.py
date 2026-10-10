"""Write the whole library (notes, short notes, practice papers, flashcards) with Gemma.

It skips anything already written, so you can stop it and run it again later.
Practice papers from before MSQ and NAT questions count as not written.

Usage (from the project root):
    .\\.venv\\Scripts\\python scripts\\build_library.py
    .\\.venv\\Scripts\\python scripts\\build_library.py --book os
    .\\.venv\\Scripts\\python scripts\\build_library.py --book os --chapter deadlock --force
    .\\.venv\\Scripts\\python scripts\\build_library.py --workers 2
"""

import argparse
import asyncio
import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from app import content, llm  # noqa: E402
from app.config import BOOKS  # noqa: E402

logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")


def old_paper(book_id, chapter_id):
    """Papers written before MSQ and NAT questions existed get rewritten."""
    paper = content.load_chapter(book_id, chapter_id).get("practice") or []
    return not any(q.get("type") in ("msq", "nat") for q in paper)


def plan_jobs(book_filter, chapter_filter, kinds, force):
    jobs = []
    for book in BOOKS:
        if book_filter and book["id"] != book_filter:
            continue
        for cid, title, scope in book["chapters"]:
            if chapter_filter and cid != chapter_filter:
                continue
            have = set() if force else set(content.available_kinds(book["id"], cid))
            if "practice" in have and old_paper(book["id"], cid):
                have.discard("practice")
            for kind in kinds:
                if kind not in have:
                    jobs.append((book, cid, title, scope, kind))
    return jobs


async def run_job(label, write, save, sem, stats, total):
    """Write one piece with Gemma, retrying temporary errors, then save it."""
    async with sem:
        for attempt in range(4):
            started = time.time()
            try:
                save(await write())
                stats["done"] += 1
                print(f"[{stats['done']}/{total}] ok   {label} ({time.time() - started:.0f}s)", flush=True)
                return
            except llm.LLMError as e:
                wait = 65 if e.status_code == 429 else 10 * (attempt + 1)
                print(f"      retry {label}: {e.message} (waiting {wait}s)", flush=True)
                if e.status_code in (401, 403, 503) and "key" in e.message.lower():
                    raise
                await asyncio.sleep(wait)
        stats["failed"].append(label)
        print(f"      gave up on {label}", flush=True)


def report(stats, started) -> int:
    print(f"\nFinished in {(time.time() - started) / 60:.1f} min: "
          f"{stats['done']} written, {len(stats['failed'])} failed.")
    for f in stats["failed"]:
        print("  failed:", f)
    if stats["failed"]:
        print("Run the script again to retry the failed ones.")
    return 1 if stats["failed"] else 0


def chapter_job(job, sem, stats, total):
    book, cid, title, scope, kind = job
    return run_job(
        f"{book['id']}/{cid} {kind}",
        lambda: content.write(kind, book["title"], title, scope),
        lambda value: content.save_part(book["id"], cid, kind, value, llm.model_id()),
        sem, stats, total,
    )


async def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--book")
    p.add_argument("--chapter")
    p.add_argument("--kind", choices=content.KINDS, action="append")
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--force", action="store_true", help="rewrite even if it exists")
    args = p.parse_args()

    jobs = plan_jobs(args.book, args.chapter, args.kind or list(content.KINDS), args.force)
    if not jobs:
        print("Nothing to write. The library is complete for this selection.")
        return 0
    print(f"Writing {len(jobs)} pieces with {llm.model_id()} using {args.workers} workers...")

    stats = {"done": 0, "failed": []}
    sem = asyncio.Semaphore(args.workers)
    started = time.time()
    await asyncio.gather(*(chapter_job(j, sem, stats, len(jobs)) for j in jobs))
    return report(stats, started)


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
