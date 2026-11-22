import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_RE, DATA_RE, ID_RE, isShortId, randomSuffix, sanitizeSlug, suggestSlug } from "../shortLink";
import { POST } from "../../app/api/compartir/route";
import { GET } from "../../app/api/compartir/[id]/route";

describe("nombres de enlace", () => {
  it("sugiere un nombre legible sin acentos ni símbolos", () => {
    expect(suggestSlug("Gran Premio Galáctica Season 1")).toBe("GranPremioGalacticaSeason1");
    expect(suggestSlug("Copa del Sofá")).toBe("CopaDelSofa");
    expect(suggestSlug("TORNEO DEL SEXO")).toBe("TorneoDelSexo");
    expect(suggestSlug("  ¡¡¡  ")).toBe("Torneo");
    expect(suggestSlug("a".repeat(80)).length).toBe(32);
    expect(BASE_RE.test(suggestSlug("Torneo Ñandú 2026!"))).toBe(true);
  });
  it("respeta lo que escribe el usuario y lo sanea", () => {
    expect(sanitizeSlug("MiCopa")).toBe("MiCopa");
    expect(sanitizeSlug("mi copa de amigos")).toBe("MiCopaDeAmigos");
    expect(sanitizeSlug("../../etc/passwd")).toBe("etcpasswd");
    expect(sanitizeSlug("<script>")).toBe("script");
    expect(sanitizeSlug("###")).toBe("Torneo");
  });
  it("el sufijo es de 6 caracteres y distinto entre llamadas", () => {
    const a = randomSuffix(), b = randomSuffix();
    expect(a).toMatch(/^[a-z0-9]{6}$/);
    expect(a).not.toBe(b);
    expect(isShortId(`CopaDelSofa-${a}`)).toBe(true);
    expect(isShortId("v3.abc")).toBe(false);
    expect(ID_RE.test("x".repeat(100))).toBe(false);
  });
  it("solo se aceptan datos compactos v2/v3", () => {
    expect(DATA_RE.test("v3.zAbC-_09")).toBe(true);
    expect(DATA_RE.test("v2.N4Ig+$-")).toBe(true);
    expect(DATA_RE.test("<script>")).toBe(false);
    expect(DATA_RE.test("v3.a b")).toBe(false);
  });
});

/** Redis en memoria detrás de la API REST de Upstash (comandos SET NX EX, GET, INCR, EXPIRE). */
function fakeUpstash() {
  const store = new Map<string, string>();
  return {
    store,
    fetch: vi.fn(async (_url: string, init: RequestInit) => {
      const [c, ...a] = JSON.parse(init.body as string) as (string | number)[];
      let result: unknown = null;
      if (c === "SET") result = a[2] === "NX" && store.has(String(a[0])) ? null : (store.set(String(a[0]), String(a[1])), "OK");
      if (c === "GET") result = store.get(String(a[0])) ?? null;
      if (c === "INCR") { const n = Number(store.get(String(a[0])) ?? 0) + 1; store.set(String(a[0]), String(n)); result = n; }
      if (c === "EXPIRE") result = 1;
      return new Response(JSON.stringify({ result }), { status: 200 });
    }),
  };
}

const req = (body: unknown, ip = "1.1.1.1") => new Request("http://x/api/compartir", { method: "POST", headers: { "x-forwarded-for": ip, "content-type": "application/json" }, body: JSON.stringify(body) });
const idParam = (id: string) => ({ params: Promise.resolve({ id }) });

describe("API de enlaces cortos", () => {
  beforeEach(() => { vi.stubEnv("KV_REST_API_URL", "https://kv.test"); vi.stubEnv("KV_REST_API_TOKEN", "t"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("sin almacenamiento configurado responde 501 (la app usa el enlace largo)", async () => {
    vi.unstubAllEnvs();
    expect((await POST(req({ data: "v3.abc", base: "Copa" }))).status).toBe(501);
    expect((await GET(new Request("http://x"), idParam("Copa-abc123"))).status).toBe(501);
  });

  it("guarda y recupera; el mismo nombre dos veces da identificadores distintos", async () => {
    const kv = fakeUpstash();
    vi.stubGlobal("fetch", kv.fetch);
    const a = await (await POST(req({ data: "v3.zDatosA", base: "GranPremio" }))).json();
    const b = await (await POST(req({ data: "v3.zDatosB", base: "GranPremio" }))).json();
    expect(a.id).toMatch(ID_RE);
    expect(b.id).toMatch(ID_RE);
    expect(a.id).not.toBe(b.id);
    expect(a.id.startsWith("GranPremio-")).toBe(true);
    expect(await (await GET(new Request("http://x"), idParam(a.id))).json()).toEqual({ data: "v3.zDatosA" });
    expect(await (await GET(new Request("http://x"), idParam(b.id))).json()).toEqual({ data: "v3.zDatosB" });
    expect((await GET(new Request("http://x"), idParam("NoExiste-abc123"))).status).toBe(404);
    expect((await GET(new Request("http://x"), idParam("../etc"))).status).toBe(400);
  });

  it("reintenta si el identificador ya existe y nunca sobrescribe", async () => {
    const kv = fakeUpstash();
    vi.stubGlobal("fetch", kv.fetch);
    const seq = ["aaaaaa", "aaaaaa", "bbbbbb"]; // la 1.ª colisiona con una existente
    kv.store.set("c:Copa-aaaaaa", "v3.original");
    const mod = await import("../shortLink");
    const spy = vi.spyOn(mod, "randomSuffix").mockImplementation(() => seq.shift()!);
    const res = await (await POST(req({ data: "v3.nuevo", base: "Copa" }))).json();
    spy.mockRestore();
    expect(kv.store.get("c:Copa-aaaaaa")).toBe("v3.original");
    expect(res.id).toBe("Copa-bbbbbb");
    expect(kv.store.get("c:Copa-bbbbbb")).toBe("v3.nuevo");
  });

  it("rechaza datos o nombres inválidos y limita las creaciones por hora", async () => {
    const kv = fakeUpstash();
    vi.stubGlobal("fetch", kv.fetch);
    expect((await POST(req({ data: "<script>", base: "Copa" }))).status).toBe(400);
    expect((await POST(req({ data: "v3.ok", base: "../Copa" }))).status).toBe(400);
    expect((await POST(req({ data: "v3." + "a".repeat(13_000), base: "Copa" }))).status).toBe(400);
    expect((await POST(new Request("http://x", { method: "POST", body: "no json" }))).status).toBe(400);
    let last = 200;
    for (let i = 0; i < 25; i++) last = (await POST(req({ data: "v3.x", base: "Copa" }, "9.9.9.9"))).status;
    expect(last).toBe(429);
    expect((await POST(req({ data: "v3.x", base: "Copa" }, "8.8.8.8"))).status).toBe(200); // otra IP no se ve afectada
  });
});
