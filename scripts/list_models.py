"""List the models your GEMINI_API_KEY can use, with Gemma models first.

Usage (from the project root):
    .\\.venv\\Scripts\\python scripts\\list_models.py
    .\\.venv\\Scripts\\python scripts\\list_models.py --all
"""

import os
import sys

from dotenv import load_dotenv
from google import genai


def main() -> int:
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY is not set. Add it to .env first.")
        return 1

    show_all = "--all" in sys.argv
    client = genai.Client(api_key=api_key)
    gemma, others = [], []
    for m in client.models.list():
        actions = m.supported_actions or []
        if "generateContent" not in actions:
            continue
        name = (m.name or "").removeprefix("models/")
        (gemma if "gemma" in name.lower() else others).append((name, m.display_name or ""))

    print("Gemma models your key can use for generateContent:")
    for name, display in sorted(gemma):
        print(f"  {name:40} {display}")
    if not gemma:
        print("  (none found)")
    if show_all:
        print("\nOther models:")
        for name, display in sorted(others):
            print(f"  {name:40} {display}")
    print("\nPut the one you want in .env as GEMMA_MODEL=<name>")
    return 0


if __name__ == "__main__":
    sys.exit(main())
