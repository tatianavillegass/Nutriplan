import { useState } from 'react';
import type { Alimento } from '../../types/food';
import type { Extra } from '../../types/diary';
import type { BalanceDia } from '../../utils/diary';
import { veredictoExtras } from '../../utils/diary';
import { kcalFromMacros } from '../../utils/macros';
import { ExtraForm, ExtraRow } from './ExtraForm';
import { Button, fmt } from '../common/ui';

interface Props {
  extras: Extra[];
  foods: Alimento[];
  balance: BalanceDia;
  onChange: (extras: Extra[]) => void;
  /** Nombre de la comida en la que se apuntó cada extra. */
  nombreMomento?: (momento: string) => string | undefined;
  soloLectura?: boolean;
}

const TONO = {
  ok: 'text-slate-500',
  aviso: 'text-amber-700',
  alto: 'text-rose-700',
} as const;

/**
 * EXTRAS DEL DÍA
 *
 * Lo que se come fuera del plan. No se penaliza: se registra y se muestra
 * cuánto desplaza el día, que es lo único que hace falta para decidir.
 *
 * Cada comida tiene ya su propio «Añadir extra»; aquí se ven todos juntos,
 * con la comida en la que se tomaron, y se puede apuntar lo que cayó entre
 * horas y no pertenece a ninguna.
 */
export function ExtrasPanel({
  extras,
  foods,
  balance,
  onChange,
  nombreMomento,
  soloLectura,
}: Props) {
  const [abierto, setAbierto] = useState(false);

  const kcalExtras = extras.reduce((s, e) => s + e.kcal, 0);
  const veredicto = veredictoExtras(balance.pesoExtras);

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-amber-900 uppercase">
            Extras del día
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-600">
            Todo lo que te has tomado fuera del plan, con la comida en la que fue. Registrarlo no
            rompe nada: sirve para ver el día completo.
          </p>
        </div>
        {!soloLectura && (
          <Button variant="outline" onClick={() => setAbierto((v) => !v)}>
            {abierto ? 'Cancelar' : 'Añadir entre horas'}
          </Button>
        )}
      </div>

      {abierto && !soloLectura && (
        <div className="mt-3">
          <ExtraForm
            foods={foods}
            onAnadir={(e) => {
              onChange([...extras, e]);
              setAbierto(false);
            }}
            onCerrar={() => setAbierto(false)}
          />
        </div>
      )}

      {extras.length > 0 && (
        <ul className="mt-3 space-y-1">
          {extras.map((e) => {
            const donde = e.momento ? nombreMomento?.(e.momento) : undefined;
            return (
              <li key={e.id}>
                {donde && (
                  <span className="ml-1 text-[10px] tracking-wide text-slate-400 uppercase">
                    {donde}
                  </span>
                )}
                <ul>
                  <ExtraRow
                    extra={e}
                    onQuitar={
                      soloLectura ? undefined : (id) => onChange(extras.filter((x) => x.id !== id))
                    }
                  />
                </ul>
              </li>
            );
          })}
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
          <p className={`mt-1 ${TONO[veredicto.tono]}`}>{veredicto.texto}</p>
        </div>
      )}
    </section>
  );
}
