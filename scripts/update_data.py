#!/usr/bin/env python3
"""Append new stamp rally spots from the PokeXperience feed to data.json.

Existing entries are never removed, renumbered or edited: the checklist
stores progress by entry number, so numbers have to stay stable.
"""
import datetime
import json
import re
import sys
import urllib.request

FEED = "https://pokexperience.pages.dev/api/stamp-rallies"
DATA_FILE = "data.json"
MAX_NEW = 100  # a bigger jump means the feed changed shape, do not commit that

# feed key -> (rally key, label, name prefix)
KNOWN = {
    "pokelid": ("lid", "Poké-Lid-Rally", None),
    "pokecenter2026": ("center", "Pokémon-Center-Rally", "Pokémon Center"),
    "suita": ("suita", "Suita-Rally (Osaka)", "Suita"),
    "nagasaki": ("nagasaki", "Nagasaki-City-Rally", "Nagasaki City"),
    "tokyo_minato": ("minato", "Tokyo Minato-Rally", "Tokyo Minato"),
    "tokyo_koto": ("koto", "Tokyo Koto-Rally", "Tokyo Koto"),
    "tokyo_shinagawa": ("shinagawa", "Tokyo Shinagawa-Rally", "Shinagawa"),
    "apac2026": ("apac", "PokéXciting! APAC-Rally", "PokéXciting"),
}


def fetch_feed():
    req = urllib.request.Request(FEED, headers={"User-Agent": "coords-checklist-sync"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)["rallies"]


def clean_name(name, prefix):
    name = re.sub(r"^[\U0001F1E6-\U0001F1FF]{2}\s*", "", name)
    name = re.sub(r"\s*\((Turquoise|Pink|Blue|Red)\)$", "", name).strip()
    if prefix and name.startswith(prefix):
        name = name[len(prefix):].strip()
    return name


def coord_key(rally, lat, lng):
    return rally, round(float(lat), 4), round(float(lng), 4)


def rally_info(feed_rally):
    key = feed_rally["key"]
    if key in KNOWN:
        return KNOWN[key]
    title = feed_rally.get("short") or re.sub(r"^GO Stamp Rally\s*[—-]\s*", "", feed_rally["name"])
    return key, title, title


def spots_of(feed_rally, rally, prefix):
    """Yield (name, lat, lng) for every spot of one feed rally."""
    for group, entries in feed_rally.get("coords", {}).items():
        pref = None
        if rally == "lid":
            pref = re.sub(r"\s*\(\d+\)\s*$", "", group)
        for entry in entries:
            lat, lng = [x.strip() for x in entry[1].split(",")]
            name = clean_name(entry[0], prefix)
            yield (f"{pref} - {name}" if pref else f"{prefix} - {name}"), lat, lng


def dump(db):
    rallies = ",\n".join(json.dumps(r, ensure_ascii=False) for r in db["rallies"])
    spots = ",\n".join(json.dumps(s, ensure_ascii=False) for s in db["spots"])
    return '{\n"rallies":[\n' + rallies + '\n],\n"spots":[\n' + spots + "\n]\n}\n"


def main():
    today = datetime.date.today().isoformat()
    db = json.load(open(DATA_FILE, encoding="utf-8"))
    have = {coord_key(s[4], s[2], s[3]) for s in db["spots"]}
    known_rallies = {r[0] for r in db["rallies"]}
    next_n = max(s[0] for s in db["spots"]) + 1
    added = []

    feed = fetch_feed()
    if not feed:
        sys.exit("feed is empty")

    for fr in feed:
        if fr.get("end") and fr["end"] < today:
            continue
        rally, label, prefix = rally_info(fr)
        new = []
        for name, lat, lng in spots_of(fr, rally, prefix):
            k = coord_key(rally, lat, lng)
            if k in have:
                continue
            have.add(k)
            new.append([next_n + len(new), name, lat, lng, rally])
        if not new:
            continue
        if rally not in known_rallies:
            db["rallies"].append([rally, label])
            known_rallies.add(rally)
        next_n += len(new)
        added += new

    if len(added) > MAX_NEW:
        sys.exit(f"{len(added)} new spots at once, refusing to write")
    if not added:
        print("no new spots")
        return
    db["spots"] += added
    open(DATA_FILE, "w", encoding="utf-8").write(dump(db))
    print(f"added {len(added)} spots:")
    for s in added:
        print(" ", s)


if __name__ == "__main__":
    main()
