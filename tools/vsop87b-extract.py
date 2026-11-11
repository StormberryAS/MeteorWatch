#!/usr/bin/env python3
"""Print the truncated VSOP87B Earth series that tools/gen-peaks.py embeds.

Standard library only. This is the audit trail for the table inside gen-peaks.py: given the
original IMCCE file, it reproduces the embedded block byte for byte, so anyone can check that
nothing was typed in by hand.

    curl -O https://ftp.imcce.fr/pub/ephem/planets/vsop87/VSOP87B.ear
    sha256sum VSOP87B.ear      # 30a05a74b8bf65aeffffea7d329934b648dfbe186a06f6cce12b0d9403f896bb
    python3 tools/vsop87b-extract.py VSOP87B.ear

VSOP87B is Bretagnon and Francou (1988), version B2 of the Earth: heliocentric spherical
coordinates (variable 1 = L, 2 = B, 3 = R), dynamical ecliptic and equinox J2000. Each term is
A cos(B + C tau), multiplied by tau**k, with tau in Julian millennia from J2000.0 (TT).

Truncation rule: keep every term with A >= 1e-8 (radians for L and B, astronomical units for R),
in the file's own order. That keeps 343 terms of L, 92 of B and 213 of R (the counts are printed
at the end). Over 2025 to 2040 the dropped terms change the Earth's longitude by less than
0.04 arc seconds (about one second of time for the Sun) against the full series (1,184 terms for L).
"""

import re
import sys

THRESHOLD = 1e-8
NAMES = {1: "L", 2: "B", 3: "R"}


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    series: dict[tuple[int, int], list[tuple[str, str, str]]] = {}
    key = None
    for line in open(sys.argv[1], encoding="ascii"):
        if line.startswith(" VSOP87"):
            var = int(re.search(r"VARIABLE (\d)", line).group(1))
            power = int(re.search(r"\*T\*\*(\d)", line).group(1))
            key = (var, power)
            series[key] = []
        else:
            fields = line.split()
            series[key].append((fields[-3], fields[-2], fields[-1]))
    print("VSOP87B_EARTH = {")
    counts = []
    for var in (1, 2, 3):
        print(f'    "{NAMES[var]}": [')
        total = 0
        for power in range(6):
            kept = [t for t in series[(var, power)] if float(t[0]) >= THRESHOLD]
            total += len(kept)
            print(f"        [  # tau**{power}")
            for i in range(0, len(kept), 3):
                print("            " + " ".join(f"({a}, {b}, {c})," for a, b, c in kept[i:i + 3]))
            print("        ],")
        print("    ],")
        counts.append(f"{NAMES[var]} {total}")
    print("}")
    print("# terms kept: " + ", ".join(counts))


if __name__ == "__main__":
    main()
