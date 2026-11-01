"""Serve the deck preview page for a deck folder anywhere on disk.

Usage: uv run scripts/serve_preview.py <deck dir> [port]
Then open http://localhost:<port>/ — the page is preview/index.html, the deck is under /deck/.
"""

import functools
import http.server
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, deck: Path, **kwargs):
        self.deck = deck
        super().__init__(*args, directory=str(ROOT / "preview"), **kwargs)

    def translate_path(self, path: str) -> str:
        path = path.split("?", 1)[0]
        if path.startswith("/deck/"):
            target = (self.deck / path.removeprefix("/deck/")).resolve()
            if target.is_relative_to(self.deck):
                return str(target)
            return str(self.deck / "__forbidden__")
        return super().translate_path(path)


def main() -> None:
    deck = Path(sys.argv[1]).resolve()
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
    handler = functools.partial(Handler, deck=deck)
    print(f"http://localhost:{port}/  ({deck})")
    http.server.ThreadingHTTPServer(("localhost", port), handler).serve_forever()


if __name__ == "__main__":
    main()
