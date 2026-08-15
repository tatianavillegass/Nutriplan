import type { DayType } from "../../types/plan";
import type { Client } from "../../types/client";
import type { Medicion } from "../../types/anthropometry";
import { planTargets } from "../../utils/macros";
import {
  LABEL_BASE_PESO,
  baseSugerida,
  pesoDeReferencia,
  pesosPosibles,
} from "../../utils/pesoReferencia";
import { Card, Field, Input, fmt } from "../common/ui";

interface Props {
  dayType: DayType;
  client: Client;
  mediciones: Medicion[];
  caloriasBase: number;
  onChange: (patch: Partial<DayType>) => void;
  /** Cambiar sobre qué peso se calculan los g/kg: va en la ficha, no en el día. */
  onCliente: (patch: Partial<Client>) => void;
}

export function MacroTargets({
  dayType,
  client,
  mediciones,
  caloriasBase,
  onChange,
  onCliente,
}: Props) {
  const kcal = dayType.caloriasOverride ?? caloriasBase;

  /**
   * SOBRE QUÉ PESO SE MULTIPLICAN LOS g/kg
   *
   * 2 g/kg sobre el peso total sobreestima en cuanto hay mucha grasa: a alguien
   * de 110 kg le salen 220 g de proteína, que no necesita nadie. Aquí se elige
   * el peso de referencia, con los tres números delante.
   */
  const base = client.basePeso ?? "total";
  const referencia = pesoDeReferencia(client, mediciones, base);
  const peso = referencia.kg;
  const opciones = pesosPosibles(client, mediciones);
  const sugerida = baseSugerida(client, mediciones);

  const t = planTargets(kcal, peso, dayType.proteinaGkg, dayType.hcGkg);
  const grasaNegativa = t.grasa < 0;

  const rows = [
    {
      label: "Proteína",
      g: t.proteina,
      gkg: t.gkg.proteina,
      pct: t.pct.proteina,
      color: "#2E6B5E",
      editable: "proteinaGkg" as const,
    },
    {
      label: "Carbohidratos",
      g: t.hc,
      gkg: t.gkg.hc,
      pct: t.pct.hc,
      color: "#B08A3E",
      editable: "hcGkg" as const,
    },
    {
      label: "Grasas",
      g: t.grasa,
      gkg: t.gkg.grasa,
      pct: t.pct.grasa,
      color: "#D4A04F",
      editable: null,
    },
  ];

  return (
    <Card
      title="Objetivos de macros"
      subtitle="La grasa siempre sale por diferencia — nunca se introduce a mano"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Calorías del tipo de día"
          hint={`Base del cliente: ${fmt(caloriasBase)} kcal`}
        >
          <Input
            type="number"
            value={Math.round(kcal)}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChange({
                caloriasOverride:
                  Math.abs(v - caloriasBase) < 1 ? undefined : v,
              });
            }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={`Proteína g/kg de ${LABEL_BASE_PESO[referencia.base].toLowerCase()}`}
          >
            <Input
              type="number"
              step="0.1"
              value={dayType.proteinaGkg}
              onChange={(e) =>
                onChange({ proteinaGkg: Number(e.target.value) })
              }
            />
          </Field>
          <Field
            label={`HC g/kg de ${LABEL_BASE_PESO[referencia.base].toLowerCase()}`}
          >
            <Input
              type="number"
              step="0.1"
              value={dayType.hcGkg}
              onChange={(e) => onChange({ hcGkg: Number(e.target.value) })}
            />
          </Field>
        </div>
      </div>

      {/*
        Los tres pesos juntos: sin verlos al lado, «peso ajustado» es una
        palabra; viendo 92 → 78 kg se entiende de qué estamos hablando.
      */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="mb-1.5 text-[11px] font-medium text-slate-600">
          Los gramos por kilo se multiplican por…
        </p>
        <div className="flex flex-wrap gap-1.5">
          {opciones.map((o) => {
            const puesta = base === o.base;
            const hay = o.kg != null;
            return (
              <button
                key={o.base}
                disabled={!hay}
                onClick={() => onCliente({ basePeso: o.base })}
                className={`rounded-lg border px-3 py-1.5 text-left text-xs transition ${
                  puesta
                    ? "border-brand-500 bg-brand-600 text-white"
                    : hay
                      ? "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
                      : "cursor-not-allowed border-dashed border-slate-200 text-slate-300"
                }`}
              >
                <span className="block font-medium">
                  {LABEL_BASE_PESO[o.base]}
                </span>
                <span
                  className={`tnum ${puesta ? "text-white/80" : "text-slate-400"}`}
                >
                  {hay ? `${fmt(o.kg!, 1)} kg` : "sin datos"}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
          {referencia.explicacion}
        </p>

        {sugerida !== base && (
          <p className="mt-1 text-[11px] leading-snug text-amber-700">
            {sugerida === "magra"
              ? "Tienes su composición medida: sobre masa libre de grasa el número es real, no una estimación."
              : "Con este peso, los g/kg sobre el total se le van a quedar altos: el tejido graso pesa pero no pide proteína."}{" "}
            <button
              onClick={() => onCliente({ basePeso: sugerida })}
              className="font-medium underline decoration-dotted underline-offset-2"
            >
              Usar {LABEL_BASE_PESO[sugerida].toLowerCase()}
            </button>
          </p>
        )}

        {referencia.base !== "total" && (
          <p className="mt-1 text-[11px] leading-snug text-slate-400">
            Las calorías no cambian: el gasto se calcula con su peso real,{" "}
            {fmt(client.peso, 1)} kg.
          </p>
        )}
      </div>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-[11px] tracking-wide text-slate-400 uppercase">
            <th className="pb-1.5 text-left font-medium">Macro</th>
            <th className="pb-1.5 text-right font-medium">Total (g)</th>
            <th className="pb-1.5 text-right font-medium">g/kg</th>
            <th className="pb-1.5 text-right font-medium">% kcal</th>
          </tr>
        </thead>
        <tbody className="tnum">
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-slate-100">
              <td className="py-1.5">
                <span className="inline-flex items-center gap-2 text-slate-700">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: r.color }}
                  />
                  {r.label}
                  {!r.editable && (
                    <span className="rounded bg-slate-100 px-1 text-[9px] text-slate-500">
                      por diferencia
                    </span>
                  )}
                </span>
              </td>
              <td className="py-1.5 text-right font-medium text-slate-800">
                {fmt(r.g, 1)}
              </td>
              <td className="py-1.5 text-right text-slate-600">
                {r.gkg.toFixed(2)}
              </td>
              <td className="py-1.5 text-right text-slate-500">
                {fmt(r.pct, 0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {grasaNegativa && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          La proteína y los carbohidratos ya superan las calorías objetivo: la
          grasa sale negativa. Baja algún g/kg o sube las calorías del día.
        </p>
      )}
    </Card>
  );
}
