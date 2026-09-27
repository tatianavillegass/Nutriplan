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
  /**
   * En fase 3 lo apuntado puede contar en su plan: entonces hay dos botones en
   * vez de uno. En las demás fases no hay porciones que gastar, así que no se
   * pregunta.
   */
  puedeContarEnElPlan?: boolean;
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
  puedeContarEnElPlan = false,
}: Props) {
  const [foodId, setFoodId] = useState<string | undefined>();
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState<number>(100);
  const [kcalManual, setKcalManual] = useState<number | undefined>();

  const food = foodId ? foods.find((f) => f.id === foodId) : undefined;
  const calculado = macrosDeExtra(cantidad, food);
  const kcal = food ? calculado.kcal : (kcalManual ?? 0);

  /**
   * Sin alimento del catálogo no hay porciones que calcular: unas calorías a
   * ojo no dicen si eran hidrato o proteína. Por eso la elección sólo aparece
   * cuando hay alimento elegido.
   */
  const sePuedeContar = puedeContarEnElPlan && !!food;

  const añadir = (enElPlan = false) => {
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
      enElPlan: enElPlan || undefined,
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

        {!sePuedeContar && <Button onClick={() => añadir(false)}>Añadir</Button>}
      </div>

      {/*
        LAS DOS SON VERDAD
        Guardarse el hidrato de la cena para el helado es planificar; comérselo
        después de haber cenado es un extra. Lo mismo apuntado puede ser una
        cosa o la otra y sólo lo sabe quien se lo ha comido, así que se
        pregunta — igual que ya se hace con los postres.
      */}
      {sePuedeContar && (
        <div className="border-t border-amber-100 pt-2">
          <p className="mb-1.5 text-[11px] text-slate-600">¿Esto era tu comida o fue de más?</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => añadir(true)}>Cuéntamelo en el plan</Button>
            <Button variant="outline" onClick={() => añadir(false)}>
              Fue de más
            </Button>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-slate-400">
            «En el plan» gasta tus porciones de hoy, como si lo hubieras marcado en una comida.
            «De más» suma encima sin quitarte nada.
          </p>
        </div>
      )}
    </div>
  );
}

/** La línea de un extra ya apuntado, con su cantidad y su × para quitarlo. */
export function ExtraRow({
  extra,
  onQuitar,
  onCambiarDestino,
}: {
  extra: Extra;
  onQuitar?: (id: string) => void;
  /**
   * Cambiar de idea es normal: se apunta el postre pensando que va encima y
   * luego se decide dejarse la fruta de la merienda. Un botón que sólo se
   * puede pulsar una vez, en el momento de apuntar, se deja sin pulsar.
   */
  onCambiarDestino?: (id: string, enElPlan: boolean) => void;
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

      {onCambiarDestino ? (
        <button
          onClick={() => onCambiarDestino(extra.id, !extra.enElPlan)}
          title={
            extra.enElPlan
              ? 'Cuenta en tus porciones de hoy. Pulsa para dejarlo como algo de más.'
              : 'Suma encima del plan. Pulsa para que te cuente en tus porciones.'
          }
          className={`rounded px-1.5 py-0.5 text-[10px] transition ${
            extra.enElPlan
              ? 'bg-brand-50 text-brand-800 hover:bg-brand-100'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
          }`}
        >
          {extra.enElPlan ? 'en el plan' : 'de más'}
        </button>
      ) : extra.enElPlan ? (
        <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-800">
          en el plan
        </span>
      ) : null}

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
