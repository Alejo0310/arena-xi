"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";

/** QR como SVG (sin imágenes externas): módulos oscuros sobre fondo blanco, con margen de silencio para que escanee bien. */
export function qrSvg(value: string, cell = 8, margin = 3): string {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  return qr.createSvgTag({ cellSize: cell, margin, scalable: true });
}

export function QRCode({ value, className = "", label }: { value: string; className?: string; label: string }) {
  const svg = useMemo(() => qrSvg(value), [value]);
  return (
    <div
      role="img"
      aria-label={label}
      data-testid="qr"
      data-qr-value={value}
      className={`overflow-hidden rounded-2xl bg-white p-2 [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`}
      // El SVG lo genera la biblioteca a partir de datos propios; no contiene entrada de terceros sin escapar.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Descarga el QR como PNG nítido (la web no usa imágenes externas ni envía el QR a ningún servicio). */
export async function downloadQrPng(value: string, filename: string): Promise<boolean> {
  try {
    const svg = qrSvg(value, 12, 4);
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("img"));
      img.src = url;
    });
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) return false;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  } catch {
    return false;
  }
}
