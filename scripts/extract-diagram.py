#!/usr/bin/env python3
"""
Turn a photographed worksheet into a themeable, hotspot-ready SVG diagram.

    python3 scripts/extract-diagram.py photo.jpg --box 415 250 630 625 --out digestive
    # -> traced-refs/digestive.svg.txt   (gitignored; a REFERENCE, not a shippable asset)

Why this exists: hand-authoring diagrams was measured at roughly five revisions
per asset to reach textbook legibility, and the result was still worse than the
source. Tracing the source artwork gets a faithful figure in one pass. The
output is vector, so it stays themeable and resolution-independent, and hotspots
remain separate coordinate data — which is what lets one asset serve a
label_diagram item, an MCQ that highlights a single organ, and a classify item.

    ⚠️  LICENSING. Published workbook artwork is the publisher's copyright.
    This script is safe for personal use and for producing a REFERENCE that an
    illustrator redraws. Do not ship traced third-party artwork in a product
    without permission. See docs/KAJI_DECISIONS.md §3.5.

Pipeline: crop → de-shade → Otsu → strip leader lines → despeckle → potrace.
Requires: opencv-python-headless, potrace.
"""
import argparse, gzip, os, re, subprocess, sys
import cv2
import numpy as np


def deshade(bgr):
    """Divide out the paper's lighting gradient so one global threshold works.

    Phone photos of a curled page have a shading ramp across them; adaptive
    thresholding handles that but leaves speckle in the flat areas. Estimating
    the background by morphological closing and dividing it out gives a clean
    flat-field image that Otsu can then split perfectly.
    """
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 9, 60, 60)
    bg = cv2.morphologyEx(
        gray, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))
    )
    flat = cv2.divide(gray, bg, scale=255)
    _, bw = cv2.threshold(flat, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return bw


def strip_pen(bgr, thresh=28):
    """Inpaint the teacher's red marking. No-op on unmarked sheets."""
    b, g, r = cv2.split(bgr.astype(np.int16))
    mask = ((r - np.maximum(g, b)) > thresh).astype(np.uint8) * 255
    if mask.sum() == 0:
        return bgr
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), 1)
    return cv2.inpaint(bgr, mask, 5, cv2.INPAINT_TELEA)


def strip_leaders(ink, min_len=121):
    """Remove the worksheet's printed leader lines; the app draws its own.

    A morphological opening with a long horizontal kernel is the right tool
    rather than run-length clearing: the colon and small intestine DO contain
    horizontal runs of 40-90px, and a run-length rule long enough to spare them
    is too long to catch the leaders. An opening only survives where the stroke
    is straight for the full kernel width, which no part of the anatomy is.
    """
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (min_len, 1))
    lines = cv2.morphologyEx(ink, cv2.MORPH_OPEN, k)
    lines = cv2.dilate(lines, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 3)))
    out = cv2.subtract(ink, lines)
    # heal the nicks left where a leader crossed the figure outline
    return cv2.morphologyEx(out, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))


def despeckle(ink, min_area=200):
    n, lab, stats, _ = cv2.connectedComponentsWithStats(ink, 8)
    keep = np.zeros_like(ink)
    for i in range(1, n):
        _, _, w, h, a = stats[i]
        if a < min_area:
            continue
        if h < 14 and w / max(h, 1) > 4:  # free-floating leader stub
            continue
        keep[lab == i] = 255
    return keep


def tight_crop(ink, pad=12):
    ys, xs = np.where(ink > 0)
    return ink[
        max(0, ys.min() - pad) : ys.max() + pad, max(0, xs.min() - pad) : xs.max() + pad
    ]


def trace(ink, opttolerance=2.0, turdsize=80):
    """potrace the bitmap, then strip it down to a themeable <g>."""
    cv2.imwrite("/tmp/_trace.bmp", 255 - ink)
    subprocess.run(
        ["potrace", "-s", "-o", "/tmp/_trace.svg", "--turdsize", str(turdsize),
         "--alphamax", "1.2", "--opttolerance", str(opttolerance), "/tmp/_trace.bmp"],
        check=True,
    )
    svg = open("/tmp/_trace.svg").read()
    g = re.search(r'<g transform="([^"]+)"[^>]*>(.*?)</g>', svg, re.S)
    transform, inner = g.group(1), re.sub(r"\s+", " ", g.group(2).strip())
    inner = inner.replace("fill:#000000", "").replace('style=""', "")
    # 1dp is below one screen pixel at any size we render, and saves ~10%
    inner = re.sub(r"(\d+)\.(\d)\d+", r"\1.\2", inner)
    # data-provenance is load-bearing, not a comment: scripts/check-diagrams.mjs
    # refuses to let a `traced` asset be committed or bundled, and an unstamped
    # file in a diagram directory is treated as traced. The stamp lives INSIDE
    # the artwork so it survives being renamed or moved, which is how a traced
    # asset would otherwise launder itself into a shipping path.
    return (
        f'<g data-provenance="traced" transform="{transform}"'
        f' fill="currentColor" stroke="none">{inner}</g>'
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("photo")
    ap.add_argument("--box", nargs=4, type=int, required=True,
                    metavar=("X0", "Y0", "X1", "Y1"), help="crop of the figure")
    ap.add_argument("--scale", type=float, default=3.0)
    ap.add_argument("--out", default="diagram")
    ap.add_argument("--out-dir", default="traced-refs",
                    help="where to write. Default is gitignored and NOT shipped; "
                         "putting traced output under src/ fails the provenance guard.")
    a = ap.parse_args()

    im = cv2.imread(a.photo)
    if im is None:
        sys.exit(f"cannot read {a.photo}")
    x0, y0, x1, y1 = a.box
    fig = cv2.resize(im[y0:y1, x0:x1], None, fx=a.scale, fy=a.scale,
                     interpolation=cv2.INTER_CUBIC)

    ink = 255 - deshade(strip_pen(fig))
    ink = tight_crop(despeckle(strip_leaders(ink)))
    art = trace(ink)

    # NOT src/content/diagrams/. That is the shipping content path inside a
    # PUBLIC repo, so the old default contradicted the licensing warning above:
    # the failure would not have been "we bundled it" but "we redistributed the
    # publisher's illustration from a public URL". traced-refs/ is gitignored.
    os.makedirs(a.out_dir, exist_ok=True)
    path = os.path.join(a.out_dir, f"{a.out}.svg.txt")
    open(path, "w").write(art)
    print(f"{path}  {len(art)} B raw, {len(gzip.compress(art.encode(), 9))} B gzip")
    print(f"figure is {ink.shape[1]}x{ink.shape[0]} source px — place hotspots in that space")


if __name__ == "__main__":
    main()
