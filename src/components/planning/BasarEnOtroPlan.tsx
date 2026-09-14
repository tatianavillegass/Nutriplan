import { useMemo, useState } from 'react';
import type { Client } from '../../types/client';
import type { DayType, Plan } from '../../types/plan';
import { recetasDelPlan } from '../../types/plan';
import {
  TODO,
  basarEn,
  factorDeEscala,
  kcalDelDia,
  type Copiado,
  type QueCopiar,
} from '../../utils/basarEnOtroPlan';
import { coincide } from '../../utils/similitud';
import { Button, Card, Input, fmt } from '../common/ui';

interface Props {
  /** La clienta que se está pautando. */
  client: Client;
  plan: Plan;
  dayType: DayType;
  /** Los demás: sus clientas con un plan del que copiar. */
  otros: { client: Client; plan: Plan }[];
  onCopiar: (copiado: Copiado, de: Client) => void;
}

const QUE: [keyof QueCopiar, string, string][] = [
  ['recetas', 'Las recetas', 'Los mismos platos en cada comida. Se suman a las que ya tenga.'],
  [
    'reparto',
    'El reparto de intercambios',
    'La misma forma —qué macros en qué comidas—, escalada a sus calorías.',
  ],
  [
    'despensa',
    'La despensa y las combinaciones',
    'Qué alimentos ve en cada comida y las combinaciones de fase 2.',
  ],
  ['menu', 'La semana organizada', 'Qué plato le toca cada día, si se la habías repartido.'],
];

/**
 * BASAR EL PLAN DE UNA EN EL DE OTRA
 *
 * Muchas parejas comen lo mismo: los mismos platos, la misma compra, la misma
 * nevera — pero no las mismas cantidades. Montarle a ella el plan entero desde
 * cero cuando el de él ya está hecho es repetir el trabajo dos veces, y encima
 * salen dos listas de la compra distintas para una sola casa.
 *
 * SE ELIGE QUÉ SE COPIA
 * =====================
 * Para una pareja normalmente todo; para otra clienta a la que le va bien el
 * mismo desayuno, sólo las recetas. Un botón que lo copiara todo sin preguntar
 * pisaría el reparto que se le acaba de calcular a ella.
 *
 * Y SE DICE LO QUE VA A PASAR ANTES DE PULSAR
 * ===========================================
 * Cuántas recetas trae, con cuántas calorías se montó el de él y con cuáles se
 * va a escalar. Copiar entre fichas es de las pocas cosas de la app que tocan
 * el trabajo ya hecho, así que conviene verlo antes y no después.
 */
export function BasarEnOtroPlan({ client, plan, dayType, otros, onCopiar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [busca, setBusca] = useState('');
  const [elegido, setElegido] = useState<string | null>(null);
  const [que, setQue] = useState<QueCopiar>(TODO);

  /* Sin tildes y por cualquier palabra, como el buscador de clientas. */
  const candidatos = useMemo(
    () => otros.filter(({ client: c }) => coincide(c.nombre, busca)).slice(0, 8),
    [otros, busca],
  );

  const origen = otros.find((o) => o.client.id === elegido);
  const dayTypeOrigen = origen?.plan.dayTypes[0];

  if (!otros.length) return null;

  if (!abierto)
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3">
        <p className="text-xs leading-snug text-slate-600">
          <strong className="font-medium">¿Come lo mismo que otra persona?</strong> Las parejas
          suelen compartir platos, compra y nevera — pero no las cantidades. Puedes traerte sus
          recetas y su reparto, ajustados a lo que has calculado aquí.
        </p>
        <Button variant="outline" className="mt-2" onClick={() => setAbierto(true)}>
          Basarme en otro plan
        </Button>
      </div>
    );

  const kcalSuyas = kcalDelDia(dayType);
  const kcalDeEl = dayTypeOrigen ? kcalDelDia(dayTypeOrigen) : 0;
  const factor = dayTypeOrigen ? factorDeEscala(dayType, dayTypeOrigen) : 1;
  const cuantasRecetas = origen
    ? Object.values(recetasDelPlan(origen.plan)).reduce((s, r) => s + (r?.length ?? 0), 0)
    : 0;

  return (
    <Card
      title="Basarme en otro plan"
      subtitle="Los platos se copian; las cantidades siguen siendo las suyas"
      actions={
        <button
          onClick={() => setAbierto(false)}
          className="text-[11px] text-slate-400 underline hover:text-slate-600"
        >
          Cancelar
        </button>
      }
    >
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="¿De quién? Escribe su nombre…"
        className="w-full text-sm"
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {candidatos.map(({ client: c, plan: p }) => (
          <button
            key={c.id}
            onClick={() => setElegido(elegido === c.id ? null : c.id)}
            aria-pressed={elegido === c.id}
            className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
              elegido === c.id
                ? 'border-brand-500 bg-brand-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
            }`}
          >
            {c.nombre}
            <span className={`ml-1.5 text-[10px] ${elegido === c.id ? 'text-brand-100' : 'text-slate-400'}`}>
              fase {p.fase}
            </span>
          </button>
        ))}
        {!candidatos.length && (
          <p className="text-[11px] text-slate-500">Nadie con ese nombre tiene un plan montado.</p>
        )}
      </div>

      {origen && dayTypeOrigen && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
          <p className="text-[11px] leading-snug text-slate-500">
            El plan de {origen.client.nombre.split(' ')[0]} tiene{' '}
            <strong className="font-medium">{cuantasRecetas} recetas</strong> repartidas en{' '}
            {dayTypeOrigen.meals.length} comidas.
          </p>

          <div className="space-y-1.5">
            {QUE.map(([clave, titulo, explica]) => (
              <label key={clave} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={que[clave]}
                  onChange={(e) => setQue((v) => ({ ...v, [clave]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 accent-brand-600"
                />
                <span className="text-xs leading-snug text-slate-700">
                  {titulo}
                  <span className="block text-[11px] text-slate-500">{explica}</span>
                </span>
              </label>
            ))}
          </div>

          {/*
            LAS CANTIDADES SON DE CADA UNO
            Copiar el reparto tal cual sería darle a ella el plan de él. Se
            copia la forma y se escala, y se dice con qué números — que es lo
            que hace que se pueda confiar en el botón.
          */}
          {que.reparto && (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-[11px] leading-snug text-brand-900">
              {kcalSuyas > 0 && kcalDeEl > 0 ? (
                <>
                  Su reparto se ajusta de{' '}
                  <strong className="font-medium">{fmt(kcalDeEl)} kcal</strong> a las{' '}
                  <strong className="font-medium">{fmt(kcalSuyas)} kcal</strong> de{' '}
                  {client.nombre.split(' ')[0]}
                  {Math.abs(factor - 1) > 0.01 && <> (×{fmt(factor, 2)})</>}. Las comidas que él no
                  tenga se quedan como están.
                </>
              ) : (
                <>
                  {client.nombre.split(' ')[0]} todavía no tiene reparto, así que se copia el de él
                  tal cual. Revísalo: son sus calorías, no las de ella.
                </>
              )}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              onClick={() => {
                onCopiar(
                  basarEn(
                    { plan, dayType },
                    { plan: origen.plan, dayType: dayTypeOrigen },
                    que,
                  ),
                  origen.client,
                );
                setAbierto(false);
                setElegido(null);
              }}
              disabled={!Object.values(que).some(Boolean)}
            >
              Traerme lo marcado
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
