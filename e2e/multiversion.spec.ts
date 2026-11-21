import { expect, test, type Page } from "@playwright/test";
import { confirm, shot } from "./helpers";

const STORE = "arena-xi";
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), STORE);

async function freshSetup(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/nuevo");
  await expect(page.getByRole("radiogroup", { name: /Edición/ })).toBeVisible();
}

test.describe("multiversión", () => {
  test("el selector muestra FC 25, FC 26 y FC 27 y FC 25 viene seleccionado", async ({ page }) => {
    await freshSetup(page);
    for (const e of ["FC25", "FC26", "FC27"]) await expect(page.locator(`[data-edition='${e}']`)).toBeVisible();
    await expect(page.locator("[data-edition='FC25']")).toHaveAttribute("aria-checked", "true");
    await shot(page, "edition-selector");
  });

  test("cambiar de edición pide confirmación y carga un catálogo propio sin mezclar", async ({ page }) => {
    await freshSetup(page);
    // FC 25 trae 12 clubes por defecto: cambiar de edición avisa de que se reinician.
    await page.locator("[data-edition='FC26']").click();
    await expect(page.getByRole("alertdialog")).toContainText(/se reiniciar/i);
    await confirm(page);
    await expect(page.locator("[data-edition='FC26']")).toHaveAttribute("aria-checked", "true");

    // Catálogo FC 26: clubes con id de FC 26, sin ningún id de FC 25 y sin valoraciones inventadas.
    const grid = page.getByTestId("team-grid");
    await expect(grid.locator("[data-team]").first()).toBeVisible();
    const ids = await grid.locator("[data-team]").evaluateAll((els) => els.map((e) => e.getAttribute("data-team")!));
    expect(ids.length).toBeGreaterThan(10);
    expect(ids.every((id) => id.startsWith("fc26:"))).toBe(true);
    await expect(page.getByText(/sin valoraciones verificadas/i).first()).toBeVisible();
    await expect(page.getByText("—").first()).toBeVisible();

    // Cuatro categorías.
    for (const cat of ["club-men", "club-women", "national-men", "national-women"]) await expect(page.locator(`[data-category='${cat}']`)).toBeVisible();

    // Selecciones masculinas FC 26: Brasil NO está y aparece en "no disponibles".
    await page.locator("[data-category='national-men']").click();
    await expect(page.getByTestId("team-grid").locator("[data-team]").first()).toBeVisible();
    await expect(page.getByTestId("team-grid").getByText("Brasil", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Selecciones no disponibles" })).toContainText("Brasil");

    // Volver a FC 25 restaura sus datos verificados.
    await page.locator("[data-edition='FC25']").click(); // el pool de FC 26 estaba vacío: no hay nada que perder
    await page.locator("[data-category='club-men']").click();
    await expect(page.locator("[data-team='real-madrid']")).toBeVisible();
  });

  test("filtros: continente, licencia y buscador en FC 27", async ({ page }) => {
    await page.goto("/equipos");
    await page.getByRole("tab", { name: "FC 27" }).click();
    await page.locator("[data-category='national-men']").click();
    const cards = page.getByTestId("team-grid").locator("[data-team]");
    await expect(cards.first()).toBeVisible();
    const count = async () => Number((await page.getByText(/^\d+ de \d+ ·/).textContent())!.match(/^(\d+)/)![1]);
    const all = await count();
    await page.getByLabel("Continente").selectOption("Sudamérica");
    await expect.poll(count).toBeLessThan(all);
    const sud = await count();
    expect(sud).toBeGreaterThan(0);
    expect(sud).toBeLessThan(all);
    await page.getByLabel("Licencia").selectOption("generic");
    await expect.poll(async () => (await cards.allInnerTexts()).every((t) => /genérico/i.test(t))).toBe(true);
    expect(await cards.count()).toBeGreaterThan(0);
    await page.getByLabel("Licencia").selectOption("");
    await page.getByPlaceholder(/Buscar selección/).fill("Brasil");
    await expect(cards).toHaveCount(1);
    // Mujeres FC 27 incluye Brasil; mujeres FC 26 no.
    await page.locator("[data-category='national-women']").click();
    await page.getByPlaceholder(/Buscar selección/).fill("Brasil");
    await expect(cards).toHaveCount(1);
    await page.getByRole("tab", { name: "FC 26" }).click();
    await page.getByPlaceholder(/Buscar selección/).fill("Brasil");
    await expect(cards).toHaveCount(0);
  });

  test("un torneo de FC 26 se identifica en el historial y conserva sus datos congelados", async ({ page }) => {
    await freshSetup(page);
    await page.locator("[data-edition='FC26']").click();
    await confirm(page);
    const grid = page.getByTestId("team-grid");
    await expect(grid.locator("[data-team]").first()).toBeVisible();
    const input = page.getByPlaceholder(/Nombre del jugador/);
    await input.fill("Ana, Beto");
    await input.press("Enter");
    await page.getByRole("button", { name: /Añadir visibles/ }).click();
    const t = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).state.current, STORE);
    expect(t.settings.edition).toBe("FC26");
    expect(t.teamPool.length).toBeGreaterThan(5);
    expect(t.teamPool.every((id: string) => id.startsWith("fc26:") && t.snapshot[id])).toBe(true);
    expect(Object.values(t.snapshot as Record<string, { ovr: number | null }>).every((x) => x.ovr === null)).toBe(true);
  });
});

test.describe("simulaciones de sorteo", () => {
  const MODES = ["roulette", "envelopes", "machine", "draft", "pots"] as const;

  async function run(page: Page, mode: (typeof MODES)[number]) {
    if (mode === "roulette" || mode === "machine" || mode === "pots") await page.getByTestId("sim-action").click();
    if (mode === "envelopes") await page.getByTestId("sim-envelope").nth(2).click();
    if (mode === "draft") await page.getByTestId("sim-card").nth(1).click();
    if (mode === "draft") await expect(page.getByText(/Te quedas con/)).toBeVisible({ timeout: 15_000 });
    else await expect(page.getByTestId("sim-result")).toBeVisible({ timeout: 20_000 });
  }

  test("las cinco se ejecutan, se repiten, se cierran y no tocan el torneo", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/");
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ state: { current: null, history: [], sound: false }, version: 2 })), STORE);
    const before = await stored(page);

    for (const mode of MODES) {
      await page.locator(`[data-sim-card='${mode}']`).click();
      await expect(page.getByTestId("sim-panel")).toBeVisible();
      await expect(page.getByTestId("sim-data-label")).toContainText(/ejemplo|FC 2/);
      await run(page, mode);
      // Repetir: vuelve al estado inicial y vuelve a funcionar.
      await page.getByTestId("sim-repeat").click();
      await expect(page.getByTestId("sim-result")).toHaveCount(0);
      await run(page, mode);
    }
    // Cambiar de modalidad cierra la anterior (un solo panel) y no deja resultados viejos.
    await page.locator("[data-sim-card='roulette']").click();
    await expect(page.getByTestId("sim-panel")).toHaveCount(1);
    await expect(page.getByTestId("sim-result")).toHaveCount(0);
    await page.getByTestId("sim-close").click();
    await expect(page.getByTestId("sim-panel")).toHaveCount(0);

    // Ninguna demostración modifica el almacenamiento de torneos.
    expect(await stored(page)).toBe(before);
    await expect(page).toHaveURL(/\/$/);
  });

  test("el resultado de la ruleta coincide con el sector bajo el puntero", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-sim-card='roulette']").click();
    await page.getByTestId("sim-action").click();
    const result = page.getByTestId("sim-result");
    await expect(result).toBeVisible({ timeout: 20_000 });
    const name = (await result.locator(".display").first().textContent())!.trim();
    // El sector situado arriba (bajo el puntero) es el del equipo anunciado.
    const top = await page.evaluate(() => {
      const svg = document.querySelector("[role='img'][aria-label^='Ruleta de ejemplo']") as SVGSVGElement;
      const m = new DOMMatrix(getComputedStyle(svg).transform === "none" ? undefined : getComputedStyle(svg).transform);
      const rot = (Math.atan2(m.b, m.a) * 180) / Math.PI;
      const groups = [...svg.querySelectorAll(":scope > g")];
      const seg = 360 / groups.length;
      const under = (((-rot % 360) + 360) % 360) / seg;
      return (groups[Math.floor(under)].querySelector("text") as SVGTextElement).textContent;
    });
    expect(top).toBeTruthy();
    // El texto del sector es la sigla (short) del equipo anunciado.
    const short = await page.evaluate(() => (document.querySelector("[data-testid='sim-result']") as HTMLElement).textContent);
    expect(short).toContain(name);
  });
});

test.describe("footer", () => {
  test("todos los enlaces tienen destino y GitHub abre en pestaña nueva", async ({ page, context }) => {
    const page2 = await context.newPage();
    await page.goto("/");
    const footer = page.getByTestId("footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toContainText("QUE GANE EL MEJOR");
    await expect(footer).toContainText("FC 25");
    await expect(footer.getByTestId("footer-disclaimer")).toHaveText(
      "ARENA XI es un proyecto independiente, sin afiliación, patrocinio ni respaldo oficial de EA SPORTS o Electronic Arts. EA SPORTS FC es una marca de Electronic Arts.",
    );
    await expect(footer).toContainText(String(new Date().getFullYear()));

    const gh = footer.getByTestId("footer-github");
    await expect(gh).toHaveAttribute("href", "https://github.com/Alejo0310/arena-xi");
    await expect(gh).toHaveAttribute("target", "_blank");
    await expect(gh).toHaveAttribute("rel", /noopener/);

    const links = await footer.locator("a[href]").evaluateAll((as) => as.map((a) => ({ href: a.getAttribute("href")!, text: a.textContent!.trim() })));
    expect(links.length).toBeGreaterThan(20);
    for (const { href, text } of links) {
      expect(href, `enlace vacío: ${text}`).not.toMatch(/^(#|)$/);
      if (/^https?:/.test(href)) {
        expect(href).toMatch(/^https:\/\/github\.com\/Alejo0310\/arena-xi/);
        continue;
      }
      const [path, hash] = href.split("#");
      const res = await page2.goto(path || "/");
      expect(res?.status(), `${href} debe responder`).toBe(200);
      if (hash) await expect(page2.locator(`#${hash}`), `${href}: falta el ancla #${hash}`).toBeAttached({ timeout: 15_000 });
    }
  });

  test("aparece en las páginas principales y no en proyección; es vertical en móvil", async ({ page }) => {
    for (const p of ["/", "/nuevo", "/equipos", "/historial", "/acerca"]) {
      await page.goto(p);
      await expect(page.getByTestId("footer")).toBeVisible();
    }
    await page.goto("/proyeccion");
    await expect(page.getByTestId("footer")).toHaveCount(0);
    await page.goto("/acerca");
    const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
    expect(noHScroll).toBe(true);
  });

  test("los enlaces profundos funcionan: ?tab, ?cat y #sorteos", async ({ page }) => {
    await page.goto("/equipos?cat=national-women");
    await expect(page.locator("[data-category='national-women']")).toHaveAttribute("aria-selected", "true");
    await page.goto("/");
    await page.getByTestId("footer").getByRole("link", { name: "Modalidades de sorteo" }).first().click();
    await expect(page).toHaveURL(/#sorteos/);
    await expect(page.locator("#sorteos")).toBeVisible();
  });
});

test.describe("bombos sin valoración", () => {
  test("FC 26 avisa de los equipos sin valoración y permite bombos equilibrados y manuales", async ({ page }) => {
    await freshSetup(page);
    await page.locator("[data-edition='FC26']").click();
    await confirm(page);
    await expect(page.getByTestId("team-grid").locator("[data-team]").first()).toBeVisible();
    await expect(page.getByTestId("no-rating").first()).toBeVisible();
    await page.getByLabel("Liga", { exact: true }).selectOption("Premier League");
    await page.getByLabel("Valoración", { exact: true }).selectOption("unrated");
    await page.getByRole("button", { name: /Añadir visibles/ }).click();
    const input = page.getByPlaceholder(/Nombre del jugador/);
    await input.fill("Ana, Beto, Caro, Dani");
    await input.press("Enter");
    await page.getByRole("button", { name: /Ir al sorteo/ }).click();
    await page.getByRole("button", { name: /^Bombos/ }).click();

    await expect(page.getByTestId("pots-unrated-note")).toContainText(/equipos sin valoración verificada/);
    await expect(page.locator("[data-pots-method='rating']")).toBeDisabled();
    await expect(page.getByTestId("pots-start")).toBeEnabled(); // el sorteo no queda bloqueado

    // Manual: sin asignar no se puede iniciar.
    await page.locator("[data-pots-method='manual']").click();
    await expect(page.getByTestId("pots-start")).toBeDisabled();
    await page.getByRole("button", { name: /Prellenar al azar/ }).click();
    await expect(page.getByTestId("pots-start")).toBeEnabled();
    await page.locator("[data-pots-method='balanced']").click();
    await page.getByTestId("pots-start").click();
    await expect(page.getByTestId("pots-method")).toContainText("Aleatorios equilibrados");
    await expect(page.getByTestId("turn-banner")).toBeVisible();
    const t = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).state.current, STORE);
    expect(t.draw.potsMethod).toBe("balanced");
    expect(t.potsConfig.method).toBe("balanced");
    expect((t.draw.pots as string[][]).flat().length).toBe(t.teamPool.length);
  });
});
