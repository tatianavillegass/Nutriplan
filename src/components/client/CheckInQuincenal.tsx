import { useState } from 'react';
import type { CheckIn } from '../../types/diary';
import { PREGUNTAS } from '../../utils/checkin';
import { Button } from '../common/ui';

interface Props {
  numero: number;
  fecha: string;
  onGuardar: (checkin: CheckIn) => void;
}

const VALORES = [1, 2, 3, 4, 5];

/**
 * ¿QUÉ TAL ESTAS DOS SEMANAS?
 *
 * Cinco preguntas y una línea libre. Treinta segundos para ella; para la
 * nutricionista, la próxima consulta ya empezada.
 *
 * NO ES UN EXAMEN
 * ===============
 * No hay nota ni media, y las escalas van con lo que significan a los lados
 * —«baja» y «alta»— porque un número suelto no dice nada. Son cinco cosas que
 * ella siente y que sólo sirven para hablarlas.
 *
 * Y SE PUEDE DEJAR PARA OTRO DÍA
 * ==============================
 * Se queda disponible hasta el siguiente y no bloquea nada. Una app que
 * persigue a alguien con una encuesta se cierra y no se vuelve a abrir.
 */
export function CheckInQuincenal({ numero, fecha, onGuardar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  const [nota, setNota] = useState('');

  const contestadas = PREGUNTAS.filter((p) => respuestas[p.id]).length;
  const listo = contestadas === PREGUNTAS.length;

  if (!abierto)
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full rounded-xl border border-brand-200 bg-brand-50/40 p-3 text-left"
      >
        <p className="text-sm font-medium text-brand-900">¿Qué tal estas dos semanas?</p>
        <p className="mt-0.5 text-xs leading-snug text-slate-600">
          Cinco preguntas rápidas para tu nutricionista. Si ahora no te va bien, sigue aquí.
        </p>
      </button>
    );

  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-brand-900">¿Qué tal estas dos semanas?</p>
        <button
          onClick={() => setAbierto(false)}
          className="text-xs text-slate-500 hover:underline"
        >
          Ahora no
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {PREGUNTAS.map((p) => (
          <div key={p.id}>
            <p className="text-xs text-slate-700">{p.texto}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="w-14 shrink-0 text-[10px] text-slate-500">{p.poco}</span>
              <div className="flex gap-1">
                {VALORES.map((v) => (
                  <button
                    key={v}
                    onClick={() => setRespuestas((r) => ({ ...r, [p.id]: v }))}
                    aria-label={`${p.texto} ${v} de 5`}
                    aria-pressed={respuestas[p.id] === v}
                    className={`h-8 w-8 rounded-lg border text-xs transition ${
                      respuestas[p.id] === v
                        ? 'border-brand-500 bg-brand-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-brand-400'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <span className="w-14 shrink-0 text-right text-[10px] text-slate-500">
                {p.mucho}
              </span>
            </div>
          </div>
        ))}
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs text-slate-700">
          ¿Algo que quieras contarle? (opcional)
        </span>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          placeholder="Lo que sea: una semana rara, algo que te ha costado, algo que te ha ido bien"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          disabled={!listo}
          onClick={() =>
            onGuardar({
              numero,
              fecha,
              respuestas: respuestas as CheckIn['respuestas'],
              nota: nota.trim() || undefined,
            })
          }
        >
          Enviar
        </Button>
        {!listo && (
          <span className="text-[11px] text-slate-500">
            {contestadas} de {PREGUNTAS.length}
          </span>
        )}
      </div>
    </section>
  );
}
