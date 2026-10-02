"""Write the whole library (notes, practice papers, flashcards) with Gemma.

It skips anything already written, so you can stop it and run it again later.

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


def plan_jobs(book_filter, chapter_filter, kinds, force):
    jobs = []
    for book in BOOKS:
        if book_filter and book["id"] != book_filter:
            continue
        for cid, title, scope in book["chapters"]:
            if chapter_filter and cid != chapter_filter:
                continue
            have = set() if force else set(content.available_kinds(book["id"], cid))
            for kind in kinds:
                if kind not in have:
                    jobs.append((book, cid, title, scope, kind))
    return jobs


async def run_job(job, sem, stats, total):
    book, cid, title, scope, kind = job
    async with sem:
        for attempt in range(4):
            started = time.time()
            try:
                value = await content.write(kind, book["title"], title, scope)
                content.save_part(book["id"], cid, kind, value, llm.model_id())
                stats["done"] += 1
                print(f"[{stats['done']}/{total}] ok   {book['id']}/{cid} {kind} "
                      f"({time.time() - started:.0f}s)", flush=True)
                return
            except llm.LLMError as e:
                wait = 65 if e.status_code == 429 else 10 * (attempt + 1)
                print(f"      retry {book['id']}/{cid} {kind}: {e.message} "
                      f"(waiting {wait}s)", flush=True)
                if e.status_code in (401, 403, 503) and "key" in e.message.lower():
                    raise
                await asyncio.sleep(wait)
        stats["failed"].append(f"{book['id']}/{cid} {kind}")
        print(f"      gave up on {book['id']}/{cid} {kind}", flush=True)


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
    await asyncio.gather(*(run_job(j, sem, stats, len(jobs)) for j in jobs))

    print(f"\nFinished in {(time.time() - started) / 60:.1f} min: "
          f"{stats['done']} written, {len(stats['failed'])} failed.")
    for f in stats["failed"]:
        print("  failed:", f)
    if stats["failed"]:
        print("Run the script again to retry the failed ones.")
    return 1 if stats["failed"] else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
