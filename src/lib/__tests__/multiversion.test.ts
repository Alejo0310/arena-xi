import { beforeAll, describe, expect, it } from "vitest";
import { loadCatalog, teamsFor, type Catalog } from "../catalog";
import { categoryError, sanitizePool, tournamentCategoryError } from "../category";
import { buildBalancedPots, buildPots, drawError, initDraw, manualPotsError, potsConfigError, ratingSplit } from "../draw";
import { getTeam, isRated, ratingStatusOf, snapshotOf, setActiveSnapshot, CLUBS } from "../teams";
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

  it("valoraciones: las de FC 26/27 vienen de la lista aportada (clubes), nunca de FC 25; las selecciones quedan sin valoración", () => {
    for (const e of ["FC26", "FC27"] as const) {
      const rated = cats[e].teams.filter((t) => t.ovr != null);
      expect(rated.length).toBeGreaterThan(600);
      for (const t of rated) {
        expect(t.kind).toBe("club");
        for (const v of [t.ovr, t.att, t.mid, t.def]) expect(v! >= 40 && v! <= 99).toBe(true); // ni nulos ni ceros disfrazados
        expect(t.ratingStatus).toBe("verified");
        expect(t.id.startsWith(e.toLowerCase() + ":") || cats.FC25.teams.every((x) => x.id !== t.id)).toBe(true);
      }
      expect(cats[e].teams.filter((t) => t.kind === "national" && t.ovr != null)).toHaveLength(0);
    }
    // Real Madrid: 85 en FC 26 y 85 en FC 27 según la lista; el equipo de FC 25 conserva su propio dato.
    const rm = (e: GameEdition) => cats[e].teams.find((t) => t.name === "Real Madrid" && t.gender === "men")!;
    expect([rm("FC26").ovr, rm("FC26").att]).toEqual([85, 90]);
    expect([rm("FC27").ovr, rm("FC27").att]).toEqual([85, 86]);
    expect(rm("FC26").id).not.toBe(rm("FC27").id);
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
    const pool = teamsFor("FC26", "club", "men").filter((t) => t.ovr == null).slice(0, 4).map((t) => t.id);
    expect(drawError(base("FC26", "club", "men", pool), "pots", { method: "rating" })).toMatch(/valoración/);
    expect(drawError(base("FC26", "club", "men", pool), "roulette")).toBeNull();
    const ok = base("FC25", "club", "men", ["real-madrid", "bayern", "arsenal", "psg"]);
    expect(drawError(ok, "pots", { method: "rating" })).toBeNull();
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

describe("bombos con equipos sin valoración", () => {
  const unrated = () => teamsFor("FC26", "club", "men").filter((t) => t.ovr == null).slice(0, 12).map((t) => t.id);
  const mixed = () => ["real-madrid", "bayern", "arsenal", "psg", ...unrated().slice(0, 4)];

  it("el método por valoración se rechaza si falta alguna valoración (no se usa 0 ni valores ficticios)", () => {
    expect(potsConfigError(unrated(), { method: "rating" }, 4, false, "FC26")).toMatch(/sin valoración|no tienen valoración/);
    expect(potsConfigError(mixed(), { method: "rating" }, 2, false)).toMatch(/4 equipos/);
    expect(potsConfigError(["real-madrid", "bayern", "arsenal", "psg"], { method: "rating" }, 2, false)).toBeNull();
    expect(ratingSplit(mixed())).toEqual({ rated: ["real-madrid", "bayern", "arsenal", "psg"], unrated: unrated().slice(0, 4) });
  });

  it("aleatorio equilibrado: todos asignados, sin duplicados, tamaños casi iguales y cada bombo con al menos n", () => {
    for (const [total, n] of [[12, 4], [13, 4], [11, 3], [8, 8], [30, 8]] as const) {
      const pool = teamsFor("FC27", "club", "men").slice(0, total).map((t) => t.id);
      const pots = buildBalancedPots(pool, n);
      expect(pots.flat().sort()).toEqual([...pool].sort());
      const sizes = pots.map((p) => p.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(n);
    }
  });

  it("manual: exige todos los equipos, sin repetidos y bombos suficientes", () => {
    const pool = unrated().slice(0, 8);
    const ok = [pool.slice(0, 4), pool.slice(4)];
    expect(manualPotsError(pool, ok, 4, false)).toBeNull();
    expect(manualPotsError(pool, [pool.slice(0, 4), pool.slice(4, 7)], 4, false)).toMatch(/Faltan 1/);
    expect(manualPotsError(pool, [pool.slice(0, 5), pool.slice(4)], 4, false)).toMatch(/repetidos/);
    expect(manualPotsError(pool, [pool.slice(0, 6), pool.slice(6)], 4, false)).toMatch(/bombo 2/);
    expect(manualPotsError(pool, [pool.slice(0, 6), pool.slice(6)], 4, true)).toBeNull();
  });

  it("el sorteo por bombos funciona con equipos sin valoración usando manual o equilibrado, y conserva el método", () => {
    const pool = unrated().slice(0, 8);
    const t = base("FC26", "club", "men", pool);
    expect(drawError(t, "pots", { method: "rating" })).toBeTruthy();
    expect(drawError(t, "pots", { method: "balanced" })).toBeNull();
    const st = initDraw(t, "pots", { method: "balanced" });
    expect(st.potsMethod).toBe("balanced");
    expect(st.pots!.flat().sort()).toEqual([...pool].sort());
    const manual = initDraw(t, "pots", { method: "manual", manualPots: [pool.slice(0, 4), pool.slice(4)] });
    expect(manual.potsMethod).toBe("manual");
    expect(manual.pool).toEqual(pool.slice(0, 4));
  });

  it("estado de valoración: null es 'no disponible', nunca verificado", () => {
    expect(ratingStatusOf(getTeam("real-madrid"))).toBe("verified");
    expect(ratingStatusOf(getTeam(unrated()[0]))).toBe("unavailable");
    expect(ratingStatusOf(undefined)).toBe("unavailable");
  });
});
