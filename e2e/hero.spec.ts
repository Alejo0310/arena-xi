import { expect, test } from "@playwright/test";
import { shot } from "./helpers";

test("hero: elemento visual protagonista sin desbordes ni errores", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const visual = page.getByTestId("hero-visual");
  await expect(visual).toBeVisible();
  // Sin desplazamiento horizontal
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  // Los botones principales siguen accesibles y no quedan tapados por el visual
  const cta = page.getByRole("button", { name: /Crear torneo/ });
  await expect(cta).toBeVisible();
  const box = (await cta.boundingBox())!;
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.textContent ?? "", [box.x + box.width / 2, box.y + box.height / 2]);
  expect(hit).toMatch(/Crear torneo/);

  if (test.info().project.name === "desktop") {
    // En escritorio con WebGL se carga el 3D de forma diferida.
    await expect(visual).toHaveAttribute("data-mode", "3d", { timeout: 15_000 });
    await expect(visual.locator("canvas")).toHaveCount(1);
    await shot(page, "hero-3d");
    await page.getByTestId("hero-draw").click();
    await expect(page.getByTestId("hero-draw-result")).toBeVisible({ timeout: 8000 });
    await shot(page, "hero-3d-draw");
    // Al salir de la portada se libera el contexto WebGL.
    await page.getByRole("link", { name: /Equipos/ }).first().click();
    await expect(page).toHaveURL(/equipos/);
    await expect(page.locator("canvas")).toHaveCount(1); // solo el canvas de partículas del fondo
  } else {
    await expect(visual).toHaveAttribute("data-mode", "css");
    await shot(page, "hero-css");
  }
  expect(errors).toEqual([]);
});

test.describe("hero con movimiento reducido", () => {
  test.use({ reducedMotion: "reduce" });
  test("usa la versión estática sin WebGL", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(3500);
    await expect(page.getByTestId("hero-visual")).toHaveAttribute("data-mode", "css");
    await expect(page.locator("canvas")).toHaveCount(1);
  });
});
