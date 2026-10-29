#!/usr/bin/env python3
"""Local game server. Scans assets/pictures so new stage folders drop in cleanly."""

from __future__ import annotations

import json
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent
PICTURES = ROOT / "assets" / "pictures"
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
AUDIO_EXTS = {".mp3", ".wav", ".ogg", ".m4a"}


def posix(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def collect_puzzles() -> dict:
    stages = []
    if PICTURES.exists():
        stage_dirs = sorted(
            [p for p in PICTURES.iterdir() if p.is_dir()],
            key=lambda p: (
                int(re.search(r"\d+", p.name).group()) if re.search(r"\d+", p.name) else 10**9,
                p.name,
            ),
        )
        for stage_dir in stage_dirs:
            puzzles_map: dict[str, dict] = {}
            for item in sorted(stage_dir.iterdir(), key=lambda p: p.name):
                if item.name.startswith("."):
                    continue
                if item.is_dir():
                    word = item.name
                    images = [
                        posix(f)
                        for f in sorted(item.iterdir())
                        if f.is_file() and f.suffix.lower() in IMAGE_EXTS
                    ][:4]
                    audios = [
                        posix(f)
                        for f in sorted(item.iterdir())
                        if f.is_file() and f.suffix.lower() in AUDIO_EXTS
                    ]
                    if images:
                        puzzles_map.setdefault(word, {"word": word, "images": [], "audio": None})
                        puzzles_map[word]["images"] = images[:4]
                        if audios:
                            puzzles_map[word]["audio"] = audios[0]
                    continue

                stem = item.stem
                ext = item.suffix.lower()
                bucket = puzzles_map.setdefault(
                    stem, {"word": stem, "images": [], "audio": None}
                )
                rel = posix(item)
                if ext in IMAGE_EXTS and rel not in bucket["images"] and len(bucket["images"]) < 4:
                    bucket["images"].append(rel)
                elif ext in AUDIO_EXTS and not bucket["audio"]:
                    bucket["audio"] = rel

            puzzles = [p for p in puzzles_map.values() if p["images"]]
            stages.append(
                {
                    "id": stage_dir.name,
                    "label": stage_dir.name.replace("stage", "منزل "),
                    "puzzles": puzzles,
                }
            )
    return {"stages": stages}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = unquote(self.path.split("?", 1)[0])
        if path in ("/api/puzzles", "/data/puzzles.json"):
            payload = json.dumps(collect_puzzles(), ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        return super().do_GET()

    def log_message(self, format, *args):
        print("[%s] %s" % (self.log_date_time_string(), format % args))


def main():
    port = 8765
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Game running at http://127.0.0.1:{port}/")
    print("Replace pictures in assets/pictures/stageN and refresh.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
