import { useState } from 'react';
import type { DayType, ExchangeGrid } from '../../types/plan';
import {
  aplicarReparto,
  borrarReparto,
  cobertura,
  guardarReparto,
  guardarRepartos,
  leerRepartos,
  repartosQueEncajan,
  type PlantillaReparto,
} from '../../utils/repartos';
import { Button, Input, fmt } from '../common/ui';

interface Props {
  dayType: DayType;
  /** Las calorías objetivo de esta persona: es lo que decide qué encaja. */
  kcal: number;
  onGrid: (grid: ExchangeGrid) => void;
}

/**
 * REPARTOS GUARDADOS
 *
 * Dos personas con calorías parecidas y el mismo número de comidas llevan casi
 * el mismo reparto. Guardarlo una vez y aplicarlo con un toque es la
 * diferencia entre montar un reto de veinte y montarlo veinte veces.
 *
 * Los que encajan salen primero, pero se ven todos: dos personas con las
 * mismas calorías pueden necesitar repartos distintos, y eso lo sabe la
 * nutricionista y no la app.
 */
export function RepartosGuardados({ dayType, kcal, onGrid }: Props) {
  const [lista, setLista] = useState<PlantillaReparto[]>(() => leerRepartos());
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [aplicado, setAplicado] = useState<string | null>(null);

  const cambiar = (nueva: PlantillaReparto[]) => {
    guardarRepartos(nueva);
    setLista(nueva);
  };

  const hayReparto = Object.values(dayType.grid).some(
    (c) => Object.keys(c ?? {}).length > 0,
  );

  const guardar = () => {
    const limpio = nombre.trim();
    if (!limpio) return;
    cambiar(guardarReparto(lista, limpio, dayType));
    setNombre('');
    setGuardando(false);
  };

  const ordenados = repartosQueEncajan(lista, kcal, dayType.meals.length);

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-wide text-brand-800 uppercase">
          Repartos guardados
        </h3>
        {hayReparto && !guardando && (
          <button
            onClick={() => setGuardando(true)}
            className="text-[11px] text-brand-700 underline hover:text-brand-900"
          >
            Guardar este reparto
          </button>
        )}
      </div>

      {guardando && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            value={nombre}
            autoFocus
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guardar()}
            placeholder={`${fmt(kcal)} kcal · ${dayType.meals.length} comidas`}
            className="w-56 text-sm"
          />
          <Button onClick={guardar}>Guardar</Button>
          <Button variant="outline" onClick={() => setGuardando(false)}>
            Cancelar
          </Button>
        </div>
      )}

      {!ordenados.length ? (
        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          Monta un reparto y guárdalo con nombre. La próxima persona con calorías y comidas
          parecidas lo tendrá aquí de un toque.
        </p>
      ) : (
        <>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {ordenados.map(({ plantilla, encaja }) => (
              <li key={plantilla.id}>
                <span
                  className={`inline-flex items-center overflow-hidden rounded-lg border ${
                    aplicado === plantilla.id
                      ? 'border-brand-500 bg-brand-50'
                      : encaja
                        ? 'border-brand-300'
                        : 'border-slate-200'
                  }`}
                >
                  <button
                    onClick={() => {
                      onGrid(aplicarReparto(dayType, plantilla));
                      setAplicado(plantilla.id);
                    }}
                    className="px-2.5 py-1 text-left text-xs text-slate-800 transition hover:bg-slate-50"
                  >
                    {plantilla.nombre}
                    <span className="tnum ml-1.5 text-[10px] text-slate-400">
                      {fmt(plantilla.kcal)} kcal · {plantilla.comidasDia} comidas
                    </span>
                    {encaja && (
                      <span className="ml-1.5 text-[10px] font-medium text-brand-700">encaja</span>
                    )}
                  </button>
                  <button
                    onClick={() => cambiar(borrarReparto(lista, plantilla.id))}
                    aria-label={`Borrar ${plantilla.nombre}`}
                    className="px-1.5 py-1 text-[11px] text-slate-300 transition hover:text-rose-600"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>

          {aplicado && (
            <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
              Aplicado a {cobertura(dayType, lista.find((p) => p.id === aplicado)!)} de{' '}
              {dayType.meals.length} comidas. Lo que la plantilla no cubría se ha quedado como
              estaba.
            </p>
          )}
        </>
      )}
    </div>
  );
}
