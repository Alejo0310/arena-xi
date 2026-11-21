# ARENA XI

**Que gane el mejor.**

Aplicación web para organizar torneos de **EA SPORTS FC 25, FC 26 y FC 27** entre amigos: sorteos de equipos animados, ligas y eliminatorias de clubes o selecciones, resultados, tablas, llaves y estadísticas.

> Proyecto no oficial, sin relación con Electronic Arts. Las insignias de los clubes y las banderas de las selecciones son ilustraciones propias; no se reproducen escudos oficiales.

**🌐 Producción:** https://arena-xi-fc.vercel.app

## Características

**Configuración del torneo**
- Participantes: alta (uno a uno o varios separados por comas), edición en línea, eliminación, color identificativo y bloqueo de nombres duplicados.
- Selector de cantidad (2–32) que crea o recorta plazas, con vista previa de la estructura (jornadas, descansos, BYE).
- Modalidades **Liga** (una o dos vueltas, puntos configurables, desempate por diferencia de goles o enfrentamiento directo) y **Eliminatorias** (BYE automáticos, partido por el tercer puesto, empates resueltos por penaltis o ganador manual).
- **Categoría única por torneo: clubes o selecciones.** Clubes y selecciones nunca se mezclan (ver más abajo).
- Generador de nombres de torneo, opción de equipos repetidos y duración del cronómetro.

**Sorteo de equipos** (5 mecánicas)
| Modo | Experiencia |
|---|---|
| Ruleta | Rueda con los equipos disponibles que frena sobre el equipo sorteado |
| Sobres | Sobres sellados al barajar; cada jugador abre uno |
| Tómbola | Bombo con bolas que se agitan y expulsa la ganadora |
| Draft | Tres cartas aleatorias, el jugador elige una |
| Bombos | Equipos agrupados por valoración; todos reciben uno del mismo nivel |

- Sorteo individual o completo, presentación cinematográfica de cada jugador con su equipo, historial con hora, reinicio con confirmación.
- **Transparencia**: el resultado se decide con `crypto.getRandomValues` (sin sesgo de módulo) y se guarda *antes* de animar; la animación solo lo revela. El orden de los jugadores también es aleatorio.
- Sin repeticiones salvo que se habilite expresamente.

**Flujo sincronizado del sorteo.** Las cinco mecánicas usan un único controlador ([`useDrawController`](src/components/draw/useDrawController.ts)) y una máquina de estados pura ([`drawFlow.ts`](src/lib/drawFlow.ts)):

```
READY ─START─▶ SPINNING ─fin de animación─▶ REVEALING ─fin de revelación─▶ ASSIGNED
  ▲                                                                          │
  └── NEXT_READY ── NEXT ◀────────── CONTINUAR (quedan jugadores) ───────────┤
                                     CONTINUAR (último jugador) ──▶ COMPLETED
```

- El equipo se decide y se guarda como *pendiente* antes de animar; el turno solo avanza cuando el usuario pulsa **Continuar**.
- Las transiciones las disparan las promesas reales de fin de animación de Motion (no temporizadores). Cada giro tiene un `runId`: eventos duplicados o de animaciones antiguas se ignoran.
- El último participante pasa por los mismos estados que los demás; la conformación final solo aparece en `COMPLETED`.
- Recargar o cambiar de pantalla a mitad de animación reanuda la revelación del resultado ya decidido (no se puede volver a sortear).

**Portada con núcleo de sorteo 3D**
- Balón 3D generado por shader (12 pentágonos y 20 hexágonos con costuras de neón, sin modelos ni texturas externas), anillos de energía y tarjetas de equipos en órbita.
- Parallax con el cursor, reacción al pasar por encima y **sorteo exprés** al pulsar el balón: el equipo se decide primero y la órbita frena hasta dejarlo delante.
- Three.js puro (sin React Three Fiber), cargado de forma diferida solo en escritorio con WebGL capaz, tras el evento `load` y con el navegador libre. Shaders compilados en paralelo, resolución limitada, render pausado fuera de pantalla y liberación del contexto WebGL al salir.
- En móvil, con movimiento reducido o sin WebGL: versión SVG/CSS ligera con el mismo concepto.

**Competición**
- Tarjetas de partido con estado (pendiente, en juego, finalizado), marcador, penaltis, ganador manual (W.O. 3-0 en liga), edición con confirmación y borrado.
- Al editar un resultado de eliminatoria se recalculan las fases dependientes y se avisa de los partidos que se reiniciarán.
- Tabla de posiciones (PJ, G, E, P, GF, GC, DG, PTS y racha), calendario con descansos y cuadro de eliminatorias interactivo.
- Dashboard: progreso, próximos partidos, partido en juego con cronómetro, últimos resultados, clasificados y campeón.
- Estadísticas: máximo goleador, más victorias, mejor diferencia, mayor goleada, partido con más goles, valla menos vencida y rendimiento por jugador.
- Celebración del campeón con confeti y sonido.

**Extras**
- Guardado automático en el navegador (`localStorage`) y continuación posterior.
- Historial de torneos y **ranking histórico** acumulado por jugador.
- Revancha (nuevo torneo conservando participantes y reglas).
- Exportación a PNG, PDF (impresión) y JSON; importación de JSON.
- Enlace para compartir una instantánea de solo lectura (datos comprimidos en el fragmento `#` de la URL; no pasan por ningún servidor).
- Modo proyección para pantalla grande, sincronizado con la pestaña de administración.
- Pantalla completa, sonidos sintetizados opcionales (desactivados por defecto) y respeto de `prefers-reduced-motion`.

## Multiversión: FC 25, FC 26 y FC 27

- Paso **SELECCIONA TU FC** al configurar el torneo. Cada edición tiene su **catálogo aislado** de clubes y selecciones, masculinos y femeninos (cuatro categorías), cargado bajo demanda desde `src/data/catalogs/fcXX.json`.
- Reglas: un torneo usa **una edición** y **una categoría**; no se mezclan ediciones, clubes/selecciones ni masculinos/femeninos (`src/lib/category.ts`, validado en store, sorteo y motor).
- **Instantáneas**: cada torneo guarda los datos de sus equipos (`snapshot`), así que actualizar un catálogo no altera torneos históricos. Los torneos antiguos se migran como FC 25 masculino.
- **Valoraciones**: FC 25 conserva las de sus 36 equipos principales (FIFA Index y otras). Las de **clubes de FC 26 (655) y FC 27 (653)** proceden de una lista aportada por el autor (copiada de una base de datos pública; `scripts/parse-ratings.py` → `src/data/ratings/`, integrada en `scripts/build-catalogs.py`). Las **selecciones** y los clubes que no figuran en esa lista quedan como “SIN VALORACIÓN”: nunca se inventan ni se reutilizan datos de otra edición. Se descartan filas con valoración 0.
- **Bombos**: por valoración (solo si todos los equipos la tienen), manual o aleatorio equilibrado; el método se conserva con el torneo.
- Licencias (licenciado / genérico / sin verificar) y etiquetas “Nuevo en FC xx” solo donde una fuente lo respalda. Las selecciones ausentes aparecen en “Selecciones no disponibles” y no se pueden sortear.
- Fuentes: [FIFPlay](https://www.fifplay.com/) (listas, país y liga), [FIFAUTeam](https://fifauteam.com/) (licencias y novedades) y FIFA Index/ReFIFA/SoFIFA/FIFACM (valoraciones FC 25). FIFA Index y SoFIFA bloquean el acceso automatizado. Los catálogos se regeneran con `scripts/parse-fifplay.py` y `scripts/build-catalogs.py`.
- **Simulaciones** de las 5 modalidades en el Home (independientes de los torneos reales), página `/acerca` y **footer** con enlaces a funcionalidades existentes.
- Pruebas: `npm test` (Vitest, pool `vmThreads`) y `npm run e2e`.

## Clubes y selecciones

Un torneo es **de clubes** o **de selecciones**, nunca mixto. La regla vive en [`src/lib/category.ts`](src/lib/category.ts) y la aplican todas las capas: el store (pool, cambio de categoría, importación y datos guardados), la lógica de sorteo (`decidePick`, `validateAssignments`) y el motor del torneo (`buildMatches`, `recordResult`). Un estado manipulado a mano que mezcle categorías no se puede sortear, iniciar ni puntuar. Cambiar de categoría con un sorteo en curso pide confirmación y reinicia el sorteo.

## Datos de los equipos

**Clubes:** 26 clubes con media (OVR), ataque, mediocampo y defensa de la base de datos **FC 25 de FIFA Index**, que corresponde a la última actualización de plantillas de FC 25 (julio de 2025). Los datos se contrastaron con ReFIFA, SoFIFA y FIFACM; cada equipo indica su fuente en [`src/lib/teams.ts`](src/lib/teams.ts). No se usan datos de FC 26.

En FC 25 el Inter y el AC Milan aparecen sin licencia como **Lombardia FC** y **Milano FC**; la app muestra el nombre del juego y el nombre real.

Las valoraciones del lanzamiento (septiembre de 2024) eran algo distintas: por ejemplo, Real Madrid y Manchester City tenían 86.

**Selecciones:** 10 selecciones masculinas de FC 25 con valoraciones verificadas: Francia, España, Alemania, Inglaterra, Portugal, Argentina, Países Bajos, Italia, Croacia y Marruecos. Fuentes: FIFA Index (FC 25) y, cuando no estaba disponible, instantáneas de SoFIFA, FIFACM o CMTracker de FC 25 (indicadas por equipo). **Brasil y Uruguay no tienen licencia en FC 25** y por eso no aparecen. Bélgica está en el juego, pero no se encontraron valoraciones de FC 25 verificables, así que se omite hasta confirmarlas.

## Tecnologías

- [Next.js 15](https://nextjs.org) (App Router) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com)
- [Motion](https://motion.dev) para animaciones y `canvas-confetti` para celebraciones
- [Zustand](https://zustand.docs.pmnd.rs) con persistencia en `localStorage`
- `lucide-react` (iconos), `lz-string` (enlaces compartibles), `html-to-image` (exportar PNG)
- [Vitest](https://vitest.dev) (lógica) y [Playwright](https://playwright.dev) (end-to-end, escritorio y móvil)

## Arquitectura

```
src/
├─ lib/                     Lógica pura, sin React (testeable)
│  ├─ types.ts              Modelo de dominio
│  ├─ teams.ts              Base de datos de equipos FC 25
│  ├─ random.ts             Aleatoriedad criptográfica
│  ├─ draw.ts               Lógica de sorteos (decidir / confirmar, 5 modos)
│  ├─ drawFlow.ts           Máquina de estados del flujo visual del sorteo
│  ├─ category.ts           Regla clubes vs. selecciones (validación central)
│  ├─ tournament/
│  │  ├─ league.ts          Calendario (método del círculo) y clasificación
│  │  ├─ knockout.ts        Cuadro, BYE, propagación de ganadores
│  │  ├─ match.ts           Validación y aplicación de resultados
│  │  ├─ engine.ts          Ciclo de vida del torneo
│  │  └─ stats.ts           Estadísticas y ranking histórico
│  └─ share.ts, sound.ts, fx.ts, names.ts
├─ store/tournament.ts      Estado global + persistencia
├─ components/              UI (draw/, tournament/, teams/, layout/, ui/)
│  └─ draw/useDrawController.ts  Controlador único del sorteo
└─ app/                     Rutas: / · /nuevo · /sorteo · /torneo · /equipos
                            /historial · /proyeccion · /compartir
```

## Rendimiento

Mediciones con Lighthouse (móvil simulado) en local, mediana de 5 ejecuciones alternadas entre versiones:

| Página | Antes de la optimización | Después |
|---|---|---|
| Portada | 57 · TBT 3.180 ms · FCP 1,52 s | 80 · TBT 438 ms · FCP 0,85 s |
| /equipos | 68 · TBT 896 ms · FCP 1,59 s | 82 · TBT 376 ms · FCP 0,76 s |

Principales causas corregidas: `mask-image` a pantalla completa, sombras con mucho desenfoque en cada tarjeta, `shadowBlur` por partícula en el canvas del fondo, barras animando `width` y cintas infinitas animadas con JavaScript. Las cifras varían según la carga del equipo, por eso se comparan versiones en la misma sesión.

## Instalación y ejecución

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Pruebas:

```bash
npm test                         # tests unitarios de la lógica (Vitest)
npx playwright install chromium  # solo la primera vez
npm run build && npm run e2e     # tests end-to-end en escritorio y móvil
```

## Configuración

No se necesitan variables de entorno ni servicios externos: todos los datos se guardan en el navegador de quien administra el torneo. Para llevar un torneo a otro dispositivo, usa **Exportar → JSON** e **Importar JSON** en el historial, o el enlace de **Compartir**.

## Despliegue

Pensado para [Vercel](https://vercel.com) sin configuración adicional: importa el repositorio, framework *Next.js*, sin variables de entorno. Cada push a `main` genera un despliegue de producción.

## Uso rápido

1. **Crear torneo** → nombre, participantes, modalidad, reglas y equipos del sorteo.
2. **Sorteo** → elige la mecánica y sortea jugador a jugador, o usa *Sorteo completo*.
3. **Comenzar torneo** → registra los marcadores en *Resumen* o *Calendario/Partidos*.
4. Sigue la tabla o las llaves, las estadísticas y usa *Proyección* en una pantalla grande.
5. Al terminar: celebración, historial y ranking histórico. *Revancha* reutiliza los jugadores.


Awo
