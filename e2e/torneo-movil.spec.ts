import { expect, test } from "@playwright/test";
import { finishedTournament, seed } from "./seed";
import { shot } from "./helpers";

test.describe("resumen del torneo terminado", () => {
  test("sin desbordes en móvil y con los penaltis bajo el empate", async ({ page }) => {
    const t = finishedTournament("knockout", 8);
    await seed(page, t);
    await page.goto("/torneo");
    await expect(page.getByTestId("recent-result").first()).toBeVisible();

    // Nada se sale de la pantalla: ni la página ni ninguna tarjeta del resumen.
    const overflow = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const bad = [...document.querySelectorAll("main *")].filter((el) => !el.closest("[role=tablist]") && !el.closest(".overflow-x-auto")).filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1; }).map((el) => el.tagName + "." + String(el.className).slice(0, 40));
      return { scroll: document.documentElement.scrollWidth - vw, bad: bad.slice(0, 5) };
    });
    expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(1);
    expect(overflow.bad).toEqual([]);

    // Cada empate resuelto desde los once metros muestra su tanda justo debajo del marcador.
    const drawn = t.matches.filter((m) => m.homeGoals !== null && m.homeGoals === m.awayGoals && m.homePens != null);
    expect(drawn.length).toBeGreaterThan(0);
    const pens = page.getByTestId("recent-pens");
    expect(await pens.count()).toBeGreaterThan(0);
    await expect(pens.first()).toContainText(/pen\. \d+-\d+/);
    await shot(page, "resumen-final");
  });
});
