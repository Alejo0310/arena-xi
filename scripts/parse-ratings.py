"""Convierte la lista de valoraciones de equipos aportada por el usuario (texto copiado de una base de datos
pública) en JSON por edición: src/data/ratings/fcXX.json.

Formato de entrada (una sección por edición, encabezada por "fc 26" / "fc 27"):
    Nombre del equipo
    [W]                      <- opcional: equipo femenino
    <País> <Liga> (n)\\tOVR\\tATK\\tMID\\tDEF

Se descartan: encabezados repetidos, duplicados exactos (el copiado paginado repite filas), equipos
de marketing/práctica/personalizados y cualquier fila con valoración 0 (un 0 no es una valoración real).
Uso: python -I scripts/parse-ratings.py <entrada.txt> <dir_salida>"""
import json, re, sys
from pathlib import Path

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
sys.stdout.reconfigure(encoding="utf-8")

lines = [l.rstrip("\r\n") for l in src.read_text(encoding="utf-8").splitlines()]
ROW = re.compile(r"^(?P<league>.*?)\t(?P<ovr>\d+)\t(?P<atk>\d+)\t(?P<mid>\d+)\t(?P<def>\d+)\s*$")
JUNK = re.compile(r"^(Marketing Team|Practice Arena|Pro Clubs Custom)")

sections: dict[str, list] = {}
edition = None
name = None
women = False
for raw in lines:
    l = raw.strip()
    m = re.fullmatch(r"fc\s*(\d\d)", l, re.I)
    if m:
        edition = "FC" + m.group(1)
        sections[edition] = []
        name, women = None, False
        continue
    if not l or l.startswith("Team\tLeague"):
        continue
    if edition is None:
        continue
    row = ROW.match(raw)
    if row and name:
        vals = [int(row[k]) for k in ("ovr", "atk", "mid", "def")]
        if not JUNK.match(name) and all(v > 0 for v in vals):
            league = row["league"].strip()
            tier = re.search(r"\((\d)\)\s*$", league)
            sections[edition].append({
                "n": name, "g": "w" if women else "m",
                "l": re.sub(r"\s*\(\d\)\s*$", "", league), "t": int(tier[1]) if tier else None,
                "r": vals,
            })
        name, women = None, False
    elif l == "W" and name and not women:
        women = True
    else:
        name, women = l, False

for ed, rows in sections.items():
    seen, uniq, conflicts = {}, [], []
    for r in rows:
        k = (r["n"], r["g"], r["l"])
        if k in seen:
            if seen[k]["r"] != r["r"]:
                conflicts.append((k, seen[k]["r"], r["r"]))
            continue
        seen[k] = r
        uniq.append(r)
    (out / f"{ed.lower()}.json").write_text(json.dumps(uniq, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(ed, "filas", len(rows), "únicas", len(uniq), "mujeres", sum(r["g"] == "w" for r in uniq), "conflictos", len(conflicts))
    for c in conflicts[:5]:
        print("  conflicto", c)
