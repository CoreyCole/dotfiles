#!/usr/bin/env python3
"""Retile the active Herdr tab into even columns or rows.

Herdr cannot change split topology inside one tab (pane.move same-tab is a
no-op). This script parks extra panes on a temporary tab, then moves them back
as a right-split (columns) or down-split (rows) chain with even ratios. Live
PTYs and scrollback stay. Do not use layout.apply; that creates new panes.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys

RATIO_MIN = 0.1
RATIO_MAX = 0.9
HOLDING_LABEL = "herdr-even-layout"


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"columns", "rows"}:
        print("usage: herdr-even-layout.py columns|rows", file=sys.stderr)
        return 2
    mode = sys.argv[1]
    split = "right" if mode == "columns" else "down"

    layout = herdr("pane", "layout", *pane_target())
    snapshot = layout["layout"]
    if snapshot.get("zoomed"):
        herdr("pane", "zoom", "--off", *pane_target())
        layout = herdr("pane", "layout", *pane_target())
        snapshot = layout["layout"]

    panes = list(snapshot.get("panes") or [])
    if len(panes) < 2:
        return 0
    panes.sort(key=lambda pane: sort_key(pane, mode))
    if already_even(panes, mode):
        return 0

    origin_tab = snapshot["tab_id"]
    origin_ids = [pane["pane_id"] for pane in panes]
    focused_id = snapshot.get("focused_pane_id")
    if focused_id not in origin_ids:
        focused_id = origin_ids[0]
    anchor = origin_ids[0]
    extras = origin_ids[1:]
    holding_tab = None
    parked: list[str] = []
    try:
        moved = herdr(
            "pane",
            "move",
            extras[0],
            "--new-tab",
            "--label",
            HOLDING_LABEL,
            "--no-focus",
        )
        holding_tab = created_tab_id(moved) or moved_pane(moved)["tab_id"]
        parked.append(extras[0])
        holding_root = parked[0]
        for pane_id in extras[1:]:
            herdr(
                "pane",
                "move",
                pane_id,
                "--tab",
                holding_tab,
                "--target-pane",
                holding_root,
                "--split",
                "down",
                "--no-focus",
            )
            parked.append(pane_id)

        count = len(origin_ids)
        target = anchor
        for index, pane_id in enumerate(extras, start=1):
            ratio = clamp_ratio(1.0 / (count - index + 1))
            herdr(
                "pane",
                "move",
                pane_id,
                "--tab",
                origin_tab,
                "--target-pane",
                target,
                "--split",
                split,
                "--ratio",
                f"{ratio:.6f}",
                "--no-focus",
            )
            parked.remove(pane_id)
            target = pane_id
    except Exception:
        if holding_tab and parked:
            restore_parked(origin_tab, anchor, split, parked)
        raise
    # Unfocused panes keep their old PTY size until they receive focus.
    forward = "right" if mode == "columns" else "down"
    back = "left" if mode == "columns" else "up"
    kick_redraw(origin_ids, str(focused_id), forward, back)
    return 0


def pane_target() -> list[str]:
    pane_id = os.environ.get("HERDR_ACTIVE_PANE_ID") or os.environ.get("HERDR_PANE_ID")
    if pane_id:
        return ["--pane", pane_id]
    return ["--current"]


def sort_key(pane: dict, mode: str) -> tuple:
    rect = pane["rect"]
    if mode == "columns":
        return (rect["x"], rect["y"], pane["pane_id"])
    return (rect["y"], rect["x"], pane["pane_id"])


def already_even(panes: list[dict], mode: str) -> bool:
    rects = [pane["rect"] for pane in panes]
    if mode == "columns":
        if len({rect["y"] for rect in rects}) != 1:
            return False
        if len({rect["height"] for rect in rects}) != 1:
            return False
        widths = [rect["width"] for rect in rects]
        return max(widths) - min(widths) <= 1
    if len({rect["x"] for rect in rects}) != 1:
        return False
    if len({rect["width"] for rect in rects}) != 1:
        return False
    heights = [rect["height"] for rect in rects]
    return max(heights) - min(heights) <= 1


def clamp_ratio(ratio: float) -> float:
    return max(RATIO_MIN, min(RATIO_MAX, ratio))


def herdr(*args: str) -> dict:
    binary = os.environ.get("HERDR_BIN_PATH") or "herdr"
    proc = subprocess.run(
        [binary, *args],
        check=False,
        capture_output=True,
        text=True,
    )
    stdout = proc.stdout.strip()
    stderr = proc.stderr.strip()
    if not stdout:
        raise RuntimeError(stderr or f"herdr {' '.join(args)} produced no output")
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(stderr or stdout) from exc
    if proc.returncode != 0 or payload.get("error"):
        error = payload.get("error") or {}
        if isinstance(error, dict):
            message = error.get("message") or stdout
        else:
            message = str(error)
        raise RuntimeError(message)
    result = payload.get("result")
    if not isinstance(result, dict):
        raise RuntimeError(f"herdr {' '.join(args)} returned no result object")
    if "move_result" in result and isinstance(result["move_result"], dict):
        return result["move_result"]
    return result


def created_tab_id(moved: dict) -> str | None:
    tab = moved.get("created_tab")
    if isinstance(tab, dict):
        tab_id = tab.get("tab_id")
        if tab_id:
            return str(tab_id)
    return None


def moved_pane(moved: dict) -> dict:
    pane = moved.get("pane")
    if isinstance(pane, dict):
        return pane
    raise RuntimeError("pane move response did not include pane")


def neighbor_id(pane_id: str, direction: str) -> str | None:
    result = herdr("pane", "neighbor", "--direction", direction, "--pane", pane_id)
    neighbor = result.get("neighbor") if isinstance(result.get("neighbor"), dict) else result
    if not isinstance(neighbor, dict):
        return None
    found = neighbor.get("neighbor_pane_id")
    return str(found) if found else None


def current_focused(pane_id: str) -> str:
    layout = herdr("pane", "layout", "--pane", pane_id)
    snapshot = layout.get("layout") if isinstance(layout.get("layout"), dict) else layout
    focused = snapshot.get("focused_pane_id") if isinstance(snapshot, dict) else None
    return str(focused) if focused else pane_id


def kick_redraw(chain: list[str], focused_id: str, forward: str, back: str) -> None:
    if len(chain) < 2:
        return
    current = current_focused(chain[0])
    if current not in chain:
        current = chain[0]
    index = chain.index(current)
    while index > 0:
        herdr("pane", "focus", "--direction", back, "--pane", chain[index])
        index -= 1
    while index < len(chain) - 1:
        herdr("pane", "focus", "--direction", forward, "--pane", chain[index])
        index += 1
    target = chain.index(focused_id) if focused_id in chain else 0
    while index > target:
        herdr("pane", "focus", "--direction", back, "--pane", chain[index])
        index -= 1
    while index < target:
        herdr("pane", "focus", "--direction", forward, "--pane", chain[index])
        index += 1


def restore_parked(origin_tab: str, anchor: str, split: str, parked: list[str]) -> None:
    for pane_id in list(parked):
        try:
            herdr(
                "pane",
                "move",
                pane_id,
                "--tab",
                origin_tab,
                "--target-pane",
                anchor,
                "--split",
                split,
                "--no-focus",
            )
        except Exception:
            continue


def notify_error(message: str) -> None:
    binary = os.environ.get("HERDR_BIN_PATH") or "herdr"
    subprocess.run(
        [binary, "notification", "show", "even layout failed", "--body", message[:240]],
        check=False,
        capture_output=True,
        text=True,
    )


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"herdr-even-layout: {exc}", file=sys.stderr)
        notify_error(str(exc))
        raise SystemExit(1)
