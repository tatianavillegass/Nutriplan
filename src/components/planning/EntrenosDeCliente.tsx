import type { Client } from '../../types/client';
import { TIPOS_DE_ENTRENO, TIPO_DE_ENTRENO_LABELS } from '../../types/diary';
import { Card } from '../common/ui';

/**
 * DEJARLE APUNTAR LOS ENTRENOS
 *
 * Se enciende persona a persona, como la pausa y las medidas: a quien viene por
 * una patología digestiva, preguntarle cada día si ha entrenado le mete una
 * exigencia que no traía — y a quien está saliendo de una relación mala con el
 * ejercicio, más.
 */
export function EntrenosDeCliente({
  client,
  onChange,
}: {
  client: Client;
  onChange: (p: Partial<Client>) => void;
}) {
  const encendido = !!client.entrenos;

  return (
    <Card
      title="Que apunte sus entrenos"
      subtitle="Qué hizo, cuánto duró y cómo se sintió — y cuántas veces por semana"
    >
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={encendido}
          onChange={(e) => onChange({ entrenos: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-violet-600"
        />
        <span className="text-sm leading-snug text-slate-700">
          Dejarle apuntar sus entrenos
          <span className="mt-0.5 block text-xs text-slate-500">
            Le sale en «Hoy», debajo de las metas, con la tira de la semana. Tú lo ves en
            Seguimiento.
          </span>
        </span>
      </label>

      {encendido && (
        <>
          <p className="mt-4 mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Lo que puede elegir
          </p>
          <p className="text-xs leading-snug text-slate-600">
            {TIPOS_DE_ENTRENO.filter((t) => t !== 'otro')
              .map((t) => TIPO_DE_ENTRENO_LABELS[t])
              .join(' · ')}
            , y «otro» para escribirlo. Sólo el tipo es obligatorio: la duración, la cara y la
            nota las rellena si le apetece.
          </p>

          {/*
            La diferencia con las metas hay que decirla, porque parecen lo mismo
            y no lo son. Ver `utils/entrenos.ts`.
          */}
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-snug text-slate-600">
            <strong className="font-medium">No lleva objetivo semanal.</strong> Tres a la semana
            es mucho para quien venía de cero y poco para quien prepara una carrera, y quien está
            lesionada no ha fallado nada: un «2 de 4» en rojo el jueves no la mueve más. Se cuenta
            lo que hace y ya — no hay racha de entrenos ni ningún día en rojo, y no toca la racha
            de las comidas.
          </p>
        </>
      )}
    </Card>
  );
}
