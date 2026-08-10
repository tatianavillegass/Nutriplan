import { useMemo, useState } from 'react';
import type { Alimento } from '../../types/food';
import type { DayType, DespensaComida, Meal } from '../../types/plan';
import { EXCHANGE_GROUPS, type MacroBucket } from '../../data/exchangeGroups';
import { alimentosDeComida, despensaDe, notaAceite, repartoElegible } from '../../utils/pantry';
import { objetivoDeBucket } from '../../utils/combos';
import { gramosPorIntercambio } from '../../utils/recipeComposition';
import {
  aplicarPlantilla,
  borrarPlantilla,
  guardarPlantilla,
  leerPlantillas,
  type PlantillaDespensa,
} from '../../utils/plantillas';
import { avisoGrasaExtra } from '../../utils/similitud';
import { FoodPicker } from '../food/FoodPicker';
import { Button, fmt } from '../common/ui';

interface Props {
  dayType: DayType;
  meal: Meal;
  /** Catálogo completo: los vetados salen en ámbar con el motivo, no se ocultan. */
  foods: Alimento[];
  onDespensa: (despensa: Record<string, DespensaComida>) => void;
  onAceite: (porciones: number) => void;
  /** Nota libre que el cliente verá en esta comida. */
  onNota?: (texto: string) => void;
  /** Por qué un alimento está vetado para este cliente. */
  motivoBloqueo?: (food: Alimento) => string | undefined;
}

const BUCKETS: [MacroBucket, string, string][] = [
  ['proteina', 'Proteína', 'queso batido, huevo, pollo…'],
  ['carbohidrato', 'Carbohidrato', 'avena, pan, plátano…'],
  ['grasa', 'Grasa', 'aceite, aguacate, nueces…'],
];

/**
 * QUÉ PUEDE ELEGIR EL CLIENTE EN ESTA COMIDA
 *
 * Se construye añadiendo, no quitando: la nutricionista escribe los alimentos
 * que quiere ofrecer y cada uno cae en su macro solo. Es más rápido que partir
 * de 260 alimentos y ponerse a tachar.
 *
 * Quien prefiera lo contrario tiene "usar todo el catálogo", que ofrece lo
 * sugerido para esa comida y deja quitar lo que no encaje.
 */
export function MealPantryEditor({
  dayType,
  meal,
  foods,
  onDespensa,
  onAceite,
  onNota,
  motivoBloqueo,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [plantillas, setPlantillas] = useState<PlantillaDespensa[]>(() => leerPlantillas());
  const [guardando, setGuardando] = useState(false);
  const [nombrePlantilla, setNombrePlantilla] = useState('');

  const d = despensaDe(dayType, meal.id);
  /** Sin lista propia se parte del catálogo sugerido para esa comida. */
  const usaCatalogo = d.seleccion === undefined;

  const disponibles = useMemo(
    () => alimentosDeComida(dayType, meal, foods),
    [dayType, meal, foods],
  );

  const { reparto, reserva } = repartoElegible(dayType, meal);
  const grasaPautada = dayType.grid[meal.id]?.grasas ?? 0;

  const porBucket = (bucket: MacroBucket) =>
    disponibles.filter((f) => !!f.grupo && EXCHANGE_GROUPS[f.grupo]?.bucket === bucket);

  const setDespensa = (siguiente: DespensaComida) =>
    onDespensa({ ...(dayType.despensa ?? {}), [meal.id]: siguiente });

  const anadir = (foodId: string) => {
    if (usaCatalogo) {
      // Partiendo del catálogo, "añadir" es reponerlo o traerlo de otra comida.
      setDespensa({
        ...d,
        anadidos: (d.anadidos ?? []).includes(foodId)
          ? d.anadidos
          : [...(d.anadidos ?? []), foodId],
        excluidos: (d.excluidos ?? []).filter((x) => x !== foodId),
      });
      return;
    }
    const seleccion = d.seleccion ?? [];
    if (seleccion.includes(foodId)) return;
    setDespensa({ ...d, seleccion: [...seleccion, foodId] });
  };

  const quitar = (foodId: string) => {
    if (usaCatalogo) {
      setDespensa({
        ...d,
        anadidos: (d.anadidos ?? []).filter((x) => x !== foodId),
        excluidos: (d.excluidos ?? []).includes(foodId)
          ? d.excluidos
          : [...(d.excluidos ?? []), foodId],
      });
      return;
    }
    setDespensa({ ...d, seleccion: (d.seleccion ?? []).filter((x) => x !== foodId) });
  };

  const resumen = usaCatalogo
    ? `${disponibles.length} del catálogo`
    : `${d.seleccion?.length ?? 0} alimentos`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-baseline justify-between gap-2 px-4 py-2.5 text-left"
      >
        <span className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
          {meal.nombre}
        </span>
        <span className="text-[11px] text-slate-400">
          {resumen}
          {reserva > 0 && ` · ${fmt(reserva, reserva % 1 ? 1 : 0)} grasa de cocción`}
          <span className="ml-2 text-brand-600">{abierto ? 'ocultar' : 'editar'}</span>
        </span>
      </button>

      {abierto && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-3">
          {/* Plantillas */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-[10px] tracking-wide text-slate-500 uppercase">Plantillas</span>
            {plantillas.map((p) => (
              <span
                key={p.id}
                className="flex items-center rounded-lg border border-slate-200 bg-white text-[11px]"
              >
                <button
                  onClick={() => setDespensa(aplicarPlantilla(d, p))}
                  title={`Poner los ${p.foodIds.length} alimentos de "${p.nombre}" en ${meal.nombre.toLowerCase()}`}
                  className="px-2 py-1 text-slate-700 hover:text-brand-700"
                >
                  {p.nombre}
                  <span className="tnum ml-1 text-slate-400">{p.foodIds.length}</span>
                </button>
                <button
                  onClick={() => setPlantillas(borrarPlantilla(plantillas, p.id))}
                  aria-label={`Borrar la plantilla ${p.nombre}`}
                  className="px-1.5 py-1 text-slate-300 hover:text-red-600"
                >
                  ×
                </button>
              </span>
            ))}
            {!plantillas.length && (
              <span className="text-[11px] text-slate-400">
                Ninguna todavía. Compón una comida y guárdala.
              </span>
            )}

            {guardando ? (
              <span className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={nombrePlantilla}
                  onChange={(e) => setNombrePlantilla(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    setPlantillas(
                      guardarPlantilla(plantillas, nombrePlantilla, disponibles.map((f) => f.id)),
                    );
                    setNombrePlantilla('');
                    setGuardando(false);
                  }}
                  placeholder="Desayuno de siempre"
                  className="w-40 rounded border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-brand-400"
                />
                <button
                  onClick={() => {
                    setPlantillas(
                      guardarPlantilla(plantillas, nombrePlantilla, disponibles.map((f) => f.id)),
                    );
                    setNombrePlantilla('');
                    setGuardando(false);
                  }}
                  className="text-[11px] text-brand-600 hover:underline"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setGuardando(false)}
                  className="text-[11px] text-slate-400 hover:underline"
                >
                  Cancelar
                </button>
              </span>
            ) : (
              <button
                onClick={() => setGuardando(true)}
                disabled={!disponibles.length}
                className="ml-auto text-[11px] text-brand-600 hover:underline disabled:text-slate-300 disabled:no-underline"
              >
                + Guardar esta comida como plantilla
              </button>
            )}
          </div>

          {/* Aceite de cocción */}
          {grasaPautada > 0 && (
            <div className="rounded-lg bg-amber-50/60 px-3 py-2">
              <label className="flex flex-wrap items-center gap-2 text-[11px] text-slate-700">
                <span>Reservar para aceite de cocción</span>
                <input
                  type="number"
                  min={0}
                  max={grasaPautada}
                  step="0.5"
                  value={reserva}
                  onChange={(e) => onAceite(Math.max(0, Number(e.target.value) || 0))}
                  className="tnum w-16 rounded border border-slate-200 px-2 py-0.5 text-xs outline-none focus:border-brand-400"
                />
                <span className="text-slate-500">
                  de {fmt(grasaPautada, grasaPautada % 1 ? 1 : 0)} porciones de grasa
                </span>
              </label>
              {reserva > 0 && (
                <p className="mt-1 text-[11px] text-amber-800">
                  {notaAceite(foods, reserva)} — al cliente le quedan{' '}
                  {fmt(reparto.grasas ?? 0, (reparto.grasas ?? 0) % 1 ? 1 : 0)} a elegir.
                </p>
              )}
            </div>
          )}

          {/* Nota que verá el cliente */}
          {onNota && (
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-slate-500">
                Nota para el cliente en {meal.nombre.toLowerCase()} (opcional)
              </span>
              <input
                value={dayType.notas?.[meal.id] ?? ''}
                onChange={(e) => onNota(e.target.value)}
                placeholder="Verdura libre, café sin azúcar, bebe agua antes…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-400"
              />
            </label>
          )}

          {/* Una columna por macro, cada una con su buscador */}
          <div className="grid gap-4 md:grid-cols-3">
            {BUCKETS.map(([bucket, label, ejemplo]) => {
              const objetivo = objetivoDeBucket(reparto, bucket);
              const dentro = porBucket(bucket);

              return (
                <div key={bucket}>
                  <p className="mb-1 text-[11px] font-medium text-slate-700">
                    {label}
                    <span className="tnum ml-1 font-normal text-slate-400">
                      {dentro.length}
                      {objetivo && (
                        <>
                          {' '}
                          · {fmt(objetivo.porciones, objetivo.porciones % 1 ? 1 : 0)} porciones
                        </>
                      )}
                    </span>
                  </p>

                  <FoodPicker
                    foods={foods.filter(
                      (f) => !!f.grupo && EXCHANGE_GROUPS[f.grupo]?.bucket === bucket,
                    )}
                    placeholder={ejemplo}
                    limpiarTrasElegir
                    motivoBloqueo={motivoBloqueo}
                    onSelect={(f) => anadir(f.id)}
                  />

                  <ul className="mt-1.5 max-h-72 space-y-0.5 overflow-auto pr-1">
                    {dentro.map((f, i) => {
                      const cambia = i === 0 || dentro[i - 1].grupo !== f.grupo;
                      const veto = motivoBloqueo?.(f);
                      return (
                        <li key={f.id}>
                          {cambia && (
                            <p className="mt-1.5 mb-0.5 text-[9px] tracking-wide text-slate-400 uppercase">
                              {EXCHANGE_GROUPS[f.grupo!]?.nombre}
                            </p>
                          )}
                          <button
                            onClick={() => quitar(f.id)}
                            className="flex w-full items-baseline gap-1.5 rounded px-1 py-0.5 text-left text-[11px] transition hover:bg-red-50"
                            title="Quitar de esta comida"
                          >
                            <span className="text-slate-300">−</span>
                            <span
                              className={`flex-1 truncate ${veto ? 'text-amber-800' : 'text-slate-700'}`}
                            >
                              {f.nombre}
                              {veto && <span className="ml-1 text-[9px] text-amber-600">({veto})</span>}
                            </span>
                            <span className="tnum text-[10px] text-slate-400">
                              {gramosPorIntercambio(f)} {f.unidad ?? 'g'}
                            </span>
                            {avisoGrasaExtra(f) && (
                              <span
                                className="shrink-0 text-[9px] text-amber-600"
                                title={avisoGrasaExtra(f)}
                              >
                                ●
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                    {!dentro.length && (
                      <li className="text-[11px] text-amber-700">
                        {objetivo
                          ? 'Añade alguno: sin opciones el cliente no puede completar este grupo.'
                          : 'Sin porciones pautadas en esta comida.'}
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
            <p className="text-[11px] text-slate-400">
              {usaCatalogo
                ? 'Partiendo del catálogo: se ofrece todo lo sugerido para esta comida y tú quitas lo que no encaje.'
                : 'Lista propia: el cliente ve exactamente estos alimentos.'}
            </p>
            <Button
              variant="ghost"
              onClick={() =>
                setDespensa(
                  usaCatalogo
                    ? { seleccion: disponibles.map((f) => f.id) }
                    : { seleccion: undefined, anadidos: d.seleccion, excluidos: [] },
                )
              }
            >
              {usaCatalogo ? 'Convertir en lista propia' : 'Usar todo el catálogo'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
