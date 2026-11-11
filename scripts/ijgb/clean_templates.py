"""
One-off asset preparation for the IJGB Homecoming visa tickets.

Takes the six approved reference designs (ijgb-ticket-designs/) and removes
ONLY the sample, per-ticket data (surname, given name, ID no., control no.,
origin/tier, issue date, serial, MRZ line 2) by inpainting just the glyph
pixels from the surrounding artwork. Everything else (borders, guilloche,
watermark, illustrations, static labels and static values) is left untouched.
The sample QR is left in place; at render time the real QR is drawn over the
exact white square it sits in.

Output: lib/server/ijgb/assets/<design>.jpg  (same 1280x720 size)
Run:    python scripts/ijgb/clean_templates.py
        (best results with opencv-contrib-python-headless installed, for FSR inpainting)
"""
import cv2
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'ijgb-ticket-designs'
OUT = ROOT / 'lib' / 'server' / 'ijgb' / 'assets'
OUT.mkdir(parents=True, exist_ok=True)

DESIGNS = {
    'early-bird':        ('photo_1_2026-11-11_11-36-14.jpg', 'light'),
    'standard':          ('photo_2_2026-11-11_11-36-04.jpg', 'light'),
    'elite':             ('photo_3_2026-11-11_11-36-14.jpg', 'light'),
    'distinguished':     ('photo_4_2026-11-11_11-36-04.jpg', 'light'),
    'distinguished-pro': ('photo_5_2026-11-11_11-36-14.jpg', 'dark'),
    'grand-patron':      ('photo_6_2026-11-11_11-36-04.jpg', 'dark'),
}

# (x0, y0, x1, y1) â€” tight to the sample glyphs, stopping above the
# engraved underlines so those rules survive.
# Engraved underline rows beneath a field (y0, y1 inclusive). They are masked
# during inpainting - so the fill is drawn from clean background on both
# sides instead of smearing the dark rule upward into the field - and then
# restored pixel-for-pixel from the original afterwards.
RULES = {
    'surname': (281, 284),
    'given':   (349, 352),
    'idno':    (414, 417),
    'origin':  (416, 419),
}

BOXES = {
    'surname': (368, 258, 502, 280),
    'given':   (367, 328, 574, 349),
    'idno':    (368, 392, 592, 413),
    'control': (827, 183, 1046, 206),
    'origin':  (914, 392, 1184, 413),
    'issue':   (591, 455, 835, 479),
    'serial':  (997, 526, 1187, 562),
    'mrz2':    (82, 650, 1200, 676),
}


def clean(img, tone):
    out = img.copy()
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.int16)
    mask = np.zeros(gray.shape, np.uint8)
    rule_mask = np.zeros(gray.shape, np.uint8)
    for key, (x0, y0, x1, y1) in BOXES.items():
        pad = 14
        X0, Y0, X1, Y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
        region = gray[Y0:Y1, X0:X1].astype(np.uint8)
        bg = cv2.medianBlur(region, 31).astype(np.int16)
        diff = (bg - region) if tone == 'light' else (region - bg)
        m = (diff > 20).astype(np.uint8)
        local = np.zeros_like(m)
        local[pad:pad + (y1 - y0), pad:pad + (x1 - x0)] = 1
        m &= local
        # Clip to the contiguous run of glyph columns starting at the left
        # edge of the field, so engraving further right (e.g. the circular
        # seal beside a short Origin value) is never touched.
        cols = np.where(m.sum(0) > 1)[0]
        if len(cols):
            end = cols[0]
            for c in cols[1:]:
                if c - end > 18:
                    break
                end = c
            m[:, end + 3:] = 0
        mask[Y0:Y1, X0:X1] |= m
        if key in RULES and len(cols):
            r0, r1 = RULES[key]
            rule_mask[r0:r1 + 1, X0 + cols[0] - 6:X0 + end + 9] = 1
    raw = mask.copy()
    mask = cv2.dilate(mask * 255, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    full = np.maximum(mask, rule_mask * 255)
    if hasattr(cv2, 'xphoto'):
        # Frequency-selective reconstruction keeps the fine engraving texture
        # (Telea leaves visibly smooth patches). Needs opencv-contrib.
        # Run per field on a padded crop: much faster than the full frame.
        valid = (full == 0).astype(np.uint8)
        for (x0, y0, x1, y1) in BOXES.values():
            X0, Y0, X1, Y1 = x0 - 24, y0 - 24, x1 + 24, y1 + 24
            dst = out[Y0:Y1, X0:X1].copy()
            cv2.xphoto.inpaint(out[Y0:Y1, X0:X1].copy(), valid[Y0:Y1, X0:X1].copy(), dst, cv2.xphoto.INPAINT_FSR_FAST)
            out[Y0:Y1, X0:X1] = dst
    else:
        print('  (opencv-contrib not found: falling back to Telea inpainting)')
        out = cv2.inpaint(out, full, 4, cv2.INPAINT_TELEA)
    keep = rule_mask.astype(bool)
    out[keep] = img[keep]
    # Where a sample glyph touched its underline (e.g. the tail of a Q), the
    # restored rule still carries that ink: rebuild those columns of the rule
    # from the nearest clean column of the same rule.
    for key, (r0, r1) in RULES.items():
        x0, _, x1, _ = BOXES[key]
        touched = raw[r0 - 3:r1 + 1, x0:x1 + 4].any(0)
        clean_cols = [x0 + i for i, t in enumerate(touched) if not t]
        for i, t in enumerate(touched):
            if t and clean_cols:
                c = x0 + i
                src = min(clean_cols, key=lambda k: abs(k - c) if abs(k - c) > 2 else 999)
                out[r0 - 1:r1 + 1, c] = img[r0 - 1:r1 + 1, src]
    return out, full


for name, (file, tone) in DESIGNS.items():
    img = cv2.imread(str(SRC / file))
    assert img is not None and img.shape[:2] == (720, 1280), file
    out, mask = clean(img, tone)
    cv2.imwrite(str(OUT / f'{name}.jpg'), out, [cv2.IMWRITE_JPEG_QUALITY, 95])
    print('wrote', name)
