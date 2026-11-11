#!/usr/bin/env python3
"""Assert that cities.js is the shared Stormberry Labs city catalogue, unchanged.

cities.js is written by SunApp's update_cities.py into every app repository in its APPS list in one
run, and copied here byte for byte. It is never edited in this repository. This check holds the
copy to what it must be:

  1. its sha256 is the pinned value (a deliberate catalogue update changes the pin in the same commit);
  2. it starts with the two header lines of the generator;
  3. its packed literal parses and has the expected shape (244 countries, 349 time zones, 25,007 rows,
     seven fields in each row, every index in range);
  4. when a sibling SunApp checkout holds a cities.js (the layout of the vault: GitHub/SunApp/ next to
     GitHub/MeteorWatch/), the two are byte for byte the same file.

MeteorWatch has no Android twin (data/cities.tsv) yet. When an Android app adds one, add the
comparison of the packed literal with that file, as MoonApp's check does.

    python3 -I tools/check-city-parity.py

Standard library only. Exits 1 on any mismatch.
"""
import hashlib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CITIES_JS = ROOT / "cities.js"
PINNED_SHA256 = "2f08782c7f41df5eb95c15a4a668a389505bd4bfba059040d048cbc1324afce2"
PINNED_BYTES = 1135691
HEADER = "// Stormberry Labs shared city catalogue.\n// GENERATED FILE, DO NOT EDIT BY HAND.\n"
COUNTRIES, ZONES, ROWS = 244, 349, 25007
SUNAPP_COPY = ROOT.parent / "SunApp" / "cities.js"


def fail(message):
    print(f"city parity: {message}", file=sys.stderr)
    return 1


def main():
    if not CITIES_JS.is_file():
        return fail("cities.js is missing")
    data = CITIES_JS.read_bytes()

    digest = hashlib.sha256(data).hexdigest()
    if digest != PINNED_SHA256 or len(data) != PINNED_BYTES:
        return fail(f"cities.js is {len(data)} bytes with sha256 {digest}, not the pinned {PINNED_BYTES} bytes "
                    f"{PINNED_SHA256}. Copy SunApp/cities.js byte for byte; on a deliberate catalogue update, "
                    "change the pin here, in tests/build.test.ts and the date in index.html in the same commit.")

    text = data.decode("utf-8")
    if not text.startswith(HEADER):
        return fail("cities.js does not start with the generator's two header lines")

    match = re.search(r'var D = ("(?:[^"\\]|\\.)*");', text, re.S)
    if not match:
        return fail("could not find the packed data literal")
    lines = json.loads(match.group(1)).split("\n")
    countries = lines[0].split("\t")
    zones = lines[1].split("\t")
    rows = [line.split("\t") for line in lines[2:] if line]
    if (len(countries), len(zones), len(rows)) != (COUNTRIES, ZONES, ROWS):
        return fail(f"{len(countries)} countries, {len(zones)} zones and {len(rows)} rows, "
                    f"expected {COUNTRIES}, {ZONES} and {ROWS}")
    for number, row in enumerate(rows, 1):
        if len(row) != 7:
            return fail(f"row {number} has {len(row)} fields, expected 7")
        if not (0 <= int(row[2]) < len(countries) and 0 <= int(row[5]) < len(zones)):
            return fail(f"row {number} has a country or zone index out of range")

    note = "no SunApp checkout next to this one"
    if SUNAPP_COPY.is_file():
        if SUNAPP_COPY.read_bytes() != data:
            return fail(f"{SUNAPP_COPY} is not the same file as cities.js")
        note = "byte for byte the same as the sibling SunApp copy"
    print(f"city parity OK: {len(rows)} cities, {len(countries)} countries, {len(zones)} zones, sha256 {digest[:8]}, {note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
