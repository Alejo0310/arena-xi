# FC 25 Arena · Tournament Manager

Aplicación web para organizar torneos de **EA SPORTS FC 25** entre amigos: sorteos de equipos animados, ligas, eliminatorias, resultados, tablas, llaves y estadísticas.

> Proyecto no oficial, sin relación con Electronic Arts. Las insignias de los equipos son ilustraciones propias con los colores de cada club; no se reproducen escudos oficiales.

## Características

**Configuración del torneo**
- Participantes: alta (uno a uno o varios separados por comas), edición en línea, eliminación, color identificativo y bloqueo de nombres duplicados.
- Selector de cantidad (2–32) que crea o recorta plazas, con vista previa de la estructura (jornadas, descansos, BYE).
- Modalidades **Liga** (una o dos vueltas, puntos configurables, desempate por diferencia de goles o enfrentamiento directo) y **Eliminatorias** (BYE automáticos, partido por el tercer puesto, empates resueltos por penaltis o ganador manual).
- Generador de nombres de torneo, opción de equipos repetidos y duración del cronómetro.

**Sorteo de equipos** (5 mecánicas)
| Modo | Experiencia |
|---|---|
| Ruleta | Rueda con los clubes disponibles que frena sobre el equipo sorteado |
| Sobres | Sobres sellados al barajar; cada jugador abre uno |
| Tómbola | Bombo con bolas que se agitan y expulsa la ganadora |
| Draft | Tres cartas aleatorias, el jugador elige una |
| Bombos | Clubes agrupados por valoración; todos reciben uno del mismo nivel |

- Sorteo individual o completo, presentación cinematográfica de cada jugador con su club, historial con hora, reinicio con confirmación.
- **Transparencia**: el resultado se decide con `crypto.getRandomValues` (sin sesgo de módulo) y se guarda *antes* de animar; la animación solo lo revela. El orden de los jugadores también es aleatorio.
- Sin repeticiones salvo que se habilite expresamente.

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

## Datos de los equipos

26 clubes con media (OVR), ataque, mediocampo y defensa de la base de datos **FC 25 de FIFA Index**, que corresponde a la última actualización de plantillas de FC 25 (julio de 2025). Los datos se contrastaron con ReFIFA, SoFIFA y FIFACM; cada equipo indica su fuente en [`src/lib/teams.ts`](src/lib/teams.ts). No se usan datos de FC 26.

En FC 25 el Inter y el AC Milan aparecen sin licencia como **Lombardia FC** y **Milano FC**; la app muestra el nombre del juego y el nombre real.

Las valoraciones del lanzamiento (septiembre de 2024) eran algo distintas: por ejemplo, Real Madrid y Manchester City tenían 86.

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
│  ├─ draw.ts               Lógica de sorteos (los 5 modos)
│  ├─ tournament/
│  │  ├─ league.ts          Calendario (método del círculo) y clasificación
│  │  ├─ knockout.ts        Cuadro, BYE, propagación de ganadores
│  │  ├─ match.ts           Validación y aplicación de resultados
│  │  ├─ engine.ts          Ciclo de vida del torneo
│  │  └─ stats.ts           Estadísticas y ranking histórico
│  └─ share.ts, sound.ts, fx.ts, names.ts
├─ store/tournament.ts      Estado global + persistencia
├─ components/              UI (draw/, tournament/, teams/, layout/, ui/)
└─ app/                     Rutas: / · /nuevo · /sorteo · /torneo · /equipos
                            /historial · /proyeccion · /compartir
```

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
