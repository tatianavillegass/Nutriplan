import { useState } from 'react';
import { Button, Input } from '../common/ui';

export interface Props {
  mealNombre: string;
  /** Lo que apuntó la última vez en esta comida, si hay algo. */
  repetir?: { deCuando: string; onUsar: () => void };
  /** Sus comidas habituales de esta comida. */
  guardadas: { id: string; nombre: string; onUsar: () => void; onBorrar: () => void }[];
  /** Sólo se puede guardar si hoy hay algo apuntado en esta comida. */
  onGuardar?: (nombre: string) => void;
}

/**
 * LO DE SIEMPRE, EN DOS TOQUES
 *
 * Quien desayuna lo mismo todos los días estaba apuntando cinco alimentos con
 * sus gramos cada mañana. Eso es el trabajo que hace que la gente abandone los
 * contadores, y encima no enseña nada: ya sabe lo que desayuna.
 *
 * Los botones son pequeños y van en una línea porque son un atajo, no el
 * camino principal: quien vaya a comer otra cosa tiene que poder ignorarlos
 * sin esquivarlos.
 */
export function MisComidas({ mealNombre, repetir, guardadas, onGuardar }: Props) {
  const [poniendoNombre, setPoniendoNombre] = useState(false);
  const [nombre, setNombre] = useState('');

  if (!repetir && !guardadas.length && !onGuardar) return null;

  const guardar = () => {
    const limpio = nombre.trim();
    if (!limpio) return;
    onGuardar?.(limpio);
    setNombre('');
    setPoniendoNombre(false);
  };

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 no-print">
      {repetir && (
        <button
          onClick={repetir.onUsar}
          className="rounded-lg border border-brand-200 bg-brand-50/60 px-2 py-1 text-[11px] font-medium text-brand-800 transition hover:border-brand-400"
        >
          ↺ Repetir el {repetir.deCuando}
        </button>
      )}

      {guardadas.map((c) => (
        <span
          key={c.id}
          className="inline-flex items-center overflow-hidden rounded-lg border border-slate-200"
        >
          <button
            onClick={c.onUsar}
            className="px-2 py-1 text-[11px] text-slate-700 transition hover:bg-slate-50"
          >
            {c.nombre}
          </button>
          <button
            onClick={c.onBorrar}
            aria-label={`Olvidar ${c.nombre}`}
            className="px-1.5 py-1 text-[11px] text-slate-300 transition hover:text-rose-600"
          >
            ×
          </button>
        </span>
      ))}

      {onGuardar &&
        (poniendoNombre ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <Input
              value={nombre}
              autoFocus
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && guardar()}
              placeholder={`${mealNombre} de siempre`}
              className="w-44 text-sm"
            />
            <Button onClick={guardar}>Guardar</Button>
            <Button variant="outline" onClick={() => setPoniendoNombre(false)}>
              Cancelar
            </Button>
          </span>
        ) : (
          <button
            onClick={() => setPoniendoNombre(true)}
            className="text-[11px] text-slate-500 underline transition hover:text-brand-700"
          >
            Guardar esta comida
          </button>
        ))}
    </div>
  );
}
