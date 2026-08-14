import { useMemo, useState } from 'react';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';
import type { ExchangeCounts } from '../../utils/exchanges';
import { exchangesToMacros } from '../../utils/exchanges';
import { EXCHANGE_GROUPS, type MacroBucket } from '../../data/exchangeGroups';
import { scaleRecipe } from '../../utils/recipeScaling';
import { composicionDesdeIngredientes } from '../../utils/recipeComposition';
import { estadoComida, avisoDeGrasa } from '../../utils/completitud';
import { BUCKET_LABEL } from '../../utils/mealOptions';
import { Button, Input, fmt } from '../common/ui';

interface Props {
  receta: Receta;
  /** Intercambios pautados de esta comida, para esta clienta. */
  requeridos: ExchangeCounts;
  foods: Alimento[];
  /** Gramos ya ajustados a mano: ingredienteId → gramos. */
  ajustes: Record<string, number>;
  onGuardar: (ajustes: Record<string, number>) => void;
  onCerrar: () => void;
}

/** «3», «3½»: las medias porciones son parte del sistema. */
const porciones = (n: number): string => {
  const entero = Math.floor(n + 0.001);
  const media = n - entero >= 0.4;
  if (!media) return String(entero);
  return entero === 0 ? '½' : `${entero}½`;
};

const TONO: Record<MacroBucket, string> = {
  proteina: 'text-brand-800',
  carbohidrato: 'text-amber-800',
  grasa: 'text-rose-800',
};

/**
 * AJUSTAR LAS CANTIDADES A MANO
 *
 * La app escala la receta a lo pautado y propone unos gramos. Pero la última
 * palabra es de quien pauta: a veces conviene subir el pan y bajar el aceite
 * aunque los macros salgan parecidos, o cuadrar a un número redondo que la
 * clienta pueda medir sin báscula.
 *
 * Arriba va lo pautado de esa comida, que es la referencia contra la que se
 * decide. Debajo, cada ingrediente con sus gramos editables. Y al final, cómo
 * quedan los macros con lo que hay escrito ahora mismo.
 *
 * Lo que se guarda vive en el plan de esa clienta, no en la receta del banco:
 * la misma receta se cuadra distinto según a quién se le pauta.
 */
export function AjustarCantidades({
  receta,
  requeridos,
  foods,
  ajustes,
  onGuardar,
  onCerrar,
}: Props) {
  const [valores, setValores] = useState<Record<string, number>>(ajustes);

  /** Lo que propone la app, sin ajustes: es el punto de partida. */
  const propuesta = useMemo(
    () => scaleRecipe(receta, requeridos, foods),
    [receta, requeridos, foods],
  );

  /** Lo que hay ahora mismo, con lo escrito a mano encima. */
  const actual = useMemo(
    () => scaleRecipe(receta, requeridos, foods, valores),
    [receta, requeridos, foods, valores],
  );

  /**
   * Los macros de verdad de lo que hay escrito. No se pueden sacar del
   * escalado —que razona en intercambios— porque al cambiar los gramos a mano
   * la relación se rompe: hay que volver a leer el catálogo.
   */
  const enPlato = useMemo(() => {
    const ingredientes = actual.ingredientes.map((i) => ({
      ...i,
      cantidad_base: i.cantidad_final,
    }));
    return composicionDesdeIngredientes({ ingredientes }, foods).base as ExchangeCounts;
  }, [actual.ingredientes, foods]);

  const resumen = useMemo(() => estadoComida(requeridos, enPlato), [requeridos, enPlato]);
  const grasa = useMemo(() => avisoDeGrasa(requeridos, enPlato), [requeridos, enPlato]);

  /** Lo pautado, en el idioma con el que se decide: porciones por subgrupo. */
  const pauta = (Object.entries(requeridos) as [keyof typeof EXCHANGE_GROUPS, number][])
    .filter(([g, n]) => n > 0 && !EXCHANGE_GROUPS[g].ilimitado)
    .sort(([a], [b]) => EXCHANGE_GROUPS[a].orden - EXCHANGE_GROUPS[b].orden);

  const hayAjustes = Object.keys(valores).length > 0;

  const poner = (id: string, v: string) => {
    setValores((prev) => {
      if (v === '') {
        const { [id]: _fuera, ...resto } = prev;
        return resto;
      }
      return { ...prev, [id]: Number(v) };
    });
  };

  return (
    <div className="rounded-xl border border-brand-300 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-brand-900">
          Cantidades de «{receta.nombre}»
        </h4>
        <span className="text-[11px] text-slate-400">
          Los cambios son sólo para esta clienta
        </span>
      </div>

      {/* ── Lo pautado, que es la referencia ──────────────── */}
      <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2">
        <p className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
          Esta comida tiene pautado
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-700">
          {pauta.map(([g, n]) => (
            <span key={g}>
              <strong className="tnum font-semibold">{porciones(n)}</strong>{' '}
              {EXCHANGE_GROUPS[g].nombre.toLowerCase()}
            </span>
          ))}
        </p>
      </div>

      {/* ── Los ingredientes, con sus gramos ──────────────── */}
      <ul className="space-y-1.5">
        {actual.ingredientes.map((ing) => {
          const sugerido = propuesta.ingredientes.find((p) => p.id === ing.id);
          const libre = ing.cantidad_base == null || !ing.escalable;

          return (
            <li key={ing.id} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
                {ing.nombre}
                <span className="ml-1.5 text-[10px] text-slate-400">
                  {EXCHANGE_GROUPS[ing.grupo as keyof typeof EXCHANGE_GROUPS]?.nombre.toLowerCase() ??
                    'condimento'}
                </span>
              </span>

              {libre ? (
                <span className="text-xs text-emerald-700">{ing.display}</span>
              ) : (
                <>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={valores[ing.id] ?? ing.cantidad_final ?? ''}
                    onChange={(e) => poner(ing.id, e.target.value)}
                    className="w-20 text-sm"
                  />
                  <span className="w-8 text-[11px] text-slate-400">{ing.unidad}</span>
                  {/* Lo que proponía la app, para poder volver de un vistazo. */}
                  {sugerido?.cantidad_final != null &&
                    valores[ing.id] != null &&
                    valores[ing.id] !== sugerido.cantidad_final && (
                      <button
                        onClick={() => poner(ing.id, '')}
                        className="text-[10px] text-brand-600 underline"
                        title="Volver a lo que calcula la app"
                      >
                        {sugerido.cantidad_final} {ing.unidad}
                      </button>
                    )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      {/* ── Cómo quedan los macros con lo escrito ─────────── */}
      <div className="mt-3 rounded-lg border border-slate-200 p-2.5">
        <p className="mb-1.5 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
          Con estas cantidades
        </p>
        <ul className="space-y-1">
          {resumen.filas.map((f) => (
            <li key={f.bucket} className="flex items-baseline justify-between gap-2 text-xs">
              <span className={TONO[f.bucket]}>{BUCKET_LABEL[f.bucket]}</span>
              <span className="tnum text-slate-600">
                {porciones(f.cubierto)} de {porciones(f.pautado)}
                <span
                  className={`ml-2 ${
                    f.estado === 'ok'
                      ? 'text-emerald-700'
                      : f.estado === 'falta'
                        ? 'text-amber-700'
                        : 'text-rose-700'
                  }`}
                >
                  {f.estado === 'ok'
                    ? '✓'
                    : f.estado === 'falta'
                      ? `faltan ${porciones(Math.abs(f.falta))}`
                      : `sobran ${porciones(Math.abs(f.falta))}`}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <p className="tnum mt-1.5 border-t border-slate-100 pt-1.5 text-[11px] text-slate-500">
          {fmt(kcal(enPlato))} kcal · pautadas {fmt(kcal(requeridos))}
        </p>

        {grasa && <p className="mt-1 text-[11px] text-amber-700">{grasa.texto}</p>}
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {hayAjustes && (
          <Button variant="outline" onClick={() => setValores({})}>
            Volver a lo calculado
          </Button>
        )}
        <Button variant="outline" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button onClick={() => onGuardar(valores)}>Guardar cantidades</Button>
      </div>
    </div>
  );
}

function kcal(counts: ExchangeCounts): number {
  const m = exchangesToMacros(counts);
  return m.hc * 4 + m.proteina * 4 + m.grasa * 9;
}
