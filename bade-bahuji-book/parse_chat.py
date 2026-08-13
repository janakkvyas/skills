#!/usr/bin/env python3
"""Parse the WhatsApp chat.txt export into clean, deduplicated messages."""
import json
import re
import sys
import unicodedata

SRC = "/tmp/claude-0/-home-user-skills/b2580a5d-2a9f-5172-af06-0c0e3c668495/scratchpad/media/chat.txt"

# [8/15/25, 7:56:43 AM] Sender: text
HEADER = re.compile(r"^\[(\d{1,2})/(\d{1,2})/(\d{2,4}), [^\]]+\]\s([^:]+):\s?(.*)$")

MEDIA = re.compile(
    r"^\s*<?\s*(image|video|audio|sticker|gif|document|contact card|media)\s+omitted\s*>?\s*$",
    re.IGNORECASE,
)
SKIP_EXACT = {
    "This message was deleted.",
    "You deleted this message.",
    "null",
}

def clean(text):
    text = text.replace("‎", "").replace("‏", "").replace("﻿", "")
    return text.strip()

def norm_key(text):
    """Normalization key for duplicate detection: unicode-normalize, strip all
    whitespace/punctuation variance, so re-forwarded copies match."""
    t = unicodedata.normalize("NFC", text)
    t = re.sub(r"[\s ]+", " ", t)
    t = re.sub(r"[।॥.,!?;:\-–—*_~\"'()\[\]{}]+", "", t)
    return t.strip().lower()

messages = []
cur = None

with open(SRC, encoding="utf-8") as f:
    for raw in f:
        line = raw.rstrip("\n")
        m = HEADER.match(clean(line))
        if m:
            if cur:
                messages.append(cur)
            mm, dd, yy, sender, text = m.groups()
            yy = int(yy)
            year = 2000 + yy if yy < 100 else yy
            cur = {
                "date": (year, int(mm), int(dd)),
                "sender": clean(sender),
                "lines": [clean(text)],
            }
        elif cur is not None:
            cur["lines"].append(line.rstrip())
if cur:
    messages.append(cur)

out = []
seen = set()
stats = {"total": 0, "media": 0, "dupes": 0, "empty": 0, "by_sender": {}}

for msg in messages:
    stats["total"] += 1
    body = "\n".join(msg["lines"]).strip()
    body = clean(body)
    stats["by_sender"].setdefault(msg["sender"], 0)
    stats["by_sender"][msg["sender"]] += 1

    if msg["sender"] != "Bade Bahuji":
        stats["media"] += 1
        continue
    # strip inline media/system tokens anywhere in the body
    body = re.sub(r"<\s*(?:image|video|audio|sticker|gif|document|media)\s+omitted\s*>", "", body)
    body = re.sub(r"<\s*unknown message\s*>", "", body)
    body = re.sub(r"<\s*This message was edited\s*>", "", body, flags=re.IGNORECASE)
    body = body.strip()
    if not body:
        stats["empty"] += 1
        continue
    if body in SKIP_EXACT:
        stats["media"] += 1
        continue

    key = norm_key(body)
    if not key:
        stats["empty"] += 1
        continue
    if key in seen:
        stats["dupes"] += 1
        continue
    seen.add(key)

    out.append({"date": msg["date"], "sender": msg["sender"], "text": body})

with open("/tmp/claude-0/-home-user-skills/b2580a5d-2a9f-5172-af06-0c0e3c668495/scratchpad/messages.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)

print(json.dumps(stats, ensure_ascii=False, indent=1))
print("kept:", len(out))
lens = sorted(len(m["text"]) for m in out)
if lens:
    print("len min/med/p90/max:", lens[0], lens[len(lens)//2], lens[int(len(lens)*0.9)], lens[-1])
print("--- senders of kept:")
kept_by = {}
for m in out:
    kept_by.setdefault(m["sender"], 0)
    kept_by[m["sender"]] += 1
print(json.dumps(kept_by, ensure_ascii=False))
