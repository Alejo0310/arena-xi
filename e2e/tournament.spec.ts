import { expect, test, type Page } from "@playwright/test";

const SHOTS = process.env.E2E_SHOTS;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png`, fullPage: false });
}

async function confirm(page: Page) {
  await page.getByRole("alertdialog").getByRole("button").last().click();
}

async function setup(page: Page, names: string[], format: "Liga" | "Eliminatorias") {
  await page.goto("/");
  await page.getByRole("button", { name: /Crear torneo/ }).click();
  await expect(page).toHaveURL(/\/nuevo/);
  await page.getByPlaceholder(/Nombre del jugador/).fill(names.join(", "));
  await page.getByPlaceholder(/Nombre del jugador/).press("Enter");
  for (const n of names) await expect(page.getByRole("button", { name: `Eliminar ${n}` })).toBeVisible();
  // Duplicados bloqueados
  await page.getByPlaceholder(/Nombre del jugador/).fill(names[0].toUpperCase());
  await page.getByPlaceholder(/Nombre del jugador/).press("Enter");
  await expect(page.getByText(/ya está inscrito/)).toBeVisible();
  await page.getByPlaceholder(/Nombre del jugador/).fill("");
  await page.getByRole("button", { name: new RegExp(`^${format}`) }).click();
  await shot(page, `setup-${format}`);
  await page.getByRole("button", { name: /Ir al sorteo/ }).click();
  await expect(page).toHaveURL(/\/sorteo/);
}

async function closeReveal(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: /Continuar|Siguiente/ })).toBeVisible({ timeout: 15_000 });
  await shot(page, "reveal");
  await dialog.getByRole("button", { name: /Continuar|Siguiente/ }).click();
  await expect(dialog).toBeHidden();
}

async function fullDraw(page: Page) {
  await page.getByRole("button", { name: /Sorteo completo/ }).click();
  await confirm(page);
  await page.getByRole("button", { name: /Saltar/ }).click().catch(() => {});
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible()) await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: /Sorteo completado/ })).toBeVisible();
}

async function assignedTeamsAreUnique(page: Page, n: number) {
  const teams = await page.locator("ol li svg[aria-label^='Insignia de']").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(teams).toHaveLength(n);
  expect(new Set(teams).size).toBe(n);
}

async function playAll(page: Page) {
  await page.getByRole("tab", { name: /Partidos|Calendario/ }).click();
  // Espera a que termine la transición de pestañas (la anterior también tiene tarjetas).
  await expect(page.getByText("Próximos enfrentamientos")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Registrar$/ }).first()).toBeVisible();
  for (let guard = 0; guard < 40; guard++) {
    const card = page.locator(".glass").filter({ has: page.getByRole("button", { name: /^Registrar$/ }) }).first();
    if (!(await card.count())) break;
    const inputs = card.locator("input.score-input");
    await inputs.nth(0).fill(String(guard % 4));
    await inputs.nth(1).fill(String((guard + 1) % 3));
    if ((guard % 4) === ((guard + 1) % 3) && (await inputs.count()) === 2) {
      // Empate en eliminatoria: aparecen los penaltis tras re-render.
      await page.waitForTimeout(100);
    }
    const all = card.locator("input.score-input");
    if ((await all.count()) === 4) {
      await all.nth(2).fill("5");
      await all.nth(3).fill("4");
    }
    await card.getByRole("button", { name: /^Registrar$/ }).click();
    await page.waitForTimeout(150);
  }
}

test("liga completa con 5 jugadores (impar), sorteo por ruleta y persistencia", async ({ page }) => {
  const names = ["Ana", "Beto", "Carla", "Dani", "Eva"];
  await setup(page, names, "Liga");
  await page.getByRole("button", { name: /^Ruleta/ }).click();
  await shot(page, "roulette");
  await page.getByRole("button", { name: /Girar la ruleta/ }).click();
  await closeReveal(page);
  await fullDraw(page);
  await assignedTeamsAreUnique(page, 5);
  await shot(page, "draw-complete");
  await page.getByRole("button", { name: /Comenzar torneo/ }).click();
  await expect(page).toHaveURL(/\/torneo/);
  await shot(page, "dashboard-start");

  // 5 jugadores → 10 partidos, 5 jornadas con descanso
  await page.getByRole("tab", { name: /Calendario/ }).click();
  await expect(page.getByText(/Descansa/)).toHaveCount(5);
  await playAll(page);
  await expect(page.getByRole("dialog", { name: /es el campeón/ })).toBeVisible({ timeout: 10_000 });
  await shot(page, "champion");
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: /Tabla/ }).click();
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(5);
  // Cada jugador disputa 4 partidos.
  for (let i = 0; i < 5; i++) await expect(rows.nth(i).locator("td").nth(3)).toHaveText("4");
  await shot(page, "standings");

  await page.getByRole("tab", { name: /Estadísticas/ }).click();
  await expect(page.getByText("Máximo goleador")).toBeVisible();
  await shot(page, "stats");

  // Persistencia
  await page.reload();
  await expect(page.getByText(/Campeón del torneo/)).toBeVisible();

  // Edición de un resultado con confirmación
  await page.getByRole("tab", { name: /Calendario/ }).click();
  await page.getByRole("button", { name: /Editar/ }).first().click();
  await confirm(page);
  await expect(page.getByRole("button", { name: /^Guardar$/ })).toBeVisible();

  // Historial / ranking histórico
  await page.goto("/historial");
  await expect(page.getByText("Ranking histórico")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(5);
  await shot(page, "history");
});

test("eliminatorias con 6 jugadores: BYE, sobres, penaltis y tercer puesto", async ({ page }) => {
  const names = ["Leo", "Mia", "Nico", "Olga", "Pau", "Quique"];
  await setup(page, names, "Eliminatorias");
  await page.getByRole("button", { name: /^Sobres/ }).click();
  await shot(page, "envelopes");
  await page.getByRole("button", { name: "Abrir sobre 1" }).click();
  await closeReveal(page);
  await fullDraw(page);
  await assignedTeamsAreUnique(page, 6);
  await page.getByRole("button", { name: /Comenzar torneo/ }).click();

  await page.getByRole("tab", { name: /Llaves/ }).click();
  await expect(page.getByText("Cuartos de final").first()).toBeVisible();
  await expect(page.getByText("BYE")).toHaveCount(2);
  await shot(page, "bracket-start");

  await playAll(page);
  await expect(page.getByRole("dialog", { name: /es el campeón/ })).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: /Llaves/ }).click();
  await expect(page.getByText("Tercer puesto").first()).toBeVisible();
  await shot(page, "bracket-final");
});

for (const mode of ["Tómbola", "Draft", "Bombos"] as const) {
  test(`sorteo individual en modo ${mode}`, async ({ page }) => {
    await setup(page, ["Rita", "Sara", "Tomi", "Uri"], "Liga");
    await page.getByRole("button", { name: new RegExp(`^${mode}`) }).click();
    await shot(page, `mode-${mode}`);
    if (mode === "Tómbola") await page.getByRole("button", { name: /Sortear bola/ }).click();
    if (mode === "Bombos") await page.getByRole("button", { name: /Sortear del bombo/ }).click();
    if (mode === "Draft") await page.getByRole("button", { name: /^Elegir / }).first().click();
    await closeReveal(page);
    await fullDraw(page);
    await assignedTeamsAreUnique(page, 4);
  });
}

test("páginas secundarias cargan", async ({ page }) => {
  await page.goto("/equipos");
  await expect(page.getByText("Real Madrid").first()).toBeVisible();
  await page.getByPlaceholder("Buscar club...").fill("lombardia");
  await expect(page.getByText("Inter de Milán", { exact: false })).toBeVisible();
  await shot(page, "teams");
  await page.goto("/");
  await shot(page, "home");
});
