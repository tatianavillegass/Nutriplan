import { useState } from 'react';
import type { IngredienteEscalado } from '../../types/recipe';
import type { Alimento } from '../../types/food';
import type { ExchangeCounts } from '../../utils/exchanges';
import { exchangesToMacros } from '../../utils/exchanges';
import { kcalFromMacros } from '../../utils/macros';
import { canRemoveIngredient } from '../../utils/recipeScaling';
import { substitutionOptions, type CustomizationState } from '../../utils/substitutions';
import { alternarCuenta, type Anadido } from '../../utils/anadidos';
import type { ResumenComida } from '../../utils/completitud';
import { MealCompleteness } from './MealCompleteness';
import { AddFoodPanel } from './AddFoodPanel';
import { fmt } from '../common/ui';

interface Props {
  ingredientes: IngredienteEscalado[];
  /** Ingredientes ya personalizados (para mostrar el gramaje resultante). */
  resultado: IngredienteEscalado[];
  foods: Alimento[];
  state: CustomizationState;
  onChange: (s: CustomizationState) => void;
  /** Intercambios pautados por la nutricionista. */
  antes: ExchangeCounts;
  /** Intercambios efectivos tras los cambios del cliente. */
  despues: ExchangeCounts;
  /** Pautado vs lo que hay en el plato: si la comida está completa. */
  resumen: ResumenComida;
  /** Intercambios añadidos por encima del plan. */
  extras: ExchangeCounts;
  avisos: string[];
  onBloqueado: (motivo: string) => void;
}

const FILAS = [
  { key: 'proteina', label: 'Proteína', dec: 1, u: 'g' },
  { key: 'hc', label: 'Carbohidratos', dec: 1, u: 'g' },
  { key: 'grasa', label: 'Grasas', dec: 1, u: 'g' },
] as const;

/**
 * PERSONALIZACIÓN POR EL CLIENTE (§5)
 *
 * Reglas: quitar verduras y condimentos ✅ · sustituir dentro de la lista ✅ ·
 * quitar un ingrediente escalable ❌ · editar cantidades a mano ❌.
 */
export function RecipeCustomizer({
  ingredientes,
  resultado,
  foods,
  state,
  onChange,
  antes,
  despues,
  resumen,
  extras,
  avisos,
  onBloqueado,
}: Props) {
  const mAntes = exchangesToMacros(antes);
  const mDespues = exchangesToMacros(despues);
  const kAntes = kcalFromMacros(mAntes);
  const kDespues = kcalFromMacros(mDespues);
  const identicos = Math.abs(kAntes - kDespues) < 0.01;

  /** Kcal de lo marcado como extra: van por encima de lo pautado. */
  const kExtra = kcalFromMacros(exchangesToMacros(extras));

  /** Hueco pulsado en el checklist, para abrir el panel de añadir ahí. */
  const [foco, setFoco] = useState<{ familia: string; nonce: number } | null>(null);

  const resultadoPorId = new Map(resultado.map((i) => [i.id, i]));

  const anadidos = state.anadidos ?? [];
  const setAnadidos = (a: Anadido[]) => onChange({ ...state, anadidos: a });

  const toggleQuitar = (ing: IngredienteEscalado) => {
    const r = canRemoveIngredient(ing);
    if (!r.allowed) {
      onBloqueado(r.reason ?? 'Esto cambiaría la composición de tu plan');
      return;
    }
    const quitados = state.quitados.includes(ing.id)
      ? state.quitados.filter((x) => x !== ing.id)
      : [...state.quitados, ing.id];
    onChange({ ...state, quitados });
  };

  const setSust = (id: string, nombre: string) =>
    onChange({ ...state, sustituciones: { ...state.sustituciones, [id]: nombre } });

  return (
    <aside className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4 no-print">
      <div>
        <p className="text-xs font-semibold tracking-wide text-brand-800 uppercase">
          Personalizar
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
          Puedes quitar verduras y condimentos, cambiar un alimento por otro de su lista y añadir lo
          que falte. Las cantidades las calcula la app.
        </p>
      </div>

      {/* ── ¿Está completa? ───────────────────────────────── */}
      <MealCompleteness
        resumen={resumen}
        onCompletar={(f) => setFoco({ familia: f.familia, nonce: Date.now() })}
      />

      {/* ── Añadir: verdura libre, completar el plan, extras ── */}
      <AddFoodPanel
        foods={foods}
        resumen={resumen}
        anadidos={anadidos}
        foco={foco}
        onAnadir={(a) => setAnadidos([...anadidos, a])}
        onQuitar={(id) => setAnadidos(anadidos.filter((a) => a.id !== id))}
        onAlternarCuenta={(id) =>
          setAnadidos(anadidos.map((a) => (a.id === id ? alternarCuenta(a) : a)))
        }
      />

      <ul className="space-y-2">
        {ingredientes.map((ing) => {
          const bloqueado = !canRemoveIngredient(ing).allowed;
          const quitado = state.quitados.includes(ing.id);
          const opciones = substitutionOptions(ing, foods);
          const actual = resultadoPorId.get(ing.id);

          return (
            <li
              key={ing.id}
              className={`rounded-lg border bg-white px-2.5 py-2 transition ${
                quitado ? 'border-slate-200 opacity-50' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-700">
                  {ing.nombre}
                  {actual && actual.nombre !== ing.nombre && (
                    <span className="ml-1 text-brand-600">→ {actual.nombre}</span>
                  )}
                </span>
                <button
                  onClick={() => toggleQuitar(ing)}
                  title={bloqueado ? 'Bloqueado: cambiaría tu plan' : quitado ? 'Restaurar' : 'Quitar'}
                  className={`shrink-0 rounded-full px-1.5 text-[11px] leading-5 ${
                    bloqueado
                      ? 'cursor-not-allowed bg-slate-50 text-slate-300'
                      : quitado
                        ? 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                        : 'bg-slate-100 text-slate-500 hover:bg-red-500 hover:text-white'
                  }`}
                >
                  {bloqueado ? '🔒' : quitado ? '↺' : '×'}
                </button>
              </div>

              {!quitado && !!opciones.length && (
                <select
                  value={state.sustituciones[ing.id] ?? ''}
                  onChange={(e) => setSust(ing.id, e.target.value)}
                  className="mt-1.5 w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-600 outline-none focus:border-brand-400"
                >
                  <option value="">Original — {ing.display}</option>
                  {opciones.map((o) => (
                    <option key={o.nombre} value={o.nombre}>
                      {o.nombre}
                      {o.sinReferencia ? ' (mismo gramaje)' : !o.mismoGrupo ? ' · otro grupo' : ''}
                    </option>
                  ))}
                </select>
              )}

              {!quitado && actual && actual.display !== ing.display && (
                <p className="tnum mt-1 text-[10px] text-brand-700">Nueva cantidad: {actual.display}</p>
              )}
            </li>
          );
        })}
      </ul>

      {/* ── Panel macros antes vs después ─────────────────── */}
      <div className="rounded-lg border border-brand-200 bg-white p-3">
        <p className="text-[11px] font-semibold text-brand-800">Macros antes vs después</p>
        <table className="tnum mt-1.5 w-full text-[11px]">
          <thead>
            <tr className="text-slate-400">
              <th className="text-left font-normal"></th>
              <th className="w-14 text-right font-normal">Antes</th>
              <th className="w-14 text-right font-normal">Después</th>
            </tr>
          </thead>
          <tbody>
            {FILAS.map((f) => {
              const a = mAntes[f.key];
              const d = mDespues[f.key];
              const igual = Math.abs(a - d) < 0.05;
              return (
                <tr key={f.key} className="border-t border-slate-100">
                  <td className="py-0.5 text-slate-600">{f.label}</td>
                  <td className="py-0.5 text-right text-slate-500">{fmt(a, f.dec)}</td>
                  <td
                    className={`py-0.5 text-right font-medium ${
                      igual ? 'text-slate-700' : 'text-amber-700'
                    }`}
                  >
                    {fmt(d, f.dec)}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-slate-200">
              <td className="py-0.5 font-medium text-slate-700">Calorías</td>
              <td className="py-0.5 text-right text-slate-500">{fmt(kAntes)}</td>
              <td
                className={`py-0.5 text-right font-semibold ${
                  identicos ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {fmt(kDespues)}
              </td>
            </tr>
          </tbody>
        </table>

        <p
          className={`mt-2 rounded px-2 py-1 text-[10px] leading-snug ${
            identicos ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
          }`}
        >
          {identicos
            ? 'Tus cambios no alteran el plan: las sustituciones son dentro del mismo grupo de intercambio.'
            : 'Has elegido un sustituto de otro grupo. Sigue siendo válido, pero tus macros del día se mueven un poco.'}
        </p>

        {kExtra > 0 && (
          <p className="tnum mt-1.5 rounded bg-amber-50 px-2 py-1 text-[10px] leading-snug text-amber-800">
            Además, {fmt(kExtra)} kcal en extras por encima de lo pautado.
          </p>
        )}

        {avisos.map((a) => (
          <p key={a} className="mt-1.5 text-[10px] leading-snug text-amber-700">
            {a}
          </p>
        ))}
      </div>

      {(state.quitados.length > 0 ||
        Object.values(state.sustituciones).some(Boolean) ||
        anadidos.length > 0) && (
        <button
          onClick={() => onChange({ quitados: [], sustituciones: {}, anadidos: [] })}
          className="text-[11px] text-brand-600 underline"
        >
          Deshacer todos los cambios
        </button>
      )}
    </aside>
  );
}
