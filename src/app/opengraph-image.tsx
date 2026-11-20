import { ImageResponse } from "next/og";

export const alt = "ARENA XI · Que gane el mejor";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagen para compartir enlaces (Open Graph / redes), generada en el build. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          backgroundColor: "#05070a",
          backgroundImage: "radial-gradient(ellipse at 50% -10%, rgba(61,255,139,0.35), transparent 60%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 10, color: "#3dff8b", fontWeight: 700 }}>SORTEOS Y TORNEOS · EA SPORTS FC 25</div>
        <div style={{ display: "flex", fontSize: 190, fontWeight: 900, fontStyle: "italic", letterSpacing: -4, lineHeight: 1, marginTop: 20 }}>
          ARENA&nbsp;<span style={{ color: "#3dff8b" }}>XI</span>
        </div>
        <div style={{ display: "flex", fontSize: 56, fontWeight: 700, color: "#c5ccd8", marginTop: 18 }}>Que gane el mejor.</div>
        <div style={{ display: "flex", marginTop: 50, gap: 16 }}>
          {["Ruleta", "Sobres", "Tómbola", "Draft", "Bombos"].map((m) => (
            <div key={m} style={{ display: "flex", padding: "10px 22px", borderRadius: 999, border: "2px solid rgba(255,255,255,0.15)", fontSize: 26, color: "#ffffff" }}>
              {m}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
