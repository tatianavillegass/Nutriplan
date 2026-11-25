import type { DayType } from '../../types/plan';
import type { MacroBucket } from '../../data/exchangeGroups';
import { bucketExchanges, deDondeSale, gridTotals } from '../../utils/exchanges';

const fmtEx = (n: number) => (n ? (Number.isInteger(n) ? String(n) : n.toFixed(1)) : '');

const MACROS: { bucket: MacroBucket; nombre: string }[] = [
  { bucket: 'proteina', nombre: 'Proteína' },
  { bucket: 'carbohidrato', nombre: 'Carbohidrato' },
  { bucket: 'grasa', nombre: 'Grasa' },
];

/** §6.1 — "ESQUEMA DEL PLAN": una tabla por tipo de día, limpia e imprimible. */
export function PlanSchemaTable({ dayType }: { dayType: DayType }) {
  const totalesPorGrupo = gridTotals(dayType.grid, dayType.meals);
  const totales = bucketExchanges(totalesPorGrupo);

  return (
    <div className="print-sheet rounded-xl border border-brand-100 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-center text-base font-semibold tracking-wide text-brand-800">
        Plan Días {dayType.nombre}
      </h3>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-2/5 border border-brand-200 bg-brand-700 px-3 py-2 text-left text-xs font-semibold text-white"></th>
            <th className="border border-brand-200 bg-brand-700 px-3 py-2 text-center text-xs font-semibold text-white">
              Proteína
            </th>
            <th className="border border-brand-200 bg-brand-700 px-3 py-2 text-center text-xs font-semibold text-white">
              Carbohidrato
            </th>
            <th className="border border-brand-200 bg-brand-700 px-3 py-2 text-center text-xs font-semibold text-white">
              Grasa
            </th>
          </tr>
        </thead>
        <tbody className="tnum">
          {dayType.meals.map((m) => {
            const b = bucketExchanges(dayType.grid[m.id] ?? {});
            return (
              <tr key={m.id}>
                <td className="border border-brand-100 px-3 py-2 font-medium text-slate-700">{m.nombre}</td>
                <td className="border border-brand-100 px-3 py-2 text-center text-slate-800">{fmtEx(b.proteina)}</td>
                <td className="border border-brand-100 px-3 py-2 text-center text-slate-800">{fmtEx(b.carbohidrato)}</td>
                <td className="border border-brand-100 px-3 py-2 text-center text-slate-800">{fmtEx(b.grasa)}</td>
              </tr>
            );
          })}
          <tr className="bg-brand-50 font-semibold">
            <td className="border border-brand-200 px-3 py-2 text-brand-900 uppercase">Total</td>
            <td className="border border-brand-200 px-3 py-2 text-center text-brand-900">{fmtEx(totales.proteina)}</td>
            <td className="border border-brand-200 px-3 py-2 text-center text-brand-900">{fmtEx(totales.carbohidrato)}</td>
            <td className="border border-brand-200 px-3 py-2 text-center text-brand-900">{fmtEx(totales.grasa)}</td>
          </tr>
        </tbody>
      </table>
      {/*
        DE DÓNDE SALE CADA TOTAL
        ========================
        «En cálculo plan puse 5 proteínas pero en entrega me aparece como si
        hubiese puesto 6.» Las dos cuentas son buenas, pero son distintas: allí
        se reparte **por subgrupo** y aquí se suma **por macro**, y al macro de
        proteína entran también los lácteos proteicos y las legumbres —que son
        hidrato y proteína a la vez, porque sus 7 g lo son igual que los de un
        proteico magro—.
        Un total que no cuadra con lo que acabas de escribir no se lee como
        otra cuenta: se lee como un error. Así que se desglosa, y **sólo cuando
        hay más de un subgrupo detrás**: con uno, el número ya se explica solo.
      */}
      <div className="mt-3 space-y-0.5">
        {MACROS.map(({ bucket, nombre }) => {
          const partes = deDondeSale(totalesPorGrupo, bucket);
          if (partes.length < 2) return null;
          return (
            <p key={bucket} className="text-[11px] leading-snug text-slate-500">
              <span className="font-medium text-slate-600">
                {nombre} {fmtEx(totales[bucket])}
              </span>
              {' = '}
              {partes.map((p) => `${fmtEx(p.n)} ${p.nombre}`).join(' + ')}
            </p>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        Verdura ilimitada (mínimo ½ plato: 200 g) en comida y cena.
      </p>
    </div>
  );
}
