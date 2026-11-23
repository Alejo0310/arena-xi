import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { chooseMode, clickCentered, fullDraw } from "./helpers";

/*
 * Invitaciones por QR y código. El servidor de pruebas usa un Redis en memoria (ARENA_KV_MEMORY=1) con exactamente las
 * mismas operaciones que Upstash. Cada invitado es un contexto de navegador distinto (su propio almacenamiento local).
 */

const base = () => test.info().project.use.baseURL ?? "http://localhost:3100";
async function guestContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ baseURL: base(), viewport: { width: 390, height: 844 } });
}

async function hostCreatesInvitation(page: Page, manual: string[]) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.getByRole("button", { name: /Crear torneo/ }).click();
  await expect(page).toHaveURL(/\/nuevo/);
  const input = page.getByPlaceholder(/Nombre del jugador/);
  await input.fill(manual.join(", "));
  await input.press("Enter");
  for (const n of manual) await expect(page.getByRole("button", { name: `Eliminar ${n}` })).toBeVisible();
  await clickCentered(page.getByTestId("invite-generate"));
  await expect(page.getByTestId("invite-panel")).toBeVisible();
  const code = (await page.getByTestId("invite-code").getAttribute("data-code"))!;
  const url = (await page.getByTestId("qr").getAttribute("data-qr-value"))!;
  return { code, url };
}

async function joinWith(ctx: BrowserContext, url: string, name: string) {
  const p = await ctx.newPage();
  await p.goto(url);
  await p.getByTestId("join-name").fill(name);
  await p.getByTestId("join-submit").click();
  return p;
}

test.describe("invitaciones: QR y código", () => {
  test("el host genera QR y código; los invitados se inscriben, se conservan y se evitan duplicados", async ({ page, browser }) => {
    const { code, url } = await hostCreatesInvitation(page, ["Host Uno"]);
    expect(code).toMatch(/^\d{6}$/);
    expect(url).toBe(`${base()}/unirse/${code}`); // el QR solo lleva la dirección con el código, nada sensible
    await expect(page.getByTestId("qr").locator("svg")).toBeVisible();
    await expect(page.getByTestId("invite-count")).toHaveText("1");

    // Invitado 1: escanea el QR (abre la dirección del QR).
    const g1 = await guestContext(browser);
    const p1 = await joinWith(g1, url, "Ana Invitada");
    await expect(p1.getByTestId("join-success")).toContainText("Ana Invitada");

    // Invitado 2: introduce el código numérico en la página de acceso.
    const g2 = await guestContext(browser);
    const p2 = await g2.newPage();
    await p2.goto("/unirse");
    await p2.getByTestId("join-code-input").fill(code);
    await p2.getByTestId("join-code-submit").click();
    await expect(p2).toHaveURL(new RegExp(`/unirse/${code}$`));
    await expect(p2.getByTestId("join-title")).toBeVisible();
    await p2.getByTestId("join-name").fill("Beto Invitado");
    await p2.getByTestId("join-submit").click();
    await expect(p2.getByTestId("join-success")).toBeVisible();

    // El host los ve aparecer sin recargar, también en su lista de participantes.
    await expect(page.getByTestId("invite-count")).toHaveText("3", { timeout: 15_000 });
    await expect(page.getByTestId("invite-list")).toContainText("Ana Invitada");
    await expect(page.getByTestId("invite-list")).toContainText("Beto Invitado");
    await expect(page.getByRole("button", { name: "Eliminar Ana Invitada" })).toBeVisible();

    // Nombre duplicado (sin distinguir mayúsculas): se rechaza con una explicación.
    const g3 = await guestContext(browser);
    const p3 = await joinWith(g3, url, "ana invitada");
    await expect(p3.getByTestId("join-form-error")).toContainText(/ya hay un participante con ese nombre/i);
    await expect(p3.getByTestId("join-success")).toHaveCount(0);

    // Un nombre igual al del registro manual del host también se rechaza.
    const p3b = await joinWith(g3, url, "HOST UNO");
    await expect(p3b.getByTestId("join-form-error")).toContainText(/ya hay un participante/i);

    // Persistencia: recargar al host conserva la invitación y la lista; el invitado sigue reconocido.
    await page.reload();
    await expect(page.getByTestId("invite-code")).toHaveAttribute("data-code", code);
    await expect(page.getByTestId("invite-count")).toHaveText("3", { timeout: 15_000 });
    await p1.reload();
    await expect(p1.getByTestId("join-success")).toContainText("Ana Invitada");

    // Cerrar inscripciones: persiste y se explica al que llega después.
    await page.getByTestId("invite-toggle").click();
    await expect(page.getByTestId("invite-status")).toContainText(/cerradas/i, { timeout: 10_000 });
    const g4 = await guestContext(browser);
    const p4 = await g4.newPage();
    await p4.goto(url);
    await expect(p4.getByTestId("join-blocked")).toContainText(/cerrado las inscripciones/i);
    await page.getByTestId("invite-toggle").click();
    await expect(page.getByTestId("invite-status")).toContainText(/abiertas/i, { timeout: 10_000 });
    for (const c of [g1, g2, g3, g4]) await c.close();
  });

  test("códigos inválidos y mensajes de error claros", async ({ page }) => {
    await page.goto("/unirse");
    await page.getByTestId("join-code-input").fill("123");
    await expect(page.getByTestId("join-code-submit")).toBeDisabled();
    await page.getByTestId("join-code-input").fill("000000");
    await page.getByTestId("join-code-submit").click();
    await expect(page.getByTestId("join-code-error")).toContainText(/no existe ningún torneo/i);
    await page.goto("/unirse/abc");
    await expect(page.getByTestId("join-error")).toContainText(/6 dígitos/);
    await page.goto("/unirse/999999");
    await expect(page.getByTestId("join-error")).toBeVisible();
  });

  test("el cupo se respeta con inscripciones simultáneas (API real)", async ({ request }) => {
    const created = await (await request.post("/api/sala", { data: { name: "Cupo", max: 4 } })).json();
    const results = await Promise.all(Array.from({ length: 14 }, (_, i) => request.post(`/api/sala/${created.id}/join`, { data: { name: `Jugador ${i}` } })));
    const codes = results.map((r) => r.status());
    expect(codes.filter((c) => c === 200)).toHaveLength(4);
    expect(codes.filter((c) => c === 409)).toHaveLength(10);
    const state = await (await request.get(`/api/sala/${created.id}`)).json();
    expect(state.participants).toHaveLength(4);
    // Mismo nombre a la vez: solo uno.
    const dup = await (await request.post("/api/sala", { data: { name: "Dup", max: 8 } })).json();
    const r2 = await Promise.all(Array.from({ length: 8 }, () => request.post(`/api/sala/${dup.id}/join`, { data: { name: "Leo" } })));
    expect(r2.filter((r) => r.status() === 200)).toHaveLength(1);
  });

  test("las credenciales de Redis y los tokens no llegan al navegador", async ({ page, request }) => {
    const created = await (await request.post("/api/sala", { data: { name: "Secreto", max: 4 } })).json();
    const guest = await (await request.post(`/api/sala/${created.id}/join`, { data: { name: "Ana" } })).json();
    const state = JSON.stringify(await (await request.get(`/api/sala/${created.id}`)).json());
    const byCode = JSON.stringify(await (await request.get(`/api/sala/codigo/${created.code}`)).json());
    for (const body of [state, byCode]) {
      expect(body).not.toContain(created.hostToken);
      expect(body).not.toContain(guest.memberToken);
    }
    // Ni el código ni los tokens aparecen en las páginas públicas ni en el JavaScript que recibe el navegador.
    await page.goto("/unirse");
    const scripts = await page.evaluate(() => [...document.querySelectorAll("script[src]")].map((s) => (s as HTMLScriptElement).src));
    for (const src of scripts) {
      const text = await (await request.get(src)).text();
      expect(text).not.toMatch(/KV_REST_API_TOKEN|UPSTASH_REDIS_REST_TOKEN|KV_REST_API_URL/);
    }
  });
});

test.describe("invitaciones: permisos y resultados", () => {
  test("solo el host inicia; tras iniciar se cierran las inscripciones y los invitados registran resultados", async ({ page, browser, request }) => {
    test.setTimeout(240_000);
    const { code, url } = await hostCreatesInvitation(page, ["Host Uno"]);
    const g1 = await guestContext(browser);
    const p1 = await joinWith(g1, url, "Ana Invitada");
    await expect(p1.getByTestId("join-success")).toBeVisible();
    const g2 = await guestContext(browser);
    const p2 = await joinWith(g2, url, "Beto Invitado");
    await expect(p2.getByTestId("join-success")).toBeVisible();
    await expect(page.getByTestId("invite-count")).toHaveText("3", { timeout: 15_000 });

    const room = await (await request.get(`/api/sala/codigo/${code}`)).json();
    const roomId = room.id as string;
    const memberToken = await p1.evaluate((id) => JSON.parse(localStorage.getItem("arena-xi-member")!)[id].token as string, roomId);

    // Un invitado no puede iniciar el torneo (comprobado en el servidor, no solo en la interfaz).
    const tournament = await page.evaluate(() => JSON.parse(localStorage.getItem("arena-xi")!).state.current);
    for (const headers of [{ Authorization: `Bearer ${memberToken}` }, {} as Record<string, string>, { Authorization: `Bearer ${"a".repeat(64)}` }]) {
      const r = await request.post(`/api/sala/${roomId}/start`, { headers, data: { tournament } });
      expect([401, 403]).toContain(r.status());
    }
    expect((await (await request.get(`/api/sala/${roomId}`)).json()).started).toBe(false);

    // El host pasa al sorteo: las inscripciones se cierran (persistente) y juega el sorteo.
    await clickCentered(page.getByRole("button", { name: /Ir al sorteo/ }));
    await expect(page).toHaveURL(/\/sorteo/);
    const g5 = await guestContext(browser);
    const late = await g5.newPage();
    await late.goto(url);
    await expect(late.getByTestId("join-blocked")).toBeVisible();
    await chooseMode(page, "Ruleta");
    await fullDraw(page);
    await page.getByRole("button", { name: /Comenzar torneo/ }).click();
    await expect(page).toHaveURL(/\/torneo/);

    // Publicación en la sala (el servidor valida el token del host).
    await expect(page.getByTestId("host-room-banner")).toContainText(/Los invitados pueden registrar resultados/, { timeout: 20_000 });
    const st = await (await request.get(`/api/sala/${roomId}`)).json();
    expect(st.started).toBe(true);
    expect(st.open).toBe(false);
    expect(st.tournament.participants).toHaveLength(3);
    // Después del inicio ya nadie puede inscribirse, ni con la API.
    expect((await request.post(`/api/sala/${roomId}/join`, { data: { name: "Tarde" } })).status()).toBe(409);
    // Un invitado no puede volver a iniciar ni cambiar la configuración (no existe acción para ello).
    expect((await request.post(`/api/sala/${roomId}/start`, { headers: { Authorization: `Bearer ${memberToken}` }, data: { tournament } })).status()).toBe(403);
    expect((await request.post(`/api/sala/${roomId}/close`, { headers: { Authorization: `Bearer ${memberToken}` }, data: { open: true } })).status()).toBe(403);

    // El invitado ve el torneo y registra un resultado.
    await p1.goto(`/sala/${roomId}`);
    await expect(p1.getByTestId("room-role")).toContainText("Ana Invitada");
    await expect(p1.getByTestId("room-title")).toBeVisible();
    await p1.getByRole("tab", { name: /Calendario/ }).click();
    await expect(p1.getByText("Próximos enfrentamientos")).toHaveCount(0); // termina la transición de pestaña
    const firstCard = p1.locator(".glass", { has: p1.getByRole("button", { name: /Registrar/ }) }).first();
    const inputs = firstCard.locator("input.score-input");
    await inputs.nth(0).fill("3");
    await inputs.nth(1).fill("1");
    await firstCard.getByRole("button", { name: /Registrar/ }).click();
    // Un invitado no tiene "Ganador manual", "En juego" ni "Borrar" (permisos de organizador).
    await expect(p1.getByText("Ganador manual")).toHaveCount(0);

    // Se guardó en el servidor y el host lo ve reflejado sin hacer nada.
    await expect.poll(async () => ((await (await request.get(`/api/sala/${roomId}`)).json()).tournament.matches as { status: string; isBye?: boolean }[]).filter((m) => m.status === "done" && !m.isBye).length).toBe(1);
    await expect
      .poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem("arena-xi")!).state.current.matches as { status: string; isBye?: boolean }[]).filter((m) => m.status === "done" && !m.isBye).length), { timeout: 20_000 })
      .toBe(1);

    // Otro invitado registra el siguiente partido y puede actualizar uno ya registrado.
    await p2.goto(`/sala/${roomId}`);
    await p2.getByRole("tab", { name: /Calendario/ }).click();
    await expect(p2.getByText("Próximos enfrentamientos")).toHaveCount(0);
    const card2 = p2.locator(".glass", { has: p2.getByRole("button", { name: /Registrar/ }) }).first();
    await card2.locator("input.score-input").nth(0).fill("0");
    await card2.locator("input.score-input").nth(1).fill("2");
    await card2.getByRole("button", { name: /Registrar/ }).click();
    await expect.poll(async () => ((await (await request.get(`/api/sala/${roomId}`)).json()).tournament.matches as { status: string; isBye?: boolean }[]).filter((m) => m.status === "done" && !m.isBye).length).toBe(2);

    // El registro manual del host sigue funcionando en el mismo torneo (el host registra en la sala y en local).
    await page.getByRole("tab", { name: /Partidos|Calendario/ }).click();
    await expect(page.getByText("Próximos enfrentamientos")).toHaveCount(0);
    const hostCard = page.locator(".glass", { has: page.getByRole("button", { name: /Registrar/ }) }).first();
    await hostCard.locator("input.score-input").nth(0).fill("1");
    await hostCard.locator("input.score-input").nth(1).fill("0");
    await hostCard.getByRole("button", { name: /Registrar/ }).click();
    await expect.poll(async () => ((await (await request.get(`/api/sala/${roomId}`)).json()).tournament.matches as { status: string; isBye?: boolean }[]).filter((m) => m.status === "done" && !m.isBye).length).toBe(3);

    // Un invitado no puede borrar resultados ni dar un ganador manual (comprobado en el servidor).
    const matchId = (await (await request.get(`/api/sala/${roomId}`)).json()).tournament.matches[0].id as string;
    expect((await request.post(`/api/sala/${roomId}/clear`, { headers: { Authorization: `Bearer ${memberToken}` }, data: { matchId } })).status()).toBe(403);
    expect((await request.post(`/api/sala/${roomId}/result`, { headers: { Authorization: `Bearer ${memberToken}` }, data: { matchId, result: { homeGoals: 1, awayGoals: 1, manualWinnerId: "p0" } } })).status()).toBe(403);
    expect((await request.post(`/api/sala/${roomId}/result`, { data: { matchId, result: { homeGoals: 9, awayGoals: 0 } } })).status()).toBe(401);
    for (const c of [g1, g2, g5]) await c.close();
  });

  test("sin invitaciones el torneo funciona exactamente como antes (sin sala)", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/nuevo");
    const input = page.getByPlaceholder(/Nombre del jugador/);
    await input.fill("Ana, Beto, Caro");
    await input.press("Enter");
    await expect(page.getByTestId("invite-cta")).toBeVisible();
    const cur = await page.evaluate(() => JSON.parse(localStorage.getItem("arena-xi")!).state.current);
    expect(cur.room).toBeUndefined();
    expect(cur.participants).toHaveLength(3);
  });
});

test.describe("invitaciones: diseño responsive", () => {
  test("el panel y la página de acceso no desbordan en ningún tamaño", async ({ page, browser }) => {
    const { code, url } = await hostCreatesInvitation(page, ["Host Uno"]);
    const check = async (p: Page, label: string) => {
      const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, `${label}: desbordamiento horizontal`).toBeLessThanOrEqual(1);
    };
    for (const size of [{ width: 360, height: 740 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(size);
      await page.getByTestId("invite-panel").scrollIntoViewIfNeeded();
      await check(page, `panel ${size.width}`);
      const box = await page.getByTestId("qr").boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(150); // el QR no se comprime
      await expect(page.getByTestId("invite-copy")).toBeVisible();
    }
    const g = await guestContext(browser);
    const p = await g.newPage();
    await p.goto(url);
    await check(p, "unirse móvil");
    await p.goto("/unirse");
    await check(p, "código móvil");
    expect(code).toHaveLength(6);
    await g.close();
  });
});
