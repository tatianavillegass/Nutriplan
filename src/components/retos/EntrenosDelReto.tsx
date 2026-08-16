import { useState } from 'react';
import type { EjercicioDeEntreno, EntrenoDeReto } from '../../types/reto';
import { primerDiaDeSemana, semanaDeDia } from '../../utils/retos';
import { uid } from '../../utils/storage';
import { Button, Input } from '../common/ui';

interface Props {
  entrenos: EntrenoDeReto[];
  onCambiar: (entrenos: EntrenoDeReto[]) => void;
}

const vacio = (desdeDia: number): EntrenoDeReto => ({
  id: uid('en_'),
  nombre: '',
  desdeDia,
  ejercicios: [],
});

/**
 * LOS ENTRENOS DEL RETO
 *
 * Se abren por días, igual que las recetas y por lo mismo: treinta entrenos el
 * primer día se leen como un PDF y se cierran.
 *
 * Cada uno lleva el vídeo —que es lo que de verdad enseña a hacerlo— y la
 * lista de ejercicios con sus series. La lista no sobra teniendo el vídeo: sin
 * ella hay que volver a mirarlo entero cada vez para saber cuántas vueltas
 * quedan, y eso en mitad de una serie no se hace.
 */
export function EntrenosDelReto({ entrenos, onCambiar }: Props) {
  const [abierto, setAbierto] = useState<string | null>(null);

  const editar = (id: string, patch: Partial<EntrenoDeReto>) =>
    onCambiar(entrenos.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const anadir = () => {
    const nuevo = vacio(Math.max(1, ...entrenos.map((e) => e.desdeDia)));
    onCambiar([...entrenos, nuevo]);
    setAbierto(nuevo.id);
  };

  const ordenados = [...entrenos].sort((a, b) => a.desdeDia - b.desdeDia);

  return (
    <div>
      <p className="mb-2 text-[11px] leading-snug text-slate-500">
        Con su semana de apertura, como las recetas. El vídeo enseña a hacerlo y los ejercicios dicen
        cuántas vueltas van, que es lo que hace falta en mitad de la serie.
      </p>

      {ordenados.length > 0 && (
        <ul className="mb-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {ordenados.map((e) => (
            <li key={e.id}>
              <div className="flex items-center gap-3 px-3 py-2">
                <span className="tnum w-16 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-center text-[11px] text-slate-500">
                  Semana {semanaDeDia(e.desdeDia)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                  {e.nombre || <span className="text-slate-400">Sin nombre</span>}
                  <span className="ml-2 text-[11px] text-slate-400">
                    {e.ejercicios.length}{' '}
                    {e.ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}
                  </span>
                </span>
                <button
                  onClick={() => setAbierto(abierto === e.id ? null : e.id)}
                  className="shrink-0 rounded px-2 py-1 text-xs text-brand-700 hover:bg-brand-50"
                >
                  {abierto === e.id ? 'Cerrar' : 'Editar'}
                </button>
                <button
                  onClick={() => onCambiar(entrenos.filter((x) => x.id !== e.id))}
                  className="shrink-0 rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                >
                  Quitar
                </button>
              </div>

              {abierto === e.id && (
                <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-3 py-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_6rem]">
                    <label className="block">
                      <span className="mb-0.5 block text-[10px] text-slate-500">Nombre</span>
                      <Input
                        value={e.nombre}
                        placeholder="Fuerza tren inferior"
                        onChange={(ev) => editar(e.id, { nombre: ev.target.value })}
                        className="w-full text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-0.5 block text-[10px] text-slate-500">
                        Desde la semana
                      </span>
                      <Input
                        type="number"
                        min="1"
                        value={semanaDeDia(e.desdeDia)}
                        onChange={(ev) =>
                          editar(e.id, {
                            desdeDia: primerDiaDeSemana(Number(ev.target.value) || 1),
                          })
                        }
                        className="w-full text-sm"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-0.5 block text-[10px] text-slate-500">
                      Para qué es y qué hace falta
                    </span>
                    <Input
                      value={e.descripcion ?? ''}
                      placeholder="45 min · necesitas una banda y una silla"
                      onChange={(ev) => editar(e.id, { descripcion: ev.target.value })}
                      className="w-full text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-0.5 block text-[10px] text-slate-500">
                      Enlace al vídeo (YouTube, Drive…)
                    </span>
                    <Input
                      value={e.videoUrl ?? ''}
                      placeholder="https://"
                      onChange={(ev) => editar(e.id, { videoUrl: ev.target.value })}
                      className="w-full text-sm"
                    />
                  </label>

                  <Ejercicios
                    ejercicios={e.ejercicios}
                    onCambiar={(ejercicios) => editar(e.id, { ejercicios })}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Button variant="outline" onClick={anadir}>
        + Añadir entreno
      </Button>
    </div>
  );
}

/** Las repeticiones son texto: «10-12», «40 s» y «al fallo» son respuestas válidas. */
function Ejercicios({
  ejercicios,
  onCambiar,
}: {
  ejercicios: EjercicioDeEntreno[];
  onCambiar: (e: EjercicioDeEntreno[]) => void;
}) {
  const editar = (id: string, patch: Partial<EjercicioDeEntreno>) =>
    onCambiar(ejercicios.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <div>
      <p className="mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
        Ejercicios
      </p>

      {ejercicios.map((ej) => (
        <div key={ej.id} className="mb-1.5 flex flex-wrap items-end gap-1.5">
          <Input
            value={ej.nombre}
            placeholder="Sentadilla"
            onChange={(e) => editar(ej.id, { nombre: e.target.value })}
            className="min-w-40 flex-1 text-sm"
          />
          <Input
            type="number"
            min="1"
            value={ej.series ?? ''}
            placeholder="4"
            onChange={(e) =>
              editar(ej.id, { series: e.target.value === '' ? undefined : Number(e.target.value) })
            }
            className="w-16 text-sm"
            aria-label={`Series de ${ej.nombre || 'el ejercicio'}`}
          />
          <Input
            value={ej.repeticiones ?? ''}
            placeholder="10-12"
            onChange={(e) => editar(ej.id, { repeticiones: e.target.value })}
            className="w-24 text-sm"
            aria-label={`Repeticiones de ${ej.nombre || 'el ejercicio'}`}
          />
          <Input
            value={ej.descanso ?? ''}
            placeholder="60 s"
            onChange={(e) => editar(ej.id, { descanso: e.target.value })}
            className="w-20 text-sm"
            aria-label={`Descanso de ${ej.nombre || 'el ejercicio'}`}
          />
          <button
            onClick={() => onCambiar(ejercicios.filter((x) => x.id !== ej.id))}
            aria-label={`Quitar ${ej.nombre || 'ejercicio'}`}
            className="px-1.5 py-1 text-slate-300 hover:text-rose-600"
          >
            ×
          </button>
        </div>
      ))}

      <button
        onClick={() => onCambiar([...ejercicios, { id: uid('ej_'), nombre: '' }])}
        className="text-[11px] text-brand-700 underline hover:text-brand-900"
      >
        + Añadir ejercicio
      </button>
    </div>
  );
}
