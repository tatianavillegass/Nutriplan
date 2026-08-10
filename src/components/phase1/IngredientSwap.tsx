import { useMemo, useState } from 'react';
import type { Alimento } from '../../types/food';
import type { IngredienteEscalado } from '../../types/recipe';
import { EXCHANGE_GROUPS, type ExchangeGroupId } from '../../data/exchangeGroups';
import { gramosPorIntercambio } from '../../utils/recipeComposition';
import { roundPortion } from '../../utils/macros';
import { escalarMedida } from '../../utils/measures';
import { coincide, equivalentesOrdenados, norm } from '../../utils/similitud';

interface Props {
  ingrediente: IngredienteEscalado;
  /** Intercambios que cubre este ingrediente en la comida. */
  intercambios: number;
  foods: Alimento[];
  /** Alimento por el que ya se ha cambiado, si lo hay. */
  cambiadoPor?: string;
  onCambiar: (foodId: string | undefined) => void;
}

/**
 * Cambiar un ingrediente por su equivalente.
 *
 * El cliente pulsa "pollo" y ve el resto de proteicos magros con el gramaje
 * ya recalculado. Como el cambio es dentro del mismo grupo de intercambio,
 * el plan no se mueve: sólo cambia el alimento y sus gramos.
 */
export function IngredientSwap({
  ingrediente,
  intercambios,
  foods,
  cambiadoPor,
  onCambiar,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const grupo = ingrediente.grupo as ExchangeGroupId;
  const info = EXCHANGE_GROUPS[grupo];

  const [busqueda, setBusqueda] = useState('');

  /** El alimento del que se parte, para poder ordenar por parecido. */
  const original = useMemo(
    () =>
      foods.find((f) => f.id === ingrediente.foodId) ??
      foods.find((f) => norm(f.nombre) === norm(ingrediente.nombre)),
    [foods, ingrediente.foodId, ingrediente.nombre],
  );

  const alternativas = useMemo(() => {
    if (!info) return [];
    // Lo más parecido primero: pollo → pavo antes que pollo → tofu.
    const lista = original
      ? equivalentesOrdenados(original, foods)
      : foods
          .filter((f) => f.grupo === grupo && !!gramosPorIntercambio(f))
          .sort((a, b) => a.nombre.localeCompare(b.nombre));

    return lista.map((f) => {
      const gpi = gramosPorIntercambio(f) as number;
      return {
        food: f,
        gramos: roundPortion(gpi * intercambios),
        medida: escalarMedida(f.medida_casera, intercambios),
      };
    });
  }, [foods, grupo, intercambios, info, original]);

  const visibles = useMemo(
    () => alternativas.filter((a) => coincide(a.food.nombre, busqueda)),
    [alternativas, busqueda],
  );

  const actual = cambiadoPor ? foods.find((f) => f.id === cambiadoPor) : undefined;

  if (!info || alternativas.length < 1) return null;

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setAbierto((v) => !v)}
        title={`Cambiar ${ingrediente.nombre.toLowerCase()} por otro equivalente`}
        className={`ml-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition no-print ${
          actual
            ? 'border-brand-500 bg-brand-600 text-white hover:bg-brand-700'
            : 'border-brand-300 bg-white text-brand-700 hover:border-brand-500 hover:bg-brand-50'
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M4 8h13l-3-3M20 16H7l3 3" />
        </svg>
        {actual ? 'Cambiado' : 'Cambiar'}
      </button>

      {abierto && (
        <>
          <span
            className="fixed inset-0 z-20"
            onClick={() => setAbierto(false)}
            aria-hidden
          />
          <span className="absolute top-full left-0 z-30 mt-1 block w-72 rounded-lg border border-slate-200 bg-white shadow-lg no-print">
            <span className="block border-b border-slate-100 p-2">
              <input
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={`Buscar en ${info.nombre.toLowerCase()}…`}
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-400"
              />
              <span className="mt-1 block text-[10px] text-slate-400">
                {original
                  ? 'Ordenados por parecido — todos aportan los mismos intercambios'
                  : 'Todos aportan los mismos intercambios'}
              </span>
            </span>

            <span className="block max-h-60 overflow-auto py-1">
              {cambiadoPor && (
                <button
                  onClick={() => {
                    onCambiar(undefined);
                    setAbierto(false);
                    setBusqueda('');
                  }}
                  className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-50"
                >
                  ← Volver a {ingrediente.nombre.toLowerCase()}
                </button>
              )}

              {visibles.map(({ food, gramos, medida }, i) => (
                <button
                  key={food.id}
                  onClick={() => {
                    onCambiar(food.id);
                    setAbierto(false);
                    setBusqueda('');
                  }}
                  className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-brand-50 ${
                    food.id === cambiadoPor
                      ? 'bg-brand-50 font-medium text-brand-800'
                      : 'text-slate-700'
                  }`}
                >
                  {!busqueda && i < 3 && original && (
                    <span className="shrink-0 text-[9px] text-emerald-600" title="De lo más parecido">
                      ★
                    </span>
                  )}
                  <span className="flex-1 truncate">{food.nombre}</span>
                  <span className="tnum shrink-0 text-[11px] text-slate-500">
                    {gramos} {food.unidad ?? 'g'}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-400">{medida}</span>
                </button>
              ))}

              {!visibles.length && (
                <span className="block px-3 py-2 text-[11px] text-slate-500">
                  Nada con «{busqueda.trim()}» en {info.nombre.toLowerCase()}.
                </span>
              )}
            </span>
          </span>
        </>
      )}
    </span>
  );
}
