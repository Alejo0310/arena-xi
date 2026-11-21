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


# ---------- Valoraciones aportadas (scripts/parse-ratings.py) ----------
import difflib
RATINGS_DIR = Path(__file__).resolve().parent.parent / "src" / "data" / "ratings"
LEAGUE_COUNTRY = [  # prefijo de la liga en la lista -> país en español
    ("Spain", "España"), ("England", "Inglaterra"), ("France", "Francia"), ("Germany", "Alemania"), ("Italy", "Italia"),
    ("Holland", "Países Bajos"), ("Portugal", "Portugal"), ("Turkey", "Turquía"), ("Saudi", "Arabia Saudita"),
    ("USA", "Estados Unidos"), ("Mexico", "México"), ("Argentina", "Argentina"), ("Scotland", "Escocia"),
    ("Belgium", "Bélgica"), ("Denmark", "Dinamarca"), ("Norway", "Noruega"), ("Sweden", "Suecia"), ("Poland", "Polonia"),
    ("Romania", "Rumanía"), ("Austria", "Austria"), ("Switzerland", "Suiza"), ("Australia", "Australia"),
    ("China", "China"), ("Korea", "Corea del Sur"), ("Indian", "India"), ("Rep. Ireland", "Irlanda"),
    ("Brazil", "Brasil"), ("Colombia", "Colombia"),
]
ES_CONT = {v[0]: v[1] for v in C.values()}
WILD = "Resto del mundo"


def rating_country(league):
    for pre, es in LEAGUE_COUNTRY:
        if league.startswith(pre):
            return es
    return WILD


def rating_league(league, country):
    for pre, es in LEAGUE_COUNTRY:
        if league.startswith(pre):
            return league[len(pre):].strip() or league
    return {"-": "Sin liga (según la lista)"}.get(league, league)


SAFE_SUFFIX = {"women", "femenino", "femenina", "femeni", "calcio", "praia", "sad", "bucuresti", "lorraine", "rotterdam", "63", "co", "alsace", "1909", "1913", "cfc", "fc"}
# Nombres genéricos con los que FIFPlay lista a clubes que la base de valoraciones nombra con su nombre real.
GENERIC_ALIAS = {"inter": "lombardiafc", "atalanta": "bergamocalcio", "monza": "brianzacalcio", "lazio": "latium", "milanofc": "milanofc"}


# Nombre en la lista de valoraciones -> nombre en el catálogo de FIFPlay (mismo club, verificado a mano). Ignora el país.
NAME_ALIAS = {
    "Napoli": "SSC Napoli", "Roma": "AS Roma", "Lazio": "SS Lazio", "Gotham FC": "NY/NJ Gotham FC", "Lecce": "US Lecce",
    "RAAL La Louvière": "La Louvière", "SpVgg Greuther Fürth": "Greuther Fürth", "Deportivo Riestra": "Dep. Riestra",
    "Altach": "SCR Altach", "Melbourne Victory": "Mel. Victory", "Jahn Regensburg": "Regensburg",
    "Wellington Phoenix": "Well. Phoenix", "TSV Havelse": "Havelse", "TSG 1899 Hoffenheim II": "Hoffenheim II",
    "Benfica": "SL Benfica", "RB Salzburg": "FC Red Bull Salzburg", "Gimnasia y Esgrima de Mendoza": "Gimnasia de Mendoza",
    "Tromsø IL": "Tromsø", "IK Start": "Start",
}


def apply_ratings(ed, clubs):
    f = RATINGS_DIR / f"fc{ed}.json"
    if not f.exists():
        return clubs, None
    rows = json.load(open(f, encoding="utf-8"))
    by = {}
    for i, c in enumerate(clubs):
        by.setdefault((c["g"], slug(c["n"])), []).append(i)
    used, fuzzy, added = set(), [], []

    def compat(c, rc):
        return rc == WILD or c["c"] == rc or c["c"] == WILD

    for r in rows:
        g, rc = ("w" if r["g"] == "w" else "m"), rating_country(r["l"])
        sl = slug(r["n"])
        cand = [i for i in by.get((g, sl), []) if i not in used and compat(clubs[i], rc)]
        how = "exacto"
        if not cand and NAME_ALIAS.get(r["n"]):
            cand = [i for i, c in enumerate(clubs) if i not in used and c["g"] == g and c["n"] == NAME_ALIAS[r["n"]]]
            how = "alias manual"
        if not cand and g == "m" and GENERIC_ALIAS.get(sl):
            cand = [i for i in by.get((g, GENERIC_ALIAS[sl]), []) if i not in used]
            how = "alias genérico"
        if not cand:  # coincidencia aproximada solo dentro del mismo género y país
            best, score = None, 0.0
            for i, c in enumerate(clubs):
                if i in used or c["g"] != g or not compat(c, rc) or rc == WILD:
                    continue
                cs = slug(c["n"])
                if len(sl) < 4 or len(cs) < 4:
                    continue
                sc = difflib.SequenceMatcher(None, sl, cs).ratio()
                # Abreviatura del catálogo ("Estudiantes" = "Estudiantes de La Plata") o sufijo inocuo (Women, Calcio...).
                if cs.startswith(sl) and cs[len(sl):] in SAFE_SUFFIX and len(sl) >= 5:
                    sc = max(sc, 0.9)
                elif sl.startswith(cs) and len(cs) >= 7:
                    sc = max(sc, 0.9)
                if sc > score:
                    best, score = i, sc
            if best is not None and score >= 0.84:
                cand, how = [best], f"aprox {score:.2f}"
        if cand:
            i = cand[0]
            used.add(i)
            clubs[i]["r"] = r["r"]
            if how == "alias manual" and clubs[i]["c"] == WILD:
                pass
            if how == "alias genérico":
                clubs[i]["n"] = r["n"]  # la base de valoraciones usa el nombre real: manda sobre el genérico
            if how != "exacto":
                fuzzy.append((r["n"], clubs[i]["n"], how))
        else:
            added.append(r)
    for r in added:
        g, rc = ("w" if r["g"] == "w" else "m"), rating_country(r["l"])
        clubs.append({"n": r["n"], "c": rc, "k": ES_CONT.get(rc, "Mundial"), "l": rating_league(r["l"], rc), "g": g, "r": r["r"], "x": 1})
    unm = [c for i, c in enumerate(clubs) if "r" not in c]
    for r in added:
        rc = rating_country(r["l"])
        for c in unm:
            if c["g"] == ("w" if r["g"] == "w" else "m") and (rc == WILD or c["c"] == rc) and difflib.SequenceMatcher(None, slug(r["n"]), slug(c["n"])).ratio() >= 0.75:
                print("  POSIBLE DUPLICADO:", r["n"], "<->", c["n"], c["c"])
    return clubs, {"rows": len(rows), "matched": len(used), "fuzzy": fuzzy, "added": [a["n"] + ("(W)" if a["g"] == "w" else "") for a in added]}


NOTABLE = ["Brazil", "Colombia", "Uruguay", "Ecuador", "Chile", "Japan", "Saudi Arabia", "Belgium", "Russia", "Switzerland", "Türkiye", "Egypt"]
for ed in ("25", "26", "27"):
    d = build(ed)
    d["clubs"], rep = apply_ratings(ed, d["clubs"])
    if rep:
        print(ed, "valoraciones:", rep["rows"], "filas;", rep["matched"], "emparejadas;", len(rep["added"]), "añadidas")
        print("  aproximadas:", rep["fuzzy"])
        print("  añadidas:", rep["added"])
    have = {(n["n"], n["g"]) for n in d["nationals"]}
    d["missing"] = {g: [{"n": c, "es": C[c][0]} for c in NOTABLE if (c, g) not in have] for g in ("m", "w")}
    f = out / f"fc{ed}.json"
    f.write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    cl = d["clubs"]
    print(ed, "clubes", len(cl), "con licencia", sum("lic" in c for c in cl), "nuevos", sum("new" in c for c in cl),
          "| sel M", sum(n["g"] == "m" for n in d["nationals"]), "F", sum(n["g"] == "f" for n in d["nationals"]),
          "con licencia", sum("lic" in n for n in d["nationals"]), "| bytes", f.stat().st_size)
