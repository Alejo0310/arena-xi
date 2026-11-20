import { beforeAll, describe, expect, it } from "vitest";
import { loadCatalog, teamsFor, type Catalog } from "../catalog";
import { categoryError, sanitizePool, tournamentCategoryError } from "../category";
import { buildPots, drawError } from "../draw";
import { getTeam, isRated, snapshotOf, setActiveSnapshot, CLUBS } from "../teams";
import type { GameEdition, Tournament } from "../types";

const cats: Record<string, Catalog> = {};
beforeAll(async () => {
  for (const e of ["FC25", "FC26", "FC27"] as const) cats[e] = await loadCatalog(e);
});

function base(edition: GameEdition, kind: "club" | "national", gender: "men" | "women", pool: string[]): Tournament {
  return {
    id: "t", name: "t", createdAt: 0, updatedAt: 0, phase: "setup",
    settings: { format: "league", category: kind, edition, gender, legs: 1, thirdPlace: true, tiebreak: "gd", points: { win: 3, draw: 1, loss: 0 }, allowRepeatTeams: false, matchMinutes: 10 },
    participants: [{ id: "a", name: "A", color: "#fff" }, { id: "b", name: "B", color: "#000" }],
    teamPool: pool, assignments: {}, drawHistory: [], draw: null, matches: [], championId: null,
  };
}

describe("catálogos por edición", () => {
  it("cada edición tiene sus cuatro categorías con equipos", () => {
    for (const e of ["FC25", "FC26", "FC27"] as const) {
      expect(teamsFor(e, "club", "men").length).toBeGreaterThan(300);
      expect(teamsFor(e, "national", "men").length).toBeGreaterThan(20);
      expect(teamsFor(e, "national", "women").length).toBeGreaterThan(10);
    }
    expect(teamsFor("FC26", "club", "women").length).toBeGreaterThan(30);
    expect(teamsFor("FC27", "club", "women").length).toBeGreaterThan(30);
  });

  it("los ids son únicos y cada equipo declara su edición", () => {
    const seen = new Set<string>();
    for (const e of ["FC25", "FC26", "FC27"] as const)
      for (const t of cats[e].teams) {
        expect(seen.has(t.id)).toBe(false);
        seen.add(t.id);
        expect(t.edition ?? "FC25").toBe(e);
      }
  });

  it("no hay valoraciones inventadas: FC 26 y FC 27 no tienen ninguna; FC 25 solo las 36 verificadas", () => {
    for (const e of ["FC26", "FC27"] as const) expect(cats[e].teams.filter((t) => t.ovr != null)).toHaveLength(0);
    const rated25 = cats.FC25.teams.filter((t) => t.ovr != null);
    expect(rated25.length).toBe(36);
    expect(getTeam("real-madrid")?.ovr).toBe(85);
  });

  it("FC 25 conserva los ids originales y no duplica Inter/Milan con sus nombres genéricos", () => {
    const names = cats.FC25.teams.filter((t) => t.kind === "club" && t.gender === "men").map((t) => t.name);
    expect(names).toContain("Lombardia FC");
    expect(names).not.toContain("Inter");
    expect(names).not.toContain("Milan");
    // Hay clubes homónimos de países distintos (p. ej. dos "Arsenal"); nombre + país sí es único.
    const keys = cats.FC25.teams.filter((t) => t.kind === "club" && t.gender === "men").map((t) => `${t.name}|${t.country}|${t.league}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("disponibilidad de selecciones: Brasil solo en FC 27; Bélgica solo en FC 27", () => {
    const has = (e: GameEdition, n: string, g: "men" | "women" = "men") => teamsFor(e, "national", g).some((t) => t.country === n);
    expect(has("FC25", "Brasil")).toBe(false);
    expect(has("FC26", "Brasil")).toBe(false);
    expect(has("FC27", "Brasil")).toBe(true);
    expect(has("FC25", "Bélgica")).toBe(false);
    expect(has("FC27", "Bélgica")).toBe(true);
    expect(has("FC27", "Brasil", "women")).toBe(true);
    expect(cats.FC25.missing.some((m) => m.es === "Brasil" && m.gender === "men")).toBe(true);
    expect(cats.FC27.missing.some((m) => m.es === "Brasil" && m.gender === "men")).toBe(false);
  });

  it("las etiquetas 'nuevo' solo existen con evidencia (FC 27 trae selecciones nuevas, FC 25 ninguna)", () => {
    expect(teamsFor("FC25", "national", "men").some((t) => t.newIn)).toBe(false);
    expect(teamsFor("FC27", "national", "men").filter((t) => t.newIn).length).toBeGreaterThan(10);
    expect(teamsFor("FC27", "national", "men").find((t) => t.country === "Japón")?.license).toBe("generic");
  });
});

describe("reglas de negocio multiversión", () => {
  const club26 = () => teamsFor("FC26", "club", "men")[0];
  const club27 = () => teamsFor("FC27", "club", "men")[0];
  const women26 = () => teamsFor("FC26", "club", "women")[0];

  it("no se mezclan ediciones", () => {
    expect(categoryError([club26().id, club27().id], { kind: "club", edition: "FC26", gender: "men" })).toMatch(/ediciones/);
    expect(categoryError(["real-madrid"], { kind: "club", edition: "FC26", gender: "men" })).toMatch(/ediciones/);
  });
  it("no se mezclan masculinos y femeninos", () => {
    expect(categoryError([club26().id, women26().id], { kind: "club", edition: "FC26", gender: "men" })).toMatch(/masculinos y femeninos/);
  });
  it("no se mezclan clubes y selecciones", () => {
    const nat = teamsFor("FC26", "national", "men")[0];
    expect(categoryError([club26().id, nat.id], { kind: "club", edition: "FC26", gender: "men" })).toMatch(/categorías/);
  });
  it("sanitizePool descarta equipos de otra edición o género", () => {
    expect(sanitizePool([club26().id, club27().id, women26().id], { kind: "club", edition: "FC26", gender: "men" })).toEqual([club26().id]);
  });
  it("un torneo antiguo (sin edición) es de FC 25 masculino", () => {
    const t = base("FC25", "club", "men", ["real-madrid", "bayern"]);
    delete t.settings.edition;
    delete t.settings.gender;
    expect(tournamentCategoryError(t)).toBeNull();
  });
  it("los bombos exigen valoraciones verificadas", () => {
    const pool = teamsFor("FC26", "club", "men").slice(0, 4).map((t) => t.id);
    expect(drawError(base("FC26", "club", "men", pool), "pots")).toMatch(/valoración verificada/);
    expect(drawError(base("FC26", "club", "men", pool), "roulette")).toBeNull();
    const ok = base("FC25", "club", "men", ["real-madrid", "bayern", "arsenal", "psg"]);
    expect(drawError(ok, "pots")).toBeNull();
    expect(buildPots(ok.teamPool, 2)[0].every((id) => isRated(getTeam(id)))).toBe(true);
  });
});

describe("instantáneas", () => {
  it("una instantánea conserva los datos aunque el catálogo vivo cambie", () => {
    const snap = snapshotOf(["real-madrid"]);
    const live = CLUBS.find((c) => c.id === "real-madrid")!;
    const original = live.ovr;
    live.ovr = 99; // simula una actualización posterior del catálogo
    try {
      expect(getTeam("real-madrid")?.ovr).toBe(99);
      expect(getTeam("real-madrid", snap)?.ovr).toBe(original);
      setActiveSnapshot(snap);
      expect(getTeam("real-madrid")?.ovr).toBe(original);
    } finally {
      live.ovr = original;
      setActiveSnapshot(undefined);
    }
  });
});
