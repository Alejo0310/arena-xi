"""Convierte las páginas de FIFPlay (HTML descargado) en JSON normalizado.
Uso: python -I scripts/parse-fifplay.py <dir_html> <dir_salida>
Solo extrae lo que la fuente publica: nombre, país, liga y género. Sin valoraciones."""
import re, sys, json, html
from pathlib import Path

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
clean = lambda s: html.unescape(re.sub(r"<[^>]+>", "", s)).strip()

def tokens(page):
    body = page[page.find("<h1"):]
    for m in re.finditer(r"<(h2|h3|h4|li)[^>]*>(.*?)</\1>", body, re.S):
        yield m.group(1), clean(m.group(2))

def parse_clubs(edition):
    page = (src / f"fc-{edition}-clubs.html").read_text(encoding="utf-8")
    gender, country, league, teams = "men", None, None, []
    for tag, text in tokens(page):
        low = text.lower()
        if tag == "h2":
            if "women" in low: gender = "women"
            elif "men" in low: gender = "men"
            continue
        if tag == "h3":
            if "women" in low and "club" in low: gender = "women"; continue
            country, league = text, None
        elif tag == "h4": league = text
        elif tag == "li" and country and league and text and len(text) < 90:
            text = re.sub(r"\s*\(.*", "", text.split("**")[0]).strip()  # quita notas como "(Authentic kit...)" y "**"
            if not text:
                continue
            teams.append({"name": text, "country": country.title(), "league": league, "gender": gender})
    return teams

def parse_nationals(edition):
    page = (src / f"fc-{edition}-national-teams.html").read_text(encoding="utf-8")
    gender, res = "men", []
    body = page[page.find("<h1"):]
    for m in re.finditer(r"<(h2|h3|h4|li)[^>]*>(.*?)</\1>", body, re.S):
        tag, text = m.group(1), clean(m.group(2))
        low = text.lower()
        if tag in ("h2", "h3", "h4"):
            if "women" in low and "new" not in low and "faq" not in low: gender = "women"
            elif low.startswith("men") or "men's national" in low and "women" not in low: gender = "men"
        elif tag == "li" and 1 < len(text) < 40 and not text.endswith("?") and not re.search(
            r"FC ?2\d|FIFPlay|Login|Join|Contact|Advertise|Privacy|[Ff]ootball|Instagram|YouTube|Facebook|Vote|Wishlist|Mobile|Glossary|Footballizer|Referee|Entertainment|Web-Games|Release|Buy|Preorder|Clubs|Leagues|EA ", text):
            res.append({"name": text, "gender": gender})
    return res

for ed in ("25", "26", "27"):
    clubs, nats = parse_clubs(ed), parse_nationals(ed)
    (out / f"clubs-{ed}.json").write_text(json.dumps(clubs, ensure_ascii=False, indent=0), encoding="utf-8")
    (out / f"nat-{ed}.json").write_text(json.dumps(nats, ensure_ascii=False, indent=0), encoding="utf-8")
    cm = sum(c["gender"] == "men" for c in clubs)
    print(ed, "clubes", len(clubs), "M", cm, "F", len(clubs) - cm, "| selecciones M", sum(n["gender"]=="men" for n in nats), "F", sum(n["gender"]=="women" for n in nats))
