import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _node():
    for candidate in ("/usr/local/bin/node", "node"):
        if candidate == "node" or os.path.isfile(candidate):
            return candidate
    return "node"


def _call(payload):
    proc = subprocess.run(
        [_node(), "server/parts-cli.mjs"],
        cwd=str(ROOT),
        input=json.dumps(payload, ensure_ascii=False),
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise ValueError(proc.stderr.strip() or "parts bridge failed")
    try:
        return json.loads(proc.stdout or "{}")
    except json.JSONDecodeError as exc:
        raise ValueError("parts bridge returned invalid json") from exc


def roll_part(rng, owned_weapons, part_id):
    values = [rng() for _ in range(24)]
    part = _call(
        {
            "cmd": "rollPart",
            "rngValues": values,
            "ownedWeapons": owned_weapons,
            "options": {"id": part_id},
        }
    )
    if isinstance(part, dict) and part.get("error"):
        raise ValueError(part["error"])
    return part


def first_slot(parts, slots, part_id):
    return _call({"cmd": "firstSlot", "parts": parts, "slots": slots, "partId": part_id})


def unequip_slots(slots, index):
    data = _call({"cmd": "unequip", "slots": slots, "index": index})
    return data.get("slots", slots)
