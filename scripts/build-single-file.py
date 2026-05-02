#!/usr/bin/env python3
"""Build a standalone HTML file for downloadable releases."""

from pathlib import Path
import os


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"


def main() -> None:
    version = os.environ.get("APP_VERSION", "v2.4").strip() or "v2.4"
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    js = (ROOT / "game.js").read_text(encoding="utf-8")

    html = html.replace(
        '  <link rel="stylesheet" href="styles.css" />',
        f"  <style>\n{css}\n  </style>",
    )
    html = html.replace(
        '  <script src="game.js"></script>',
        f"  <script>\n{js}\n  </script>",
    )

    DIST.mkdir(exist_ok=True)
    output = DIST / f"snake-{version}.html"
    output.write_text(html, encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
