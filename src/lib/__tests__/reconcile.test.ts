import { describe, expect, it } from "vitest";
import { reconcile } from "../roomReconcile";

describe("reconciliación de la lista local con la sala", () => {
  it("añade a los invitados nuevos y los recuerda como invitados", () => {
    const p = reconcile(["Host"], ["Host", "Ana", "Beto"], []);
    expect(p.add).toEqual(["Ana", "Beto"]);
    expect(p.guests).toEqual(["Ana", "Beto"]);
    expect(p.manual).toEqual(["Host"]);
    expect(p.kick).toEqual([]);
  });

  it("no duplica ni distingue mayúsculas o espacios", () => {
    const p = reconcile(["Host", "ana  pérez"], ["Host", "Ana Pérez"], ["Ana Pérez"]);
    expect(p.add).toEqual([]);
    expect(p.kick).toEqual([]);
    expect(p.manual).toEqual(["Host"]);
  });

  it("si el host quita a un invitado de su lista, se expulsa de la sala (si no, volvería a aparecer)", () => {
    const p = reconcile(["Host"], ["Host", "Ana"], ["Ana"]);
    expect(p.kick).toEqual(["Ana"]);
    expect(p.add).toEqual([]);
    expect(p.guests).toEqual([]);
  });

  it("un invitado ya expulsado deja de contar; el registro manual se reserva en la sala", () => {
    const p = reconcile(["Host", "Manual Dos"], ["Host", "Manual Dos"], ["Fantasma"]);
    expect(p.guests).toEqual([]);
    expect(p.manual).toEqual(["Host", "Manual Dos"]);
  });
});
