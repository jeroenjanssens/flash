# /// script
# requires-python = ">=3.12"
# dependencies = ["opencv-python-headless", "numpy", "pillow"]
# ///
"""Extract flashcards from a scanned PDF of cut-out cards.

The PDF alternates between a page of pictures (in a 2x5 grid with green lines) and a page
with the corresponding words (in a 2x5 grid with black lines). For every pair of pages this
script:

1. extracts the scans (needs poppler's `pdfimages`),
2. straightens them (the scans are slightly rotated),
3. finds the grid lines and cuts the pages into cells,
4. trims each picture and saves it as WebP,
5. OCRs each word (needs `tesseract`).

It writes the pictures to `<out>/media/` and the raw results to `<out>/extracted.json`, which
is then curated by hand into `deck.json` (lowercasing, alternatives, metadata).

Usage: uv run scripts/extract_pdf_deck.py <pdf> <out-dir>
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROWS, COLS = 5, 2


def line_mask(img: np.ndarray, kind: str) -> np.ndarray:
    """Pixels that belong to the grid lines: green on picture pages, dark on word pages."""
    if kind == "green":
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, (32, 15, 150), (60, 255, 255))
    else:
        mask = (cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) < 160).astype(np.uint8) * 255
    return mask


def long_lines(mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Only the long, straight runs in a straightened mask: grid lines, not photos or text.

    The scanned lines are faint and dashed, so first bridge the gaps along each direction.
    """
    h, w = mask.shape
    horizontal = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 41), np.uint8))
    horizontal = cv2.morphologyEx(horizontal, cv2.MORPH_OPEN, np.ones((1, w // 4), np.uint8))
    vertical = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((41, 3), np.uint8))
    vertical = cv2.morphologyEx(vertical, cv2.MORPH_OPEN, np.ones((h // 6, 1), np.uint8))
    return horizontal, vertical


def rotate(img: np.ndarray, angle: float, border=(255, 255, 255)) -> np.ndarray:
    h, w = img.shape[:2]
    m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(
        img, m, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=border
    )


def skew_angle(mask: np.ndarray) -> float:
    """The rotation that makes the grid lines most axis-aligned (sharpest projections)."""
    small = cv2.resize(mask, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)

    def score(a: float) -> float:
        r = rotate(small, a, border=0).astype(np.float64)
        return float((r.sum(1) ** 2).sum() + (r.sum(0) ** 2).sum())

    best = max(np.arange(-3, 3.001, 0.1), key=score)
    return max(np.arange(best - 0.1, best + 0.1001, 0.01), key=score)


def line_positions(profile: np.ndarray, count: int, min_pitch: int, max_pitch: int) -> list[int]:
    """The `count` evenly spaced positions that best match the lines in a projection profile.

    The cards are all the same size, so fitting a regular grid ignores stray lines (like the
    "Name" underline) and still finds faint ones.
    """
    smooth = np.convolve(profile, np.ones(7), mode="same")
    n = len(smooth)
    best, best_score = None, -1.0
    for pitch in range(min_pitch, max_pitch + 1):
        span = pitch * (count - 1)
        if span >= n:
            break
        starts = np.arange(0, n - span)
        score = sum(smooth[starts + k * pitch] for k in range(count))
        i = int(score.argmax())
        if score[i] > best_score:
            best, best_score = (int(starts[i]), pitch), float(score[i])
    first, pitch = best
    # Snap every line to its local peak, as the scan is never perfectly regular.
    return [
        int(max(0, p - 6) + smooth[max(0, p - 6) : p + 7].argmax())
        for p in (first + k * pitch for k in range(count))
    ]


def grid(img: np.ndarray, kind: str) -> tuple[np.ndarray, list[int], list[int]]:
    """Straighten the page and return it with the y and x positions of the grid lines."""
    angle = skew_angle(line_mask(img, kind))
    img = rotate(img, angle)
    horizontal, vertical = long_lines(line_mask(img, kind))
    h, w = horizontal.shape
    ys = line_positions(horizontal.astype(np.float64).sum(1), ROWS + 1, h // 9, h // 5)
    xs = line_positions(vertical.astype(np.float64).sum(0), COLS + 1, w // 3, w // 2)
    print(f"  {kind:5} page: rotated {angle:+.2f}°, rows at {ys}, cols at {xs}")
    return img, ys, xs


def cells(img, ys, xs, inset: int):
    for r in range(ROWS):
        for c in range(COLS):
            yield r, c, img[ys[r] + inset : ys[r + 1] - inset, xs[c] + inset : xs[c + 1] - inset]


def trim_picture(cell: np.ndarray) -> np.ndarray:
    """Cut the picture out of a cell, ignoring the card number in the top-left corner."""
    h, w = cell.shape[:2]
    gray = cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY)
    sat = cv2.cvtColor(cell, cv2.COLOR_BGR2HSV)[:, :, 1]
    ink = ((gray < 225) | (sat > 40)).astype(np.uint8)
    ink[: int(h * 0.2), : int(w * 0.16)] = 0  # card number, e.g. "1.1"
    ink = cv2.morphologyEx(ink, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    # Keep components that are not specks of scanner dust.
    n, labels, stats, _ = cv2.connectedComponentsWithStats(ink)
    keep = np.zeros_like(ink)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= 150:
            keep[labels == i] = 1
    ys, xs = np.nonzero(keep)
    pad = 6
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, h)
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, w)
    pic = cell[y0:y1, x0:x1].astype(np.float32)
    # Lift the slightly grey paper of the scan to pure white.
    pic = np.clip((pic - 0) * 255.0 / 238.0, 0, 255).astype(np.uint8)
    return pic


def ocr(cell: np.ndarray) -> str:
    with tempfile.NamedTemporaryFile(suffix=".png") as f:
        cv2.imwrite(f.name, cell)
        out = subprocess.run(
            ["tesseract", f.name, "-", "--psm", "7", "-l", "eng"],
            capture_output=True,
            text=True,
            check=True,
        )
    return out.stdout.strip()


def main(pdf: Path, out: Path) -> None:
    media = out / "media"
    media.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdfimages", "-j", str(pdf), f"{tmp}/page"], check=True)
        pages = sorted(Path(tmp).glob("page-*.jpg"))
        if len(pages) % 2:
            raise RuntimeError("expected an even number of pages (pictures, words, ...)")
        results = []
        for p in range(0, len(pages), 2):
            sheet = p // 2 + 1
            print(f"sheet {sheet}")
            pic_img, pys, pxs = grid(cv2.imread(str(pages[p])), "green")
            word_img, wys, wxs = grid(cv2.imread(str(pages[p + 1])), "dark")
            words = {(r, c): ocr(cell) for r, c, cell in cells(word_img, wys, wxs, inset=12)}
            for r, c, cell in cells(pic_img, pys, pxs, inset=8):
                number = r * COLS + c + 1
                ref = f"{sheet}.{number}"
                name = f"{sheet}-{number:02d}.webp"
                pic = cv2.cvtColor(trim_picture(cell), cv2.COLOR_BGR2RGB)
                Image.fromarray(pic).save(media / name, "WEBP", quality=88, method=6)
                results.append(
                    {"ref": ref, "image": f"media/{name}", "ocr": words[(r, c)],
                     "size": [pic.shape[1], pic.shape[0]]}
                )
                print(f"  {ref:5} {words[(r, c)]!r}")
    (out / "extracted.json").write_text(json.dumps(results, indent=2) + "\n")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
