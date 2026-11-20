import Link from "next/link";
import { ISSUES_URL, NEW_ISSUE_URL, README_URL, REPO_URL } from "@/lib/links";

const STACK = [
  ["Next.js 15 (App Router) y React 19", "Interfaz y rutas"],
  ["TypeScript", "Tipado de toda la lógica"],
  ["Tailwind CSS 4", "Estilos"],
  ["Zustand", "Estado y guardado local"],
  ["Motion", "Animaciones"],
  ["Three.js", "Balón 3D de la portada (solo escritorio con WebGL)"],
  ["Vitest y Playwright", "Pruebas unitarias y de extremo a extremo"],
  ["Vercel", "Alojamiento"],
];

const FAQ: [string, string][] = [
  ["¿Es un producto oficial de EA SPORTS?", "No. ARENA XI es un proyecto independiente, sin afiliación, patrocinio ni respaldo oficial de EA SPORTS o Electronic Arts."],
  ["¿Juego los partidos dentro de ARENA XI?", "No. Los partidos se juegan en el videojuego; ARENA XI sortea los equipos, organiza el calendario o las llaves y registra los marcadores que introduces."],
  ["¿Por qué FC 26 y FC 27 no muestran valoraciones?", "Porque no he encontrado una fuente accesible y verificable con las valoraciones de equipo de esas ediciones, y prefiero no inventarlas. Se muestran como “—”. FC 25 sí conserva las valoraciones verificadas de sus 36 equipos principales."],
  ["¿Por qué no aparece mi selección favorita?", "El catálogo refleja las listas de equipos de cada edición. En el catálogo, las selecciones relevantes ausentes de una edición aparecen en la sección “Selecciones no disponibles” y no se pueden sortear."],
  ["¿Puedo mezclar clubes y selecciones, o masculinos y femeninos?", "No. Un torneo usa una sola edición y una sola categoría (clubes o selecciones, masculinos o femeninos)."],
  ["¿Qué pasa con mis torneos antiguos si el catálogo cambia?", "Cada torneo guarda una instantánea de sus equipos y valoraciones, así que conserva los datos con los que se creó."],
  ["¿Dónde se guardan mis torneos?", "Solo en tu navegador (localStorage). Si borras los datos del sitio, se pierden; exporta un JSON si quieres una copia."],
  ["¿Cómo informo de un error o propongo algo?", "Abre una incidencia en GitHub."],
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="display text-3xl font-extrabold sm:text-4xl">{title}</h2>
      <div className="mt-4 space-y-3 text-soft">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-14 pt-6">
      <header>
        <div className="kicker mb-2">Acerca del proyecto</div>
        <h1 className="display text-5xl font-black italic sm:text-6xl">
          ARENA <span className="text-gradient">XI</span>
        </h1>
        <p className="mt-3 text-xl text-soft">Que gane el mejor.</p>
        <nav aria-label="En esta página" className="mt-6 flex flex-wrap gap-2 text-sm">
          {[["que-es", "Qué es"], ["como-funciona", "Cómo funciona"], ["modalidades", "Modalidades"], ["ediciones", "Ediciones"], ["tecnologias", "Tecnologías"], ["faq", "Preguntas frecuentes"], ["privacidad", "Privacidad"], ["marcas", "Marcas"], ["accesibilidad", "Accesibilidad"], ["creditos", "Créditos"]].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-full border border-line px-3 py-1 text-soft transition-colors hover:border-neon/50 hover:text-white">{label}</a>
          ))}
        </nav>
      </header>

      <Section id="que-es" title="Qué es ARENA XI">
        <p>ARENA XI es una aplicación web para organizar torneos de EA SPORTS FC entre amigos: sorteos de equipos animados, ligas y eliminatorias de clubes o selecciones, resultados, tablas de clasificación, llaves y estadísticas.</p>
        <p>Nació para resolver una necesidad concreta de las quedadas de consola: repartir equipos de forma justa y transparente, y llevar el torneo sin hojas de cálculo.</p>
      </Section>

      <Section id="como-funciona" title="Cómo funciona">
        <ol className="list-decimal space-y-2 pl-5">
          <li><b className="text-white">Selecciona tu FC:</b> elige FC 25, FC 26 o FC 27. La edición define el catálogo y se mantiene durante todo el torneo.</li>
          <li><b className="text-white">Configura:</b> nombre, participantes, liga (una o dos vueltas) o eliminatorias, reglas y categoría de equipos (clubes o selecciones, masculinos o femeninos).</li>
          <li><b className="text-white">Elige los equipos</b> que entran en el sorteo.</li>
          <li><b className="text-white">Sortea:</b> cada jugador recibe su equipo con la modalidad que prefieras. El resultado se decide con aleatoriedad criptográfica antes de animar.</li>
          <li><b className="text-white">Compite:</b> registra marcadores; tablas, llaves y estadísticas se actualizan solas hasta coronar al campeón.</li>
        </ol>
        <p>Puedes <Link className="text-neon underline-offset-2 hover:underline" href="/nuevo">crear un torneo ahora</Link> o probar las <Link className="text-neon underline-offset-2 hover:underline" href="/#sorteos">demostraciones de sorteo</Link> de la portada, que no afectan a ningún torneo real.</p>
      </Section>

      <Section id="modalidades" title="Modalidades de sorteo">
        <ul className="space-y-2">
          <li><b className="text-white">Ruleta:</b> una rueda con los equipos que frena sobre el elegido.</li>
          <li><b className="text-white">Sobres:</b> sobres sellados que ocultan un equipo; cada jugador abre uno.</li>
          <li><b className="text-white">Tómbola:</b> bolas en un bombo; una sale expulsada.</li>
          <li><b className="text-white">Draft:</b> tres equipos al azar entre los que el jugador elige.</li>
          <li><b className="text-white">Bombos:</b> equipos agrupados por valoración; todos reciben uno del mismo nivel. Requiere valoraciones verificadas.</li>
        </ul>
      </Section>

      <Section id="ediciones" title="Ediciones de FC admitidas">
        <p>ARENA XI admite <b className="text-white">EA SPORTS FC 25, FC 26 y FC 27</b>. Cada edición tiene su propio catálogo de clubes y selecciones (masculinos y femeninos), aislado de las demás: nunca se mezclan equipos de ediciones distintas.</p>
        <p>Las listas de equipos proceden de FIFPlay y FIFAUTeam; el estado de licencia (licenciado, genérico o sin verificar) y las etiquetas de novedad solo se muestran cuando una fuente lo respalda. Las valoraciones verificadas existen para los 36 equipos principales de FC 25; en el resto se muestran como “—”.</p>
        <p>Un equipo disponible con diseño genérico (sin licencia de escudo o equipación) sigue estando en el juego; no es lo mismo que una selección ausente.</p>
      </Section>

      <Section id="tecnologias" title="Tecnologías">
        <ul className="grid gap-2 sm:grid-cols-2">
          {STACK.map(([n, d]) => (
            <li key={n} className="glass p-3"><div className="font-semibold text-white">{n}</div><div className="text-xs text-mute">{d}</div></li>
          ))}
        </ul>
        <p>El código es público en <a className="text-neon underline-offset-2 hover:underline" href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a> (<a className="text-neon underline-offset-2 hover:underline" href={README_URL} target="_blank" rel="noopener noreferrer">documentación</a>).</p>
      </Section>

      <Section id="faq" title="Preguntas frecuentes">
        <div className="space-y-2">
          {FAQ.map(([q, a]) => (
            <details key={q} className="glass group p-4 open:border-neon/40">
              <summary className="cursor-pointer list-none font-semibold text-white marker:hidden">{q}</summary>
              <p className="mt-2 text-sm">{a}</p>
            </details>
          ))}
        </div>
        <p>
          ¿Falta algo? <a className="text-neon underline-offset-2 hover:underline" href={NEW_ISSUE_URL} target="_blank" rel="noopener noreferrer">Abre una incidencia</a> o revisa las <a className="text-neon underline-offset-2 hover:underline" href={ISSUES_URL} target="_blank" rel="noopener noreferrer">existentes</a>. No se publican correos ni redes sociales: GitHub es el único canal de comentarios.
        </p>
      </Section>

      <Section id="privacidad" title="Privacidad y datos locales">
        <p>ARENA XI no tiene cuentas ni base de datos propia. Todo lo que introduces se guarda <b className="text-white">únicamente en tu navegador</b> (localStorage, clave “arena-xi”):</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Torneos (actual e historial): nombre, participantes, ajustes, equipos elegidos y su instantánea, sorteo, partidos y resultados.</li>
          <li>La preferencia de sonido.</li>
        </ul>
        <p>Los enlaces para compartir llevan el torneo comprimido en el fragmento (#) de la URL, que el navegador no envía a ningún servidor. Para borrar tus datos, elimina los torneos en el Historial o borra los datos del sitio en tu navegador.</p>
        <p>Esto no es una política de privacidad jurídica completa; describe lo que el código hace hoy. Si cambia, se actualizará aquí.</p>
      </Section>

      <Section id="marcas" title="Marcas y derechos de autor">
        <p className="glass border-neon/30 p-4 text-white">ARENA XI es un proyecto independiente, sin afiliación, patrocinio ni respaldo oficial de EA SPORTS o Electronic Arts. EA SPORTS FC es una marca de Electronic Arts.</p>
        <p>Los nombres de clubes, selecciones y competiciones pertenecen a sus respectivos titulares y se mencionan solo con fines informativos. Los escudos oficiales no se reproducen: las insignias y banderas son ilustraciones propias generadas por la aplicación.</p>
        <p>El repositorio no incluye un archivo de licencia de código abierto, por lo que no se concede ninguna licencia más allá de lo que permita GitHub para ver el código.</p>
      </Section>

      <Section id="accesibilidad" title="Accesibilidad">
        <p>ARENA XI respeta la preferencia del sistema de <b className="text-white">movimiento reducido</b> (las animaciones se simplifican), usa etiquetas ARIA en los controles principales y construye la navegación con enlaces y botones nativos.</p>
        <p>No se ha realizado una auditoría de accesibilidad formal, así que pueden existir barreras. Si encuentras alguna, <a className="text-neon underline-offset-2 hover:underline" href={NEW_ISSUE_URL} target="_blank" rel="noopener noreferrer">cuéntalo en GitHub</a>.</p>
      </Section>

      <Section id="creditos" title="Créditos y fuentes">
        <ul className="list-disc space-y-1 pl-5">
          <li><b className="text-white">FIFPlay:</b> listas de clubes y selecciones de FC 25, FC 26 y FC 27 (disponibilidad, país y liga).</li>
          <li><b className="text-white">FIFAUTeam:</b> estado de licencia y novedades entre ediciones.</li>
          <li><b className="text-white">FIFA Index, ReFIFA, SoFIFA y FIFACM:</b> valoraciones de los 36 equipos de FC 25 (fuente indicada en cada equipo).</li>
          <li><b className="text-white">Librerías:</b> Next.js, React, Tailwind CSS, Zustand, Motion, Three.js, lucide-react, canvas-confetti, html-to-image y lz-string.</li>
        </ul>
        <p>Las listas de las fuentes pueden estar incompletas o desactualizarse con los parches del juego.</p>
      </Section>
    </article>
  );
}
