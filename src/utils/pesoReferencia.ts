import type { Client } from "../types/client";
import { edadDe } from "../types/client";
import type { Medicion } from "../types/anthropometry";
import { calcComposicion, ordenarMediciones } from "./anthropometry";

/**
 * SOBRE QUÉ PESO SE CALCULAN LOS GRAMOS POR KILO
 *
 * Pautar 2 g/kg sobre el peso total sobreestima en cuanto hay mucha grasa: el
 * tejido graso pesa pero casi no pide proteína. A una persona de 110 kg le
 * salen 220 g de proteína al día, que no necesita nadie, y de ahí sale un plan
 * imposible de comer y una grasa por diferencia en negativo.
 *
 * Hay tres formas de arreglarlo, de mejor a peor según lo que se haya medido:
 *
 *   1. MASA LIBRE DE GRASA — la buena. Si hay pliegues o bioimpedancia se sabe
 *      cuánta máquina tiene de verdad esa persona, y la proteína se calcula
 *      sobre eso. Ojo: sobre masa magra los g/kg son otros números, porque el
 *      denominador es más pequeño (1,6-2,2 g/kg de peso total ≈ 2-2,5 sobre
 *      masa magra en una persona con grasa normal).
 *
 *   2. PESO AJUSTADO — la de siempre en clínica cuando no hay antropometría.
 *      Se toma el peso ideal y se le suma una cuarta parte de lo que sobra:
 *      del exceso de peso, algo sí es tejido activo. Es una estimación, pero
 *      es la estimación que usa todo el mundo.
 *
 *   3. PESO TOTAL — lo correcto cuando el peso está en su sitio. Con un IMC
 *      normal, ajustar no cambia nada y complica la conversación.
 *
 * IMPORTANTE: esto sólo afecta a los gramos por kilo. Las calorías salen del
 * gasto, y las fórmulas de gasto (Mifflin, Harris) SÍ usan el peso real —
 * mover un cuerpo de 110 kg cuesta lo que cuesta.
 */

export type BasePeso = "total" | "ajustado" | "magra";

export const LABEL_BASE_PESO: Record<BasePeso, string> = {
  total: "Peso total",
  ajustado: "Peso ajustado",
  magra: "Masa libre de grasa",
};

/** IMC de referencia para el peso ideal: el centro del rango normal. */
export const IMC_IDEAL = 22.5;

/** A partir de aquí el peso total empieza a mentir en los g/kg. */
export const IMC_PARA_AJUSTAR = 27;

/** Lo que pesaría con un IMC de 22,5. */
export function pesoIdeal(alturaCm?: number): number | undefined {
  if (!alturaCm || alturaCm < 100) return undefined;
  const m = alturaCm / 100;
  return IMC_IDEAL * m * m;
}

/**
 * Peso ideal más una cuarta parte de lo que sobra. Por debajo del ideal no se
 * toca: a quien está por debajo de peso no se le recorta la proteína.
 */
export function pesoAjustado(
  peso?: number,
  alturaCm?: number,
): number | undefined {
  const ideal = pesoIdeal(alturaCm);
  if (!peso || !ideal) return undefined;
  if (peso <= ideal) return peso;
  return ideal + 0.25 * (peso - ideal);
}

/**
 * Los kilos que no son grasa, de la última medición que lo permita.
 *
 * Manda la antropometría: es lo que ella mide y con la fórmula que ella eligió.
 * La báscula de bioimpedancia entra sólo si no hay pliegues — su número sale
 * de una fórmula que no conocemos, así que es el segundo plato.
 */
export function masaLibreDeGrasa(
  client: Pick<Client, "sexo" | "fechaNacimiento" | "edad" | "formulaGrasa">,
  mediciones: Medicion[],
): { kg: number; de: "pliegues" | "bascula"; fecha: string } | undefined {
  const orden = ordenarMediciones(mediciones);

  for (let i = orden.length - 1; i >= 0; i--) {
    const m = orden[i];
    if (!m.peso) continue;

    const c = calcComposicion(m, client.sexo, edadDe(client));
    const magra = c.masaMagraKg[client.formulaGrasa ?? "faulkner"];
    if (magra != null)
      return { kg: magra, de: "pliegues", fecha: m.fecha.slice(0, 10) };

    const grasaBascula = m.bioimpedancia?.grasaPct;
    if (grasaBascula != null && grasaBascula > 0 && grasaBascula < 70) {
      return {
        kg: m.peso * (1 - grasaBascula / 100),
        de: "bascula",
        fecha: m.fecha.slice(0, 10),
      };
    }
  }
  return undefined;
}

export interface PesoDeReferencia {
  /** Los kilos con los que se multiplican los g/kg. */
  kg: number;
  base: BasePeso;
  /** Una línea que explica de dónde sale, para que no sea un número mágico. */
  explicacion: string;
}

/**
 * El peso que se usa para los gramos por kilo. Si lo pedido no se puede
 * calcular —masa magra sin mediciones— se cae al peso total, que siempre está.
 */
export function pesoDeReferencia(
  client: Client,
  mediciones: Medicion[],
  base: BasePeso = client.basePeso ?? "total",
): PesoDeReferencia {
  const total = {
    kg: client.peso,
    base: "total" as const,
    explicacion: "Su peso de hoy.",
  };

  if (base === "magra") {
    const magra = masaLibreDeGrasa(client, mediciones);
    if (!magra)
      return {
        ...total,
        explicacion: "Sin mediciones todavía: se usa el peso total.",
      };
    return {
      kg: magra.kg,
      base: "magra",
      explicacion:
        magra.de === "pliegues"
          ? `Sus kilos sin grasa, de los pliegues del ${magra.fecha}.`
          : `Sus kilos sin grasa, de la báscula del ${magra.fecha}.`,
    };
  }

  if (base === "ajustado") {
    const ajustado = pesoAjustado(client.peso, client.altura);
    if (ajustado == null || ajustado >= client.peso) {
      return {
        ...total,
        explicacion: "Su peso está en su sitio: ajustar no cambiaría nada.",
      };
    }
    return {
      kg: ajustado,
      base: "ajustado",
      explicacion: `Su peso ideal más una cuarta parte de lo que sobra (${Math.round(client.peso)} → ${Math.round(ajustado)} kg).`,
    };
  }

  return total;
}

/**
 * QUÉ CONVIENE USAR CON LO QUE HAY MEDIDO
 *
 * Se sugiere, no se impone: el número lo decide ella. Pero un plan calculado
 * sobre 110 kg no debería salir nunca por descuido.
 */
export function baseSugerida(client: Client, mediciones: Medicion[]): BasePeso {
  if (masaLibreDeGrasa(client, mediciones)) return "magra";

  const ideal = pesoIdeal(client.altura);
  if (!ideal || !client.peso || !client.altura) return "total";

  const imc = client.peso / (client.altura / 100) ** 2;
  return imc >= IMC_PARA_AJUSTAR ? "ajustado" : "total";
}

/** Los tres pesos, para poder enseñarlos juntos y comparar. */
export function pesosPosibles(
  client: Client,
  mediciones: Medicion[],
): { base: BasePeso; kg?: number }[] {
  return [
    { base: "total", kg: client.peso },
    { base: "ajustado", kg: pesoAjustado(client.peso, client.altura) },
    { base: "magra", kg: masaLibreDeGrasa(client, mediciones)?.kg },
  ];
}
