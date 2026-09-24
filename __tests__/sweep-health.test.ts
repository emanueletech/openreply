import { describe, it, expect } from "vitest";
import { sweepFailurePersists } from "@/lib/alerts/sweep-health";

const PERSIST_MS = 6 * 60_000;
const at = (min: number) => new Date(Date.UTC(2026, 8, 24, 20, min));

describe("sweepFailurePersists", () => {
  it("tace quando un solo giro è andato a vuoto su più campagne", () => {
    // Gli otto WARNING delle 20:58: stesso giro, guasto già rientrato.
    const stessoGiro = Array.from({ length: 8 }, () => at(58));
    expect(sweepFailurePersists(stessoGiro, PERSIST_MS)).toBe(false);
  });

  it("tace con un solo errore", () => {
    expect(sweepFailurePersists([at(58)], PERSIST_MS)).toBe(false);
    expect(sweepFailurePersists([], PERSIST_MS)).toBe(false);
  });

  it("avvisa quando gli errori coprono più giri", () => {
    expect(sweepFailurePersists([at(48), at(53), at(58)], PERSIST_MS)).toBe(true);
  });

  it("non si fa ingannare dall'ordine di arrivo", () => {
    expect(sweepFailurePersists([at(58), at(48)], PERSIST_MS)).toBe(true);
  });
});
