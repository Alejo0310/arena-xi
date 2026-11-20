import { expect, test, type Page } from "@playwright/test";
import { assignedTeams, chooseMode, confirm, fullDraw, playTurn, setup, shot } from "./helpers";

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
    const all = card.locator("input.score-input");
    if ((await all.count()) === 4) {
      await all.nth(2).fill("5");
      await all.nth(3).fill("4");
    }
    await card.getByRole("button", { name: /^Registrar$/ }).click();
    await page.waitForTimeout(150);
  }
}

test("liga completa con 5 jugadores (impar): sorteo, resultados, campeón y persistencia", async ({ page }) => {
  const names = ["Ana", "Beto", "Carla", "Dani", "Eva"];
  await setup(page, names, { format: "Liga" });
  await chooseMode(page, "Ruleta");
  await playTurn(page, "Ruleta", 1, 5);
  await fullDraw(page);
  const crests = await assignedTeams(page);
  expect(new Set(crests).size).toBe(5);
  await page.getByRole("button", { name: /Comenzar torneo/ }).click();
  await expect(page).toHaveURL(/\/torneo/);
  await shot(page, "dashboard-start");

  await page.getByRole("tab", { name: /Calendario/ }).click();
  await expect(page.getByText(/Descansa/)).toHaveCount(5);
  await playAll(page);
  await expect(page.getByRole("dialog", { name: /es el campeón/ })).toBeVisible({ timeout: 10_000 });
  await shot(page, "champion");
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: /Tabla/ }).click();
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(5);
  for (let i = 0; i < 5; i++) await expect(rows.nth(i).locator("td").nth(3)).toHaveText("4");
  await shot(page, "standings");

  await page.getByRole("tab", { name: /Estadísticas/ }).click();
  await expect(page.getByText("Máximo goleador")).toBeVisible();

  await page.reload();
  await expect(page.getByText(/Campeón del torneo/)).toBeVisible();

  await page.getByRole("tab", { name: /Calendario/ }).click();
  await page.getByRole("button", { name: /Editar/ }).first().click();
  await confirm(page);
  await expect(page.getByRole("button", { name: /^Guardar$/ })).toBeVisible();

  await page.goto("/historial");
  await expect(page.getByText("Ranking histórico")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(5);
});

test("eliminatorias de selecciones con 6 jugadores: BYE, penaltis y tercer puesto", async ({ page }) => {
  await setup(page, ["Leo", "Mia", "Nico", "Olga", "Pau", "Quique"], { format: "Eliminatorias", category: "Selecciones" });
  await chooseMode(page, "Sobres");
  await playTurn(page, "Sobres", 1, 6);
  await fullDraw(page);
  await page.getByRole("button", { name: /Comenzar torneo/ }).click();

  await page.getByRole("tab", { name: /Llaves/ }).click();
  await expect(page.getByText("Cuartos de final").first()).toBeVisible();
  await expect(page.getByText("BYE")).toHaveCount(2);

  await playAll(page);
  await expect(page.getByRole("dialog", { name: /es el campeón/ })).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: /Llaves/ }).click();
  await expect(page.getByText("Tercer puesto").first()).toBeVisible();
  await shot(page, "bracket-final");
});

test("identidad ARENA XI y páginas secundarias", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ARENA XI/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ARENA");
  await expect(page.getByText("Que gane el mejor").first()).toBeVisible();
  const html = await page.content();
  expect(html).not.toMatch(/FC25 Arena|Tournament Manager/);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  await shot(page, "home");
  await page.goto("/equipos");
  await expect(page).toHaveTitle(/Equipos.*ARENA XI/);
  await page.getByPlaceholder(/Buscar club/).fill("lombardia");
  await expect(page.getByText("Inter de Milán", { exact: false })).toBeVisible();
});
