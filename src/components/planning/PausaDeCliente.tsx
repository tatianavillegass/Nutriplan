import { useState } from 'react';
import type { Client } from '../../types/client';
import { ACTIVIDADES_POR_DEFECTO } from '../../utils/hambreEmocional';
import { Button, Card, Input } from '../common/ui';

/**
 * ENCENDER LA PAUSA, Y ESCRIBIRLE QUÉ HACER
 *
 * Trabajar el hambre emocional no le hace falta a todo el mundo, y a quien no
 * le hace falta, ponerle un botón de emociones al lado de la comida le mete una
 * pregunta que no tenía. Por eso se enciende persona a persona.
 *
 * Las actividades son la otra mitad. «¿Qué podrías hacer para cuidarte igual?»
 * delante de una casilla vacía y a las once de la noche no se responde: con
 * tres cosas concretas que ella misma ha elegido, sí.
 */
export function PausaDeCliente({
  client,
  onChange,
}: {
  client: Client;
  onChange: (p: Partial<Client>) => void;
}) {
  const actividades = client.actividades ?? [];
  const [texto, setTexto] = useState('');

  const anadir = () => {
    const limpio = texto.trim();
    if (!limpio || actividades.includes(limpio)) return;
    onChange({ actividades: [...actividades, limpio] });
    setTexto('');
  };

  return (
    <Card
      title="Pausa"
      subtitle="Para trabajar el hambre emocional: un botón que puede pulsar cuando le vienen ganas de comer sin hambre"
    >
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={!!client.pausa}
          onChange={(e) => onChange({ pausa: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-teal-600"
        />
        <span className="text-sm leading-snug text-slate-700">
          Enseñarle el botón «Pausa»
          <span className="mt-0.5 block text-xs text-slate-500">
            Le hace tu árbol de decisión en dos o tres toques y la lleva al ejercicio que
            le toca. Lo que escriba se va guardando solo: es el diario de emociones sin
            tener que rellenarlo el domingo.
          </span>
        </span>
      </label>

      {client.pausa && (
        <>
          <p className="mt-4 mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Qué puede hacer en vez de comer
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && anadir()}
              placeholder="Salir a andar diez minutos"
              className="min-w-0 flex-1"
            />
            <Button onClick={anadir} disabled={!texto.trim()}>
              Añadir
            </Button>
          </div>

          {actividades.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {actividades.map((a) => (
                <li
                  key={a}
                  className="flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50/60 py-1 pr-1.5 pl-2.5 text-xs text-teal-900"
                >
                  {a}
                  <button
                    onClick={() =>
                      onChange({ actividades: actividades.filter((x) => x !== a) })
                    }
                    aria-label={`Quitar ${a}`}
                    className="text-teal-400 transition hover:text-rose-600"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            /*
              Sin lista se usan unas de partida: es mejor que enseñarle tres
              huecos vacíos justo en el momento en que menos se le ocurre nada.
            */
            <p className="mt-2 text-[11px] leading-snug text-slate-500">
              Si no escribes ninguna se le ofrecen éstas: {ACTIVIDADES_POR_DEFECTO.slice(0, 3).join(', ').toLowerCase()}…
              Las tuyas funcionan mejor porque son las que habéis hablado.
            </p>
          )}

          <p className="mt-3 text-[11px] leading-snug text-slate-500">
            Se le ofrecen <strong>tres cada vez</strong>, no la lista entera: con el
            impulso encima, veinte opciones es lo mismo que ninguna.
          </p>
        </>
      )}
    </Card>
  );
}
