import { useState } from 'react';
import type { RegistroDia } from '../../types/diary';
import type { Preparacion } from '../../utils/preparacion';
import {
  medidasDe,
  semanasDePeso,
  tendenciaDePeso,
  ultimasMedidas,
} from '../../utils/misMedidas';
import { Button, fmt } from '../common/ui';
import { NumeroConComa, aNumero } from '../common/NumeroConComa';

interface Props {
  registros: RegistroDia[];
  /** Sus mediciones: ahí está la foto si la subió antes de tener cuenta. */
  mediciones?: { fecha: string; foto?: string; perimetros?: { cintura?: number; cadera?: number } }[];
  /** Lo que se midió y la foto que subió antes de empezar. */
  preparacion: Preparacion;
  /** Lo de hoy, para poder corregirlo el mismo día. */
  deHoy?: RegistroDia['medidas'];
  onGuardar: (medidas: NonNullable<RegistroDia['medidas']>) => void;
}

const fechaCorta = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

/**
 * TUS MEDIDAS
 *
 * En consulta la báscula la pone la nutricionista. En un reto online no hay
 * consulta, así que esto es lo único que va a saber de su cuerpo — y por eso
 * está, aunque todo sea opcional.
 *
 * LO QUE SE ENSEÑA ES LA MEDIA DE LA SEMANA
 * =========================================
 * El peso de un día son dos kilos de agua, sal y lo que quedó de la cena.
 * Enseñarlo tal cual convierte cualquier martes en un fracaso o en una
 * celebración, las dos igual de falsas. La media de la semana quita ese ruido,
 * y hasta que no hay dos semanas no se dice nada de la tendencia: un número
 * sacado de tres días no es una tendencia.
 */
export function MisMedidas({
  registros,
  mediciones = [],
  preparacion,
  deHoy,
  onGuardar,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [peso, setPeso] = useState(deHoy?.peso ? String(deHoy.peso) : '');
  const [cintura, setCintura] = useState(deHoy?.cintura ? String(deHoy.cintura) : '');
  const [cadera, setCadera] = useState(deHoy?.cadera ? String(deHoy.cadera) : '');

  const medidas = medidasDe(registros);
  const ultimas = ultimasMedidas(medidas);
  const semanas = semanasDePeso(medidas);
  const tendencia = tendenciaDePeso(medidas);
  const estaSemana = semanas[semanas.length - 1];

  /**
   * El punto de partida. Puede venir de dos sitios y los dos valen: de lo que
   * marcó en la app, o de la medición que se creó al darla de alta si se midió
   * desde la cuenta atrás, antes de tener cuenta.
   */
  const primera = [...mediciones].sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  const partida = {
    cintura: preparacion.cintura ?? primera?.perimetros?.cintura,
    cadera: preparacion.cadera ?? primera?.perimetros?.cadera,
  };
  const foto = preparacion.foto ?? mediciones.find((m) => m.foto)?.foto;

  const guardar = () => {
    onGuardar({
      peso: aNumero(peso),
      cintura: aNumero(cintura),
      cadera: aNumero(cadera),
    });
    setAbierto(false);
  };

  return (
    <section className="rounded-2xl border border-brand-200 bg-white p-4 no-print sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold tracking-wide text-brand-800 uppercase">Tus medidas</h2>
        <button
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="rounded-lg border border-brand-200 px-2.5 py-1 text-[11px] font-medium text-brand-800 transition hover:bg-brand-50"
        >
          {abierto ? 'Cerrar' : 'Apuntar'}
        </button>
      </div>

      <p className="mt-1 text-xs leading-snug text-slate-600">
        Todo es opcional. Si te pesas, hazlo en las mismas condiciones —al levantarte y después
        del baño— y mira la media de la semana, no el número de hoy.
      </p>

      {abierto && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-slate-500">Peso (kg)</span>
              <NumeroConComa
                value={peso}
                onChange={setPeso}
                className="w-24 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-slate-500">Cintura (cm)</span>
              <NumeroConComa
                value={cintura}
                onChange={setCintura}
                className="w-24 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-slate-500">Cadera (cm)</span>
              <NumeroConComa
                value={cadera}
                onChange={setCadera}
                className="w-24 text-sm"
              />
            </label>
            <Button onClick={guardar}>Guardar</Button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            La cintura y la cadera se miden una vez a la semana: son las que mejor cuentan lo que
            está pasando cuando el peso no se mueve.
          </p>
        </div>
      )}

      {/* ── Lo que lleva ──────────────────────────────── */}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Dato
          titulo="Peso"
          valor={ultimas.peso ? `${fmt(ultimas.peso, 1)} kg` : '—'}
          pie={ultimas.peso ? fechaCorta(ultimas.fecha) : 'sin apuntar'}
        />
        <Dato
          titulo="Cintura"
          valor={ultimas.cintura ? `${fmt(ultimas.cintura, 0)} cm` : partida.cintura ? `${fmt(partida.cintura, 0)} cm` : '—'}
          pie={
            ultimas.cintura && partida.cintura
              ? `${diferencia(ultimas.cintura, partida.cintura)} desde el día 1`
              : partida.cintura
                ? 'del primer día'
                : 'sin apuntar'
          }
        />
        <Dato
          titulo="Cadera"
          valor={ultimas.cadera ? `${fmt(ultimas.cadera, 0)} cm` : partida.cadera ? `${fmt(partida.cadera, 0)} cm` : '—'}
          pie={
            ultimas.cadera && partida.cadera
              ? `${diferencia(ultimas.cadera, partida.cadera)} desde el día 1`
              : partida.cadera
                ? 'del primer día'
                : 'sin apuntar'
          }
        />
      </div>

      {estaSemana && (
        <p className="tnum mt-3 text-sm text-slate-700">
          Media de esta semana: <strong>{fmt(estaSemana.media, 1)} kg</strong>
          <span className="text-slate-400">
            {' '}
            ({estaSemana.dias} {estaSemana.dias === 1 ? 'día' : 'días'})
          </span>
        </p>
      )}

      {tendencia ? (
        <p className="mt-1 text-xs leading-snug text-slate-600">
          Comparado con la semana pasada, {' '}
          <strong className={tendencia.porSemana < 0 ? 'text-emerald-700' : 'text-slate-700'}>
            {tendencia.porSemana > 0 ? '+' : '−'}
            {fmt(Math.abs(tendencia.porSemana), 1)} kg por semana
          </strong>
          .
        </p>
      ) : (
        semanas.length === 1 && (
          <p className="mt-1 text-xs leading-snug text-slate-500">
            Con otra semana apuntada se podrá ver la tendencia. Un número sacado de unos días no
            dice nada todavía.
          </p>
        )
      )}

      {foto && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Tu foto del primer día
          </p>
          <img
            src={foto}
            alt="Tu foto del primer día"
            className="max-h-56 rounded-lg border border-slate-200"
          />
        </div>
      )}
    </section>
  );
}

const diferencia = (ahora: number, antes: number) => {
  const d = ahora - antes;
  if (Math.abs(d) < 0.5) return 'igual';
  return `${d > 0 ? '+' : '−'}${fmt(Math.abs(d), 0)} cm`;
};

function Dato({ titulo, valor, pie }: { titulo: string; valor: string; pie: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] tracking-wide text-slate-400 uppercase">{titulo}</p>
      <p className="tnum text-lg leading-tight font-semibold text-brand-900">{valor}</p>
      <p className="text-[10px] text-slate-400">{pie}</p>
    </div>
  );
}
