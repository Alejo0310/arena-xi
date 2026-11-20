import { expect, test, type Page } from "@playwright/test";

export type Mode = "Ruleta" | "Sobres" | "Tómbola" | "Draft" | "Bombos";

export async function shot(page: Page, name: string) {
  const dir = process.env.E2E_SHOTS;
  if (!dir) return;
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${dir}/${test.info().project.name}-${name}.png` });
}

export async function confirm(page: Page) {
  await page.getByRole("alertdialog").getByRole("button").last().click();
}

/** Crea un torneo desde la portada y llega a la elección de modalidad de sorteo. */
export async function setup(page: Page, names: string[], opts: { format?: "Liga" | "Eliminatorias"; category?: "Clubes" | "Selecciones" } = {}) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.getByRole("button", { name: /Crear torneo/ }).click();
  await expect(page).toHaveURL(/\/nuevo/);
  const input = page.getByPlaceholder(/Nombre del jugador/);
  await input.fill(names.join(", "));
  await input.press("Enter");
  for (const n of names) await expect(page.getByRole("button", { name: `Eliminar ${n}` })).toBeVisible();
  if (opts.format) await page.getByRole("button", { name: new RegExp(`^${opts.format}`) }).click();
  if (opts.category === "Selecciones") await page.getByRole("tab", { name: /Selecciones masculinas/ }).click();
  await page.getByRole("button", { name: /Ir al sorteo/ }).click();
  await expect(page).toHaveURL(/\/sorteo/);
}

export async function chooseMode(page: Page, mode: Mode) {
  await page.getByRole("button", { name: new RegExp(`^${mode}`) }).click();
  await expect(page.getByTestId("turn-banner")).toBeVisible();
}

/** Acción que inicia el sorteo del turno según la mecánica. */
export async function startTurn(page: Page, mode: Mode) {
  if (mode === "Sobres") return page.getByRole("button", { name: /^Abrir sobre/ }).first().click();
  if (mode === "Draft") return page.getByRole("button", { name: /^Elegir / }).first().click();
  return page.getByTestId("draw-action").click();
}

/**
 * Un turno completo con todas las comprobaciones de sincronización.
 * Devuelve el equipo revelado.
 */
export async function playTurn(page: Page, mode: Mode, index: number, total: number): Promise<{ participant: string; team: string }> {
  const name = (await page.getByTestId("turn-name").textContent())!.trim();
  await expect(page.getByTestId("turn-count")).toHaveText(new RegExp(`Participante ${index} de ${total}`, "i"));
  await startTurn(page, mode);

  // Durante la animación: mismo participante, mismo contador, sin resultado final ni conformación.
  await expect(page.getByTestId("turn-name")).toHaveText(name);
  await expect(page.getByTestId("turn-count")).toHaveText(new RegExp(`Participante ${index} de ${total}`, "i"));
  await expect(page.getByTestId("draw-complete")).toHaveCount(0);
  if (mode !== "Sobres" && mode !== "Draft") await expect(page.getByTestId("draw-action")).toBeDisabled();

  const dialog = page.getByRole("dialog", { name: new RegExp(`^${name} recibe`) });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByTestId("reveal-participant")).toHaveText(name);
  const cont = dialog.getByRole("button", { name: "Continuar" });
  await expect(cont).toBeVisible({ timeout: 10_000 });
  // Aun con el resultado revelado, la conformación final no aparece hasta confirmar.
  await expect(page.getByTestId("draw-complete")).toHaveCount(0);
  const team = (await dialog.getByTestId("reveal-team").textContent())!.trim();
  await cont.click();
  await expect(dialog).toBeHidden();
  return { participant: name, team };
}

export async function assignedTeams(page: Page): Promise<string[]> {
  return page.locator("ol[aria-label='Orden del sorteo'] li svg[role='img']").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
}

/** Sorteo completo + presentación (se recorre o se salta). */
export async function fullDraw(page: Page) {
  await page.getByRole("button", { name: /Sorteo completo/ }).click();
  await confirm(page);
  const skip = page.getByRole("button", { name: /Saltar presentación/ });
  if (await skip.isVisible({ timeout: 8000 }).catch(() => false)) await skip.click();
  else {
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Ver equipos|Siguiente/ }).click();
  }
  await expect(page.getByTestId("draw-complete")).toBeVisible({ timeout: 10_000 });
}
