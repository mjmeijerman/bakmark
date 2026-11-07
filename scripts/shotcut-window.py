#!/usr/bin/env python3
"""Capture only the Shotcut window, wherever it currently sits on the desktop.

Usage: shotcut-window.py [output.png] [width-in-pixels]
"""
import os
import re
import subprocess
import sys

out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/shotcut-window.png"
scale = sys.argv[2] if len(sys.argv) > 2 else "1400"
disp = os.environ.get("DISPLAY", ":1")

tree = subprocess.run(
    ["xwininfo", "-root", "-tree", "-display", disp],
    capture_output=True, text=True, check=True,
).stdout

best = None
for line in tree.splitlines():
    if 'Shotcut"' not in line:
        continue
    m = re.search(r"(\d+)x(\d+)\+\d+\+\d+\s+\+(\d+)\+(\d+)\s*$", line)
    if not m:
        continue
    w, h, x, y = (int(v) for v in m.groups())
    if best is None or w * h > best[1] * best[2]:
        best = (line.split()[0], w, h, x, y)

if best is None:
    sys.exit(f"No Shotcut window found on DISPLAY={disp}")

wid, w, h, x, y = best
subprocess.run(
    ["ffmpeg", "-v", "error", "-y", "-f", "x11grab",
     "-video_size", f"{w}x{h}", "-i", f"{disp}+{x},{y}",
     "-frames:v", "1", "-vf", f"scale={scale}:-1", out],
    check=True,
)
print(f"{out}  (window {wid}, {w}x{h} at +{x}+{y})")
