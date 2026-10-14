import type { Client } from '../../types/client';
import { Card } from '../common/ui';

/**
 * QUITARLE LAS CALORÍAS DE LA APP
 *
 * A quien arrastra un trastorno de conducta alimentaria, cada cifra de energía
 * es una cuenta más que llevar: la app deja de ayudar y pasa a alimentar justo
 * lo que se quiere dejar atrás. Con esto encendido ve su plan entero —sus
 * porciones, sus recetas, sus gramos— y ni una caloría ni un macro.
 *
 * Se enciende persona a persona, como la pausa y las medidas, porque a quien
 * no lo necesita el número le sirve.
 */
export function SinNumerosDeCliente({
  client,
  fase,
  onChange,
}: {
  client: Client;
  /** La fase en la que está, para avisar de que en la 4 no se puede. */
  fase?: number;
  onChange: (p: Partial<Client>) => void;
}) {
  const encendido = !!client.sinNumeros;

  return (
    <Card
      title="Esconderle las calorías"
      subtitle="Para quien contar le hace daño — ve su plan, pero sin cifras de energía"
    >
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={encendido}
          onChange={(e) => onChange({ sinNumeros: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-brand-600"
        />
        <span className="text-sm leading-snug text-slate-700">
          Quitarle las calorías y los macros
          <span className="mt-0.5 block text-xs text-slate-500">
            Desaparecen de su día, de sus recetas, de sus extras y de los postres. Sigue viendo sus
            porciones y sus gramos, que es lo que necesita para comer. Tú lo sigues viendo todo.
          </span>
        </span>
      </label>

      {encendido && fase === 4 && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
          Está en fase 4, que es contar gramos: ahí esto no se aplica, porque sin números no
          quedaría nada que enseñarle. Si lo necesita, la fase 4 no es su sitio.
        </p>
      )}

      {encendido && (
        <p className="mt-3 text-[11px] leading-snug text-slate-500">
          Los macros se van con las calorías, no aparte: a quien le hace daño contar, los gramos de
          proteína son otro número que vigilar.
        </p>
      )}
    </Card>
  );
}
