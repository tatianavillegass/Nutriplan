import { useState } from 'react';
import type { Alimento } from '../../types/food';
import type { Extra } from '../../types/diary';
import type { BalanceDia } from '../../utils/diary';
import { macrosDeExtra } from '../../utils/diary';
import { kcalFromMacros } from '../../utils/macros';
import { FoodPicker } from '../food/FoodPicker';
import { Button, Input, fmt } from '../common/ui';
import { uid } from '../../utils/storage';

interface Props {
  extras: Extra[];
  foods: Alimento[];
  balance: BalanceDia;
  onChange: (extras: Extra[]) => void;
  soloLectura?: boolean;
}

/**
 * EXTRAS
 *
 * Lo que se come fuera del plan. No se penaliza: se registra y se muestra
 * cuánto desplaza el día, que es lo único que hace falta para decidir.
 */
export function ExtrasPanel({ extras, foods, balance, onChange, soloLectura }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [foodId, setFoodId] = useState<string | undefined>();
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState<number>(100);
  const [kcalManual, setKcalManual] = useState<number | undefined>();

  const food = foodId ? foods.find((f) => f.id === foodId) : undefined;
  const calculado = macrosDeExtra(cantidad, food);
  const kcal = food ? calculado.kcal : (kcalManual ?? 0);

  const añadir = () => {
    const etiqueta = (food?.nombre ?? nombre).trim();
    if (!etiqueta) return;
    const nuevo: Extra = {
      id: uid('ex_'),
      nombre: etiqueta,
      foodId,
      cantidad: food ? cantidad : undefined,
      unidad: food?.unidad ?? 'g',
      macros: food ? calculado.macros : { proteina: 0, hc: 0, grasa: 0 },
      kcal,
    };
    onChange([...extras, nuevo]);
    setFoodId(undefined);
    setNombre('');
    setCantidad(100);
    setKcalManual(undefined);
    setAbierto(false);
  };

  const kcalExtras = extras.reduce((s, e) => s + e.kcal, 0);

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-amber-900 uppercase">
            Extras del día
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-600">
            Lo que te has tomado fuera del plan. Registrarlo no rompe nada: sirve para ver el día
            completo.
          </p>
        </div>
        {!soloLectura && (
          <Button variant="outline" onClick={() => setAbierto((v) => !v)}>
            {abierto ? 'Cancelar' : 'Añadir extra'}
          </Button>
        )}
      </div>

      {abierto && !soloLectura && (
        <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-white p-3">
          <FoodPicker
            foods={foods}
            value={foodId}
            nombreLibre={nombre}
            placeholder="Cerveza, tarta, patatas fritas…"
            onSelect={(f) => {
              setFoodId(f.id);
              setNombre(f.nombre);
              setCantidad(f.gramos || 100);
            }}
            onLibre={(t) => {
              setNombre(t);
              setFoodId(undefined);
            }}
          />

          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-slate-500">Cantidad</span>
              <Input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value) || 0)}
                className="w-24 text-sm"
              />
            </label>

            {!food && (
              <label className="block">
                <span className="mb-0.5 block text-[10px] text-slate-500">Calorías</span>
                <Input
                  type="number"
                  min="0"
                  value={kcalManual ?? ''}
                  placeholder="150"
                  onChange={(e) =>
                    setKcalManual(e.target.value === '' ? undefined : Number(e.target.value))
                  }
                  className="w-24 text-sm"
                />
              </label>
            )}

            <p className="tnum flex-1 pb-2 text-[11px] text-slate-600">
              {food ? (
                <>
                  {fmt(kcal)} kcal · P {fmt(calculado.macros.proteina, 1)} · HC{' '}
                  {fmt(calculado.macros.hc, 1)} · G {fmt(calculado.macros.grasa, 1)}
                </>
              ) : (
                'Si no está en la lista, apunta las calorías a ojo.'
              )}
            </p>

            <Button onClick={añadir}>Añadir</Button>
          </div>
        </div>
      )}

      {extras.length > 0 && (
        <ul className="mt-3 space-y-1">
          {extras.map((e) => (
            <li
              key={e.id}
              className="flex items-baseline gap-2 rounded-lg bg-white px-3 py-1.5 text-xs"
            >
              <span className="flex-1 text-slate-700">
                {e.nombre}
                {e.cantidad ? (
                  <span className="tnum ml-1 text-slate-400">
                    {e.cantidad} {e.unidad}
                  </span>
                ) : null}
              </span>
              <span className="tnum text-slate-600">{fmt(e.kcal)} kcal</span>
              {!soloLectura && (
                <button
                  onClick={() => onChange(extras.filter((x) => x.id !== e.id))}
                  className="text-slate-300 transition hover:text-red-600"
                  aria-label={`Quitar ${e.nombre}`}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {extras.length > 0 && (
        <div className="tnum mt-3 border-t border-amber-200 pt-2 text-[11px] text-slate-700">
          <p>
            <strong className="font-medium">{fmt(kcalExtras)} kcal</strong> de extras, un{' '}
            {fmt(balance.pesoExtras, 0)} % sobre las {fmt(balance.kcalPautado)} kcal pautadas.
          </p>
          {balance.deExtras.hc + balance.deExtras.proteina + balance.deExtras.grasa > 0 && (
            <p className="mt-0.5 text-slate-500">
              Aportan P {fmt(balance.deExtras.proteina, 1)} g · HC {fmt(balance.deExtras.hc, 1)} g ·
              G {fmt(balance.deExtras.grasa, 1)} g ({fmt(kcalFromMacros(balance.deExtras))} kcal
              trazadas).
            </p>
          )}
          <p className="mt-1 text-slate-500">
            {balance.pesoExtras < 10
              ? 'Un desvío pequeño: el día sigue en línea.'
              : balance.pesoExtras < 25
                ? 'Desvío moderado. Si se repite varios días, coméntalo en consulta.'
                : 'Desvío grande sobre lo pautado de hoy. Mañana se retoma sin más.'}
          </p>
        </div>
      )}
    </section>
  );
}
