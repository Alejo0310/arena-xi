import { expect, test } from "@playwright/test";
import { assignedTeams, chooseMode, confirm, fullDraw, playTurn, setup, shot, startTurn, type Mode, clickCentered } from "./helpers";

const MODES: Mode[] = ["Ruleta", "Sobres", "Tómbola", "Draft", "Bombos"];
const PLAYERS = ["DA", "TA", "MA", "PA"];

// PRUEBAS 1, 3, 4 y 5: cada mecánica con 2, 3 (impar) y 4 participantes.
for (const mode of MODES) {
  for (const n of [2, 3, 4]) {
    test(`${mode}: ${n} participantes reciben equipo en secuencia sincronizada`, async ({ page }) => {
      test.skip(test.info().project.name === "mobile" && n !== 4, "En móvil basta el caso de 4 participantes");
      await setup(page, PLAYERS.slice(0, n));
      await chooseMode(page, mode);
      if (n === 4) await shot(page, `draw-${mode}-ready`);
      const seen = new Set<string>();
      const teams: string[] = [];
      for (let i = 1; i <= n; i++) {
        const r = await playTurn(page, mode, i, n);
        expect(seen.has(r.participant)).toBe(false);
        seen.add(r.participant);
        teams.push(r.team);
      }
      // PASO 5: finalización tras la animación del último participante.
      await expect(page.getByTestId("draw-complete")).toBeVisible();
      await expect(page.getByTestId("draw-complete")).toHaveText(/todos tienen equipo/i);
      expect(seen.size).toBe(n);
      expect(new Set(teams).size).toBe(n);
      const crests = await assignedTeams(page);
      expect(crests).toHaveLength(n);
      expect(new Set(crests).size).toBe(n);
      if (n === 4) await shot(page, `draw-${mode}-complete`);
    });
  }
}

// PRUEBA 7: interacciones agresivas.
test.describe("interacciones durante el sorteo", () => {
  test("doble clic rápido solo sortea una vez y no se puede avanzar mientras gira", async ({ page }) => {
    await setup(page, PLAYERS);
    await chooseMode(page, "Ruleta");
    const action = page.getByTestId("draw-action");
    await action.dblclick({ force: true });
    await action.click({ force: true }).catch(() => {});
    await expect(page.getByRole("button", { name: /Sorteo completo/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Reiniciar/ })).toBeDisabled();
    await expect(page.getByTestId("turn-count")).toHaveText(/Participante 1 de 4/i);
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Continuar" }).click({ timeout: 20_000 });
    await expect(page.locator("ol[aria-label='Orden del sorteo'] li[data-assigned='true']")).toHaveCount(1);
    await expect(page.getByTestId("turn-count")).toHaveText(/Participante 2 de 4/i);
  });

  test("cambiar de pantalla y recargar durante la animación no repite ni pierde el resultado", async ({ page }) => {
    await setup(page, PLAYERS);
    await chooseMode(page, "Tómbola");
    const first = (await page.getByTestId("turn-name").textContent())!.trim();
    await startTurn(page, "Tómbola");
    // Navega a otra sección en plena animación y vuelve.
    // Navegación interna (SPA); en móvil el enlace está dentro del menú.
    const menu = page.getByRole("button", { name: "Menú" });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole("link", { name: /Equipos/ }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/equipos/);
    await page.goto("/sorteo");
    let dialog = page.getByRole("dialog", { name: new RegExp(`^${first} recibe`) });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const team = (await dialog.getByTestId("reveal-team").textContent())!.trim();
    await dialog.getByRole("button", { name: "Continuar" }).click();
    await expect(page.locator("ol[aria-label='Orden del sorteo'] li[data-assigned='true']")).toHaveCount(1);

    // Recarga en plena animación del segundo turno.
    const second = (await page.getByTestId("turn-name").textContent())!.trim();
    await startTurn(page, "Tómbola");
    await page.reload();
    dialog = page.getByRole("dialog", { name: new RegExp(`^${second} recibe`) });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const team2 = (await dialog.getByTestId("reveal-team").textContent())!.trim();
    expect(team2).not.toBe(team);
    await dialog.getByRole("button", { name: "Continuar" }).click();
    await expect(page.locator("ol[aria-label='Orden del sorteo'] li[data-assigned='true']")).toHaveCount(2);
    await expect(page.getByTestId("turn-count")).toHaveText(/Participante 3 de 4/i);
  });

  test("reiniciar el sorteo borra las asignaciones y vuelve al primer turno", async ({ page }) => {
    await setup(page, PLAYERS);
    await chooseMode(page, "Bombos");
    await playTurn(page, "Bombos", 1, 4);
    await page.getByRole("button", { name: /Reiniciar/ }).click();
    await confirm(page);
    await expect(page.getByTestId("turn-count")).toHaveText(/Participante 1 de 4/i);
    await expect(page.locator("ol[aria-label='Orden del sorteo'] li[data-assigned='true']")).toHaveCount(0);
    await fullDraw(page);
    const crests = await assignedTeams(page);
    expect(new Set(crests).size).toBe(4);
  });
});

// PRUEBA 6: categorías.
test.describe("categorías", () => {
  test("un torneo de selecciones solo sortea selecciones y uno de clubes solo clubes", async ({ page }) => {
    await setup(page, PLAYERS, { category: "Selecciones" });
    await chooseMode(page, "Ruleta");
    await expect(page.getByText(/Torneo de selecciones|Selecciones/).first()).toBeVisible();
    await playTurn(page, "Ruleta", 1, 4);
    await fullDraw(page);
    const nat = await assignedTeams(page);
    expect(nat).toHaveLength(4);
    expect(nat.every((l) => l.startsWith("Bandera de la selección"))).toBe(true);
    await shot(page, "nationals-complete");

    await setup(page, PLAYERS, { category: "Clubes" });
    await chooseMode(page, "Draft");
    await fullDraw(page);
    const clubs = await assignedTeams(page);
    expect(clubs.every((l) => l.startsWith("Insignia de"))).toBe(true);
  });

  test("cambiar de categoría con un sorteo en curso pide confirmación y reinicia el sorteo", async ({ page }) => {
    await setup(page, PLAYERS);
    await chooseMode(page, "Ruleta");
    await playTurn(page, "Ruleta", 1, 4);
    await page.goto("/nuevo");
    await clickCentered(page.getByRole("tab", { name: /Selecciones masculinas/ }));
    await expect(page.getByRole("alertdialog")).toContainText(/no se pueden mezclar/i);
    await confirm(page);
    await expect(page.getByRole("tab", { name: /Selecciones masculinas/ })).toHaveAttribute("aria-selected", "true");
    await shot(page, "setup-nationals");
    await page.getByRole("button", { name: /Ir al sorteo/ }).click();
    // El sorteo anterior se descartó: vuelve a la elección de modalidad.
    await expect(page.getByRole("button", { name: /^Ruleta/ })).toBeVisible();
  });

  test("la base de datos separa clubes y selecciones", async ({ page }) => {
    await page.goto("/equipos");
    await expect(page.locator("[data-team='real-madrid']")).toBeVisible();
    await expect(page.locator("[data-team='nat-france']")).toHaveCount(0);
    await clickCentered(page.getByRole("tab", { name: /Selecciones masculinas/ }));
    await expect(page.locator("[data-team='nat-france']")).toBeVisible();
    await expect(page.locator("[data-team='real-madrid']")).toHaveCount(0);
    await expect(page.locator("[data-team^='nat-']")).toHaveCount(10);
    await shot(page, "teams-nationals");
  });
});

// Movimiento reducido: el flujo no puede quedarse bloqueado sin animaciones.
test.describe("movimiento reducido", () => {
  test.use({ reducedMotion: "reduce" });
  for (const mode of MODES) {
    test(`${mode} completa el flujo con prefers-reduced-motion`, async ({ page }) => {
      test.skip(test.info().project.name === "mobile");
      await setup(page, ["DA", "TA"]);
      await chooseMode(page, mode);
      await playTurn(page, mode, 1, 2);
      await playTurn(page, mode, 2, 2);
      await expect(page.getByTestId("draw-complete")).toBeVisible();
    });
  }
});
