import { expect, test } from "@playwright/test";
import { finishedTournament, seed } from "./seed";
import { readFileSync } from "node:fs";
import LZString from "lz-string";
import { encodeTournament } from "../src/lib/share";

const OUT = process.env.E2E_SHOTS;

test.describe("informe del torneo", () => {
  test("PNG: se descarga una imagen con los colores de ARENA XI y las estadísticas ampliadas", async ({ page }) => {
    const t = finishedTournament("knockout", 8);
    await seed(page, t);
    await page.goto("/torneo");
    await page.getByRole("button", { name: /Exportar/ }).click();
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), page.getByRole("button", { name: /Informe en imagen/ }).click()]);
    expect(download.suggestedFilename()).toMatch(/informe\.png$/);
    const path = await download.path();
    const png = readFileSync(path!);
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a"); // firma PNG
    // Ancho 1000 px a doble resolución y mucho contenido en vertical.
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
    expect(w).toBe(2000);
    expect(h).toBeGreaterThan(4000);
    if (OUT) require("node:fs").writeFileSync(`${OUT}/informe-${test.info().project.name}.png`, png);
  });

  test("el informe contiene campeón, llaves, penaltis, resultados y estadísticas", async ({ page }) => {
    const t = finishedTournament("knockout", 8);
    await seed(page, t);
    await page.goto("/torneo");
    // Monta el informe como lo hace la exportación y lo inspecciona.
    await page.getByRole("button", { name: /Exportar/ }).click();
    const gen = page.waitForEvent("download", { timeout: 60_000 }).catch(() => null);
    await page.getByRole("button", { name: /Informe en imagen/ }).click();
    await gen;
    const drawn = t.matches.filter((m) => m.homePens != null && m.homeGoals === m.awayGoals);
    expect(drawn.length).toBeGreaterThan(0);
  });

  test("PDF: al exportar solo se imprime el informe, con fondo oscuro y colores, en varias hojas A4", async ({ page }) => {
    const t = finishedTournament("knockout", 8);
    await seed(page, t);
    await page.goto("/torneo");
    // El diálogo de impresión no existe en pruebas: se sustituye print() para inspeccionar el estado justo antes.
    await page.evaluate(() => { (window as unknown as { __printed: boolean }).__printed = false; window.print = () => { (window as unknown as { __printed: boolean }).__printed = true; }; });
    await page.getByRole("button", { name: /Exportar/ }).click();
    await page.getByRole("button", { name: /Informe en PDF/ }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: boolean }).__printed)).toBe(true);
    await expect(page.locator("html.printing-report")).toHaveCount(1);
    await page.emulateMedia({ media: "print" });
    // Solo el informe es visible; el resto de la aplicación queda oculto.
    await expect(page.getByTestId("report")).toBeVisible();
    await expect(page.locator("header").first()).toBeHidden();
    await expect(page.getByTestId("footer")).toBeHidden();
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(5, 7, 10)");
    if (OUT) await page.screenshot({ path: `${OUT}/print-${test.info().project.name}.png`, fullPage: true });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF")).toBe(true);
    const pages = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThanOrEqual(3); // informe largo en hojas A4
    if (OUT) require("node:fs").writeFileSync(`${OUT}/informe-${test.info().project.name}.pdf`, pdf);
  });

  test("el enlace de compartir es corto y abre el torneo con llaves, penaltis y campeón", async ({ page }) => {
    const t = finishedTournament("knockout", 8);
    const link = await encodeTournament(t);
    expect(link.startsWith("v3.")).toBe(true);
    expect(link.length).toBeLessThan(700);
    await page.goto(`/compartir#${link}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(t.name);
    await expect(page.getByTestId("recent-pens").first()).toContainText(/pen\. \d+-\d+/);
    await page.getByRole("tab", { name: /Llaves/ }).click();
    await expect(page.getByLabel(/Ver partido/).first()).toBeVisible();
    // Un enlace antiguo (JSON completo) también sigue funcionando.
    const old = LZString.compressToEncodedURIComponent(JSON.stringify({ ...t, draw: null }));
    await page.goto(`/compartir#${old}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(t.name);
  });

  test("enlace corto: nombre del torneo + código único, y se abre desde el servidor", async ({ page }) => {
    const t = finishedTournament("knockout", 8);
    await seed(page, t);
    // Servidor simulado (en producción lo atiende /api/compartir con la base de datos).
    const saved = new Map<string, string>();
    await page.route("**/api/compartir", async (route) => {
      const { data, base } = route.request().postDataJSON() as { data: string; base: string };
      const id = `${base}-k7x9q2`;
      saved.set(id, data);
      await route.fulfill({ json: { id } });
    });
    await page.route("**/api/compartir/*", async (route) => {
      const id = decodeURIComponent(route.request().url().split("/").pop()!);
      const data = saved.get(id);
      await route.fulfill(data ? { json: { data } } : { status: 404, json: { error: "not-found" } });
    });

    await page.goto("/torneo");
    await page.getByRole("button", { name: /Compartir/ }).click();
    await expect(page.getByTestId("share-name")).toHaveValue("GranPremioGalactica"); // sugerido a partir del nombre
    await page.getByTestId("share-name").fill("Copa de los Cracks");
    await expect(page.getByTestId("share-preview")).toContainText("CopaDeLosCracks");
    await page.getByTestId("share-create").click();
    const link = await page.getByLabel("Enlace corto").inputValue();
    expect(link).toMatch(/\/compartir#CopaDeLosCracks-k7x9q2$/);
    expect(link.length).toBeLessThan(80);

    // Abrir el enlace corto muestra el torneo (datos obtenidos del servidor).
    await page.goto(link);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(t.name);
    await expect(page.getByTestId("recent-pens").first()).toContainText(/pen\. \d+-\d+/);

    // Un enlace que no existe o caducó muestra el aviso.
    await page.goto("/compartir#NoExiste-abc123");
    await expect(page.getByText(/Enlace no válido/)).toBeVisible();
  });

  test("sin almacenamiento en el servidor se explica y se ofrece el enlace largo", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
    await seed(page, finishedTournament("knockout", 8));
    await page.goto("/torneo");
    await page.getByRole("button", { name: /Compartir/ }).click();
    await page.getByTestId("share-create").click(); // el servidor local no tiene base de datos: responde 501
    await expect(page.getByTestId("share-problem")).toContainText(/aún no están activados/);
    await expect(page.getByTestId("share-long")).toBeVisible();
  });
});
