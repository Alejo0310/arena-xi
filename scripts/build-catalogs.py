"""Genera src/data/catalogs/fcXX.json a partir de lo extraído de FIFPlay (disponibilidad,
país, liga) y FIFAUTeam (licencia y novedades). NO se genera ninguna valoración:
las valoraciones de FC 26/FC 27 no son verificables con las fuentes accesibles.
Uso: python -I scripts/build-catalogs.py <parsed_dir> <raw_dir> <out_dir>"""
import re, sys, json, html, unicodedata
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
parsed, raw, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(fc|cf|ac|sc|sv|fk|sk|club|de|the|real)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", "", s)


# país EN -> (ES, continente)
C = {
    "Argentina": ("Argentina", "Sudamérica"), "Australia": ("Australia", "Oceanía"), "Austria": ("Austria", "Europa"),
    "Belgium": ("Bélgica", "Europa"), "Brazil": ("Brasil", "Sudamérica"), "Cameroon": ("Camerún", "África"),
    "Canada": ("Canadá", "Norteamérica"), "Chile": ("Chile", "Sudamérica"), "China": ("China", "Asia"),
    "Colombia": ("Colombia", "Sudamérica"), "Croatia": ("Croacia", "Europa"), "Czechia": ("Chequia", "Europa"),
    "Denmark": ("Dinamarca", "Europa"), "DR Congo": ("RD Congo", "África"), "Egypt": ("Egipto", "África"),
    "England": ("Inglaterra", "Europa"), "Finland": ("Finlandia", "Europa"), "France": ("Francia", "Europa"),
    "Germany": ("Alemania", "Europa"), "Ghana": ("Ghana", "África"), "Greece": ("Grecia", "Europa"),
    "Hungary": ("Hungría", "Europa"), "Iceland": ("Islandia", "Europa"), "India": ("India", "Asia"),
    "Indonesia": ("Indonesia", "Asia"), "Ireland": ("Irlanda", "Europa"), "Italy": ("Italia", "Europa"),
    "Japan": ("Japón", "Asia"), "Korea Republic": ("Corea del Sur", "Asia"), "Mexico": ("México", "Norteamérica"),
    "Morocco": ("Marruecos", "África"), "Netherlands": ("Países Bajos", "Europa"), "New Zealand": ("Nueva Zelanda", "Oceanía"),
    "Northern Ireland": ("Irlanda del Norte", "Europa"), "Norway": ("Noruega", "Europa"), "Paraguay": ("Paraguay", "Sudamérica"),
    "Peru": ("Perú", "Sudamérica"), "Poland": ("Polonia", "Europa"), "Portugal": ("Portugal", "Europa"),
    "Qatar": ("Catar", "Asia"), "Romania": ("Rumanía", "Europa"), "Saudi Arabia": ("Arabia Saudita", "Asia"),
    "Scotland": ("Escocia", "Europa"), "Spain": ("España", "Europa"), "Sweden": ("Suecia", "Europa"),
    "Switzerland": ("Suiza", "Europa"), "Türkiye": ("Turquía", "Europa"), "Ukraine": ("Ucrania", "Europa"),
    "United States": ("Estados Unidos", "Norteamérica"), "Uruguay": ("Uruguay", "Sudamérica"),
    "Venezuela": ("Venezuela", "Sudamérica"), "Vietnam": ("Vietnam", "Asia"), "Wales": ("Gales", "Europa"),
    "Russia": ("Rusia", "Europa"), "Ecuador": ("Ecuador", "Sudamérica"),
}
ALIAS = {
    "Ireland (Republic of Ireland)": "Ireland", "Republic Of Ireland": "Ireland", "Republic of Ireland": "Ireland",
    "Republic Of Korea": "Korea Republic", "Turkey": "Türkiye", "United States of America": "United States",
    "Congo DR": "DR Congo", "United Stats": "United States", "China Pr": "China", "Usa": "United States",
}


def norm_c(n):
    n = ALIAS.get(n.strip(), n.strip())
    if n.startswith("T") and n.endswith("rkiye"):
        n = "Türkiye"
    if n.startswith("Australia /"):
        return "Australia"
    if n.startswith("United States /"):
        return "United States"
    return n


def cinfo(n):
    n = norm_c(n)
    if n in C:
        return C[n]
    if n in ("Conmebol", "Rest Of World"):
        return ("Resto del mundo", "Mundial")
    return (n, "Otros")


def ut_tokens(ed):
    u = (raw / f"ut-fc-{ed}.html").read_text(encoding="utf-8")
    b = re.sub(r"<script.*?</script>|<style.*?</style>", "", u, flags=re.S)
    b = html.unescape(re.sub(r"<[^>]+>", "|", b))
    return [t.strip() for t in b.split("|") if t.strip()]


def ut_licences(ed):
    """(licencias de clubes, licencias de selecciones, novedades de clubes) según FIFAUTeam."""
    toks = ut_tokens(ed)
    lic_c, lic_n, new_c = {}, {}, set()
    mode, section, nat, gender = None, None, False, "m"
    for i, t in enumerate(toks):
        if t.startswith("FC ") and "Competitions" in t:
            break
        if re.match(r"FC \d+ National Teams", t):
            nat, mode, section = True, None, "nat"
        if t == "Full Licensed:":
            mode = "licensed"
        elif t in ("Generic Kits and Crests:", "Generic Players:"):
            mode = "generic"
        elif " VS FC " in t:
            mode, section = None, "diff"
        elif t.startswith("List of Women"):
            gender, mode = "w", None
        elif t.startswith("List of Men"):
            gender, mode = "m", None
        elif t.startswith("Men") and "Clubs" in t:
            gender = "m"
        elif t.startswith("Women") and "Clubs" in t:
            gender = "w"
        elif re.fullmatch(r"[A-ZÀ-Ý0-9 .&'’/\-]{4,}", t) and i + 1 < len(toks) and re.fullmatch(r"\d{1,2}", toks[i + 1]):
            mode, section = None, "league"
            if not nat:
                gender = "m" if "WOMEN" not in t else "w"
        elif re.fullmatch(r"\d{1,2}|▲|▼|N|-->", t):
            continue
        elif section == "diff" and not nat:
            if i > 0 and toks[i - 1] == "▲" and t not in ("Leagues",) and "Liga" not in t:
                new_c.add((slug(t), gender))
        elif mode and section != "diff":
            nm = re.sub(r"\s*\(.*?\)\s*", "", t)
            nxt = toks[i + 1] if i + 1 < len(toks) else ""
            if len(nm) < 45 and nxt != "-->":  # un elemento seguido de "-->" estaba comentado en la página
                if nat:
                    lic_n.setdefault((slug(norm_c(nm)), gender), mode)
                elif gender == "m":
                    lic_c.setdefault(slug(nm), mode)
    return lic_c, lic_n, new_c


def build(ed):
    lic_c, lic_n, new_c = ut_licences(ed)
    prev = {"26": "25", "27": "26"}.get(ed)
    prev_nat = {(norm_c(n["name"]), n["gender"]) for n in json.load(open(parsed / f"nat-{prev}.json", encoding="utf-8"))} if prev else None
    clubs = json.load(open(parsed / f"clubs-{ed}.json", encoding="utf-8"))
    nats = json.load(open(parsed / f"nat-{ed}.json", encoding="utf-8"))
    res_c, seen = [], set()
    for c in clubs:
        pais, cont = cinfo(c["country"])
        key = (slug(c["name"]), c["gender"], c["league"])
        if key in seen:
            continue
        seen.add(key)
        e = {"n": c["name"], "c": pais, "k": cont, "l": c["league"].strip(), "g": c["gender"][0]}
        s = slug(c["name"])
        if c["gender"] == "men" and s in lic_c:
            e["lic"] = lic_c[s]
        if (s, c["gender"][0]) in new_c:
            e["new"] = 1
        res_c.append(e)
    res_n, seenn = [], set()
    for n in nats:
        nm = norm_c(n["name"])
        if (nm, n["gender"]) in seenn or nm not in C:
            continue
        seenn.add((nm, n["gender"]))
        es, cont = C[nm]
        e = {"n": nm, "es": es, "k": cont, "g": n["gender"][0]}
        s = (slug(nm), n["gender"][0])
        if s in lic_n:
            e["lic"] = lic_n[s]
        if prev_nat is not None and (nm, n["gender"]) not in prev_nat:
            e["new"] = 1
        res_n.append(e)
    return {"clubs": res_c, "nationals": res_n}


NOTABLE = ["Brazil", "Colombia", "Uruguay", "Ecuador", "Chile", "Japan", "Saudi Arabia", "Belgium", "Russia", "Switzerland", "Türkiye", "Egypt"]
for ed in ("25", "26", "27"):
    d = build(ed)
    have = {(n["n"], n["g"]) for n in d["nationals"]}
    d["missing"] = {g: [{"n": c, "es": C[c][0]} for c in NOTABLE if (c, g) not in have] for g in ("m", "w")}
    f = out / f"fc{ed}.json"
    f.write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    cl = d["clubs"]
    print(ed, "clubes", len(cl), "con licencia", sum("lic" in c for c in cl), "nuevos", sum("new" in c for c in cl),
          "| sel M", sum(n["g"] == "m" for n in d["nationals"]), "F", sum(n["g"] == "f" for n in d["nationals"]),
          "con licencia", sum("lic" in n for n in d["nationals"]), "| bytes", f.stat().st_size)
