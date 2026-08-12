import { useState } from 'react';
import type { Alimento } from '../../types/food';
import type { Extra } from '../../types/diary';
import { macrosDeExtra } from '../../utils/diary';
import { FoodPicker } from '../food/FoodPicker';
import { Button, Input, fmt } from '../common/ui';
import { uid } from '../../utils/storage';

interface Props {
  foods: Alimento[];
  /** Comida en la que se apunta. Sin momento, es picoteo suelto del día. */
  momento?: string;
  onAnadir: (extra: Extra) => void;
  onCerrar?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * AÑADIR UN EXTRA
 *
 * Un alimento cualquiera, esté o no en el plan. Si está en el catálogo, las
 * calorías salen solas de sus nutrientes; si no, se apuntan a ojo. El mismo
 * formulario sirve para el pie del día y para cada comida: lo único que
 * cambia es el `momento`, que es lo que luego dice cuándo se comió.
 */
export function ExtraForm({
  foods,
  momento,
  onAnadir,
  onCerrar,
  placeholder = 'Cerveza, tarta, patatas fritas…',
  autoFocus = true,
}: Props) {
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
    onAnadir({
      id: uid('ex_'),
      nombre: etiqueta,
      foodId,
      cantidad: food ? cantidad : undefined,
      unidad: food?.unidad ?? 'g',
      macros: food ? calculado.macros : { proteina: 0, hc: 0, grasa: 0 },
      kcal,
      momento,
    });
    setFoodId(undefined);
    setNombre('');
    setCantidad(100);
    setKcalManual(undefined);
    onCerrar?.();
  };

  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-white p-3">
      <FoodPicker
        foods={foods}
        value={foodId}
        nombreLibre={nombre}
        placeholder={placeholder}
        autoFocus={autoFocus}
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
  );
}

/** La línea de un extra ya apuntado, con su cantidad y su × para quitarlo. */
export function ExtraRow({
  extra,
  onQuitar,
}: {
  extra: Extra;
  onQuitar?: (id: string) => void;
}) {
  return (
    <li className="flex items-baseline gap-2 rounded-lg bg-white px-3 py-1.5 text-xs">
      <span className="flex-1 text-slate-700">
        {extra.nombre}
        {extra.cantidad ? (
          <span className="tnum ml-1 text-slate-400">
            {extra.cantidad} {extra.unidad}
          </span>
        ) : null}
      </span>
      <span className="tnum text-slate-600">{fmt(extra.kcal)} kcal</span>
      {onQuitar && (
        <button
          onClick={() => onQuitar(extra.id)}
          className="text-slate-300 transition hover:text-red-600"
          aria-label={`Quitar ${extra.nombre}`}
        >
          ×
        </button>
      )}
    </li>
  );
}
