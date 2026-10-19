/**
 * I preset della pagina Pubblica, letti dalle righe di `config.txt`.
 *
 * Il formato è scritto a mano in un file di configurazione, quindi il parser
 * deve ignorare una riga malformata invece di far sparire tutti i pulsanti.
 */

import { describe, expect, it } from "vitest";
import {
  leggiPreset,
  riconosciPreset,
  valoreDaScrivere,
} from "../lib/pubblica/preset";

const CONFIG = {
  filamento: "@esun3dprinting PLA Matte",
  preset_stampante_h2c:
    "H2C | stampante=@bambulab_official H2C | hashtag=#bambulab #h2c",
  preset_stampante_u1:
    "U1 | stampante=@snapmakerinc U1 | hashtag=#snapmaker #snapmakeru1",
  preset_filamento_esun_matte:
    "eSun PLA Matte | filamento=@esun3dprinting PLA Matte",
};

describe("leggiPreset", () => {
  it("raggruppa i preset per campo, nell'ordine del file", () => {
    const gruppi = leggiPreset(CONFIG);
    expect(Object.keys(gruppi)).toEqual(["stampante", "filamento"]);
    expect(gruppi.stampante.map((p) => p.etichetta)).toEqual(["H2C", "U1"]);
  });

  it("tiene tutti i campi di un preset, hashtag compreso", () => {
    expect(leggiPreset(CONFIG).stampante[1]).toEqual({
      id: "preset_stampante_u1",
      etichetta: "U1",
      campi: { stampante: "@snapmakerinc U1", hashtag: "#snapmaker #snapmakeru1" },
    });
  });

  it("legge il nome del preset anche quando contiene underscore", () => {
    expect(leggiPreset(CONFIG).filamento[0].campi).toEqual({
      filamento: "@esun3dprinting PLA Matte",
    });
  });

  it("ignora le chiavi che non sono preset", () => {
    expect(leggiPreset({ filamento: "@esun3dprinting PLA Matte" })).toEqual({});
  });

  it("scarta una riga senza etichetta, senza campi o senza gruppo", () => {
    expect(
      leggiPreset({
        preset_stampante_x: " | stampante=@a X",
        preset_stampante_y: "Y",
        preset_stampante_z: "Z | niente",
        preset_senzagruppo: "W | stampante=@a W",
        preset_stampante_: "V | stampante=@a V",
      })
    ).toEqual({});
  });

  it("non si fida del tipo: config arriva da una risposta HTTP", () => {
    expect(leggiPreset({ preset_stampante_a: 42 })).toEqual({});
  });
});

describe("riconosciPreset", () => {
  const gruppi = leggiPreset(CONFIG);
  const campi = (valori: Record<string, string>) => (campo: string) =>
    valori[campo] ?? "";

  it("riaccende il preset che corrisponde al valore memorizzato", () => {
    expect(
      riconosciPreset(gruppi, campi({ stampante: "@snapmakerinc U1" }))
    ).toEqual({
      attivi: { stampante: "preset_stampante_u1" },
      hashtag: { stampante: "#snapmaker #snapmakeru1" },
    });
  });

  it("ignora gli spazi intorno al valore", () => {
    expect(
      riconosciPreset(gruppi, campi({ stampante: "  @snapmakerinc U1  " }))
        .attivi.stampante
    ).toBe("preset_stampante_u1");
  });

  it("non accende niente per un valore scritto a mano", () => {
    expect(
      riconosciPreset(gruppi, campi({ stampante: "@bambulab_official X1C" }))
    ).toEqual({ attivi: {}, hashtag: {} });
  });

  it("non inventa un hashtag per un preset che non ne ha", () => {
    const esito = riconosciPreset(
      gruppi,
      campi({ filamento: "@esun3dprinting PLA Matte" })
    );
    expect(esito.attivi.filamento).toBe("preset_filamento_esun_matte");
    expect(esito.hashtag).toEqual({});
  });

  it("sta zitto quando i campi sono vuoti", () => {
    expect(riconosciPreset(gruppi, campi({}))).toEqual({
      attivi: {},
      hashtag: {},
    });
  });
});

describe("valoreDaScrivere", () => {
  it("lascia spazio per il materiale dopo una menzione nuda", () => {
    expect(valoreDaScrivere("@sunlu3dofficial")).toBe("@sunlu3dofficial ");
  });

  it("non tocca un valore già completo", () => {
    expect(valoreDaScrivere("@bambulab_official H2C")).toBe(
      "@bambulab_official H2C"
    );
  });
});
