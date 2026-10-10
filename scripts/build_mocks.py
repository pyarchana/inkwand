"""Write the full-length mock tests with Gemma.

Each mock is written in parts (a subject's 1-mark questions, then its 2-mark
ones) and saved as it goes, so you can stop it and run it again later. It only
writes the parts that are missing.

Usage (from the project root):
    .\\.venv\\Scripts\\python scripts\\build_mocks.py
    .\\.venv\\Scripts\\python scripts\\build_mocks.py --mock 2 --workers 2
"""

import argparse
import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from build_library import report, run_job  # noqa: E402

from app import content, llm  # noqa: E402
from app.config import MOCK_COUNT  # noqa: E402


async def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--mock", type=int, choices=range(1, MOCK_COUNT + 1), help="only this mock")
    p.add_argument("--workers", type=int, default=4)
    args = p.parse_args()

    jobs = [(n, part) for n in ([args.mock] if args.mock else range(1, MOCK_COUNT + 1))
            for part in content.missing_mock_parts(n)]
    if not jobs:
        print("Nothing to write. The mock tests are complete.")
        return 0
    print(f"Writing {len(jobs)} mock test parts with {llm.model_id()} using {args.workers} workers...")

    stats = {"done": 0, "failed": []}
    sem = asyncio.Semaphore(args.workers)
    started = time.time()

    def job(n, part):
        return run_job(
            f"mock {n} {part['key']}",
            lambda: content.write_mock_part(part),
            lambda value: content.save_mock_part(n, part["key"], value, llm.model_id()),
            sem, stats, len(jobs),
        )

    await asyncio.gather(*(job(n, part) for n, part in jobs))
    return report(stats, started)


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
