import { useMemo, useState } from 'react';
import {
  camposConHistorial,
  serieDe,
  type CampoDeMedida,
  type Medida,
  type Punto,
} from '../../utils/misMedidas';
import { fmt } from '../common/ui';

const fechaCorta = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

/**
 * CÓMO VA CADA MEDIDA
 *
 * Una línea grande y legible, y unas pestañas para cambiar de medida. Poner
 * nueve gráficos pequeños uno debajo de otro se ve todo a la vez y no se lee
 * ninguno; en el móvil, que es donde se mira, hay que bajar media pantalla.
 *
 * SIN LIBRERÍA
 * ============
 * Es un `path` de SVG, como el resto de gráficos de la app. Una librería de
 * gráficos son doscientos kilobytes para pintar ocho puntos, y además se
 * imprimiría mal.
 *
 * LO QUE NO HACE
 * ==============
 * **No empieza en cero.** Un peso de 68 a 70 en un eje que arranca en cero es
 * una línea plana, y es justo el cambio que hay que ver. La escala se ajusta a
 * lo que hay, con un respiro arriba y abajo.
 *
 * **No dibuja lo que no se midió.** Sólo se unen las fechas en que esa medida
 * se apuntó: cruzando enero con marzo porque en febrero no se midió la
 * cintura, la línea diría que bajó en línea recta durante dos meses, y eso no
 * se sabe.
 *
 * **Y no dice si va bien o mal.** No hay colores de aprobado ni flechas de
 * objetivo: es el recorrido, y lo que significa se habla en consulta.
 */
export function EvolucionDeMedidas({ medidas }: { medidas: Medida[] }) {
  const campos = useMemo(() => camposConHistorial(medidas), [medidas]);
  const [elegido, setElegido] = useState<CampoDeMedida['id'] | undefined>();

  const campo = campos.find((c) => c.id === elegido) ?? campos[0];
  const puntos = useMemo(
    () => (campo ? serieDe(medidas, campo.id) : []),
    [medidas, campo],
  );

  /*
   * Con un solo punto no hay evolución que enseñar, y un gráfico de un punto
   * es una promesa vacía. Se dice y ya.
   */
  if (!campo || puntos.length < 2)
    return (
      <p className="text-xs leading-snug text-slate-500">
        Con dos tomas de la misma medida ya se puede ver cómo va.
      </p>
    );

  return (
    <div>
      {campos.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {campos.map((c) => (
            <button
              key={c.id}
              onClick={() => setElegido(c.id)}
              aria-pressed={c.id === campo.id}
              className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                c.id === campo.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c.nombre.replace(/ \(.*\)/, '')}
            </button>
          ))}
        </div>
      )}

      <Linea puntos={puntos} campo={campo} />
    </div>
  );
}

const ALTO = 120;
const ANCHO = 320;
const MARGEN = 14;

function Linea({ puntos, campo }: { puntos: Punto[]; campo: CampoDeMedida }) {
  const dec = campo.unidad === 'kg' ? 1 : 0;
  const valores = puntos.map((p) => p.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  /*
   * Si no se ha movido nada, `max - min` es cero y todo se dividiría por cero.
   * Se le inventa un rango mínimo para que la línea salga centrada y plana,
   * que es la verdad.
   */
  const rango = max - min || Math.max(1, max * 0.02);
  const respiro = rango * 0.15;
  const arriba = max + respiro;
  const abajo = min - respiro;

  const x = (i: number) =>
    MARGEN + (i * (ANCHO - MARGEN * 2)) / Math.max(1, puntos.length - 1);
  const y = (v: number) =>
    MARGEN + ((arriba - v) * (ALTO - MARGEN * 2)) / (arriba - abajo);

  const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p.valor)}`).join(' ');
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];
  const cambio = ultimo.valor - primero.valor;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="w-full"
        role="img"
        aria-label={`${campo.nombre}: de ${fmt(primero.valor, dec)} a ${fmt(ultimo.valor, dec)} ${campo.unidad}`}
      >
        {/* La línea de partida, para ver de un vistazo si está por encima o por debajo. */}
        <line
          x1={MARGEN}
          x2={ANCHO - MARGEN}
          y1={y(primero.valor)}
          y2={y(primero.valor)}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 4"
          className="text-slate-300"
        />
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-brand-600" strokeLinecap="round" strokeLinejoin="round" />
        {puntos.map((p, i) => (
          <circle
            key={p.fecha}
            cx={x(i)}
            cy={y(p.valor)}
            r={i === puntos.length - 1 ? 4.5 : 3}
            className="fill-brand-600"
          />
        ))}
      </svg>

      <figcaption className="mt-1 flex flex-wrap items-baseline justify-between gap-2 text-[11px]">
        <span className="tnum text-slate-500">
          {fechaCorta(primero.fecha)} · {fmt(primero.valor, dec)} {campo.unidad}
        </span>
        <span className="tnum font-medium text-slate-700">
          {fechaCorta(ultimo.fecha)} · {fmt(ultimo.valor, dec)} {campo.unidad}
          {Math.abs(cambio) >= (dec ? 0.05 : 0.5) && (
            <span className="ml-1 font-normal text-slate-500">
              ({cambio > 0 ? '+' : '−'}
              {fmt(Math.abs(cambio), dec)})
            </span>
          )}
        </span>
      </figcaption>
    </figure>
  );
}
