import { Link } from 'react-router-dom';
import type { Cita, Client } from '../../types/client';
import { LABEL_MODO_CITA } from '../../types/client';
import { anular, citasDe, desmarcar, iso, marcarRealizada } from '../../utils/citas';
import { Button, Card } from '../common/ui';

interface Props {
  client: Client;
  onChange: (patch: Partial<Client>) => void;
  hoy?: Date;
}

/**
 * SUS CITAS, EN SU FICHA
 *
 * La agenda y la ficha son la misma clienta: lo que se pone en la semana es su
 * próxima cita, y marcarla como realizada gasta una sesión de su bono. Pero en
 * la ficha sólo se veía **la próxima**, así que al repasar en consulta no había
 * forma de decir «esta la diste el 3 y ésta no vino» — ni de marcar una que se
 * quedó sin marcar sin irse a buscarla a la semana que fuera.
 *
 * Aquí está todo: las que vienen arriba, las que ya pasaron debajo, y el mismo
 * botón de marcarlas. Lo que se toca aquí sale en la agenda y al revés, porque
 * es el mismo sitio (`Client.citas`) leído dos veces.
 */
export function SusCitas({ client, onChange, hoy = new Date() }: Props) {
  const todas = citasDe(client);
  const desde = iso(hoy);
  const proximas = todas.filter((c) => c.fecha >= desde);
  const pasadas = todas.filter((c) => c.fecha < desde).reverse();

  /** Cuántas se dieron de verdad: es lo que descuenta de su bono. */
  const hechas = todas.filter((c) => c.estado === 'realizada').length;
  const sinMarcar = pasadas.filter((c) => c.estado === 'prevista').length;

  if (!todas.length) {
    return (
      <Card title="Sus citas">
        <p className="text-xs text-slate-500">
          Todavía no tiene ninguna.{' '}
          <Link to="/agenda" className="text-brand-700 underline">
            Ponle una en la agenda
          </Link>{' '}
          y saldrá aquí.
        </p>
      </Card>
    );
  }

  const Fila = ({ cita }: { cita: Cita }) => {
    const hecha = cita.estado === 'realizada';
    const anulada = cita.estado === 'anulada';
    return (
      <li className="flex flex-wrap items-center gap-2 border-t border-slate-100 py-1.5 first:border-0">
        <span className={`tnum text-xs ${anulada ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
          {cita.fecha}
          {cita.hora && ` · ${cita.hora}`}
        </span>
        <span className="flex-1 text-xs text-slate-500">
          {LABEL_MODO_CITA[cita.modo]}
          {cita.nota && ` · ${cita.nota}`}
        </span>

        {hecha ? (
          <>
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
              hecha
            </span>
            <Button
              variant="ghost"
              onClick={() => onChange(desmarcar(client, cita.id!, hoy))}
              className="text-[10px] text-slate-400"
            >
              Deshacer
            </Button>
          </>
        ) : anulada ? (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
            no se dio
          </span>
        ) : (
          <>
            <Button
              onClick={() => onChange(marcarRealizada(client, cita.id!, hoy))}
              className="px-2 py-0.5 text-[10px]"
            >
              Marcar hecha
            </Button>
            <Button
              variant="ghost"
              onClick={() => onChange(anular(client, cita.id!, hoy))}
              className="text-[10px] text-slate-400"
            >
              No se dio
            </Button>
          </>
        )}
      </li>
    );
  };

  return (
    <Card
      title="Sus citas"
      subtitle={`${hechas} ${hechas === 1 ? 'consulta dada' : 'consultas dadas'} · marcarlas aquí descuenta de su bono, igual que en la agenda`}
      actions={
        <Link to="/agenda" className="text-xs text-brand-700 underline">
          Ir a la agenda
        </Link>
      }
    >
      {/*
        Las que ya pasaron y siguen sin marcar son las que dejan el «2 de 3»
        mintiendo: se dicen aquí también, no sólo en la agenda.
      */}
      {sinMarcar > 0 && (
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          {sinMarcar} {sinMarcar === 1 ? 'cita ya pasó' : 'citas ya pasaron'} y sigue
          {sinMarcar === 1 ? '' : 'n'} sin marcar. Hasta que lo hagas, su bono va atrasado.
        </p>
      )}

      {proximas.length > 0 && (
        <>
          <p className="mb-1 text-[10px] tracking-wide text-slate-500 uppercase">Las que vienen</p>
          <ul className="mb-3">
            {proximas.map((c) => (
              <Fila key={c.id} cita={c} />
            ))}
          </ul>
        </>
      )}

      {pasadas.length > 0 && (
        <>
          <p className="mb-1 text-[10px] tracking-wide text-slate-500 uppercase">Las que ya pasaron</p>
          <ul>
            {pasadas.slice(0, 12).map((c) => (
              <Fila key={c.id} cita={c} />
            ))}
          </ul>
          {pasadas.length > 12 && (
            <p className="mt-1 text-[10px] text-slate-400">
              Y {pasadas.length - 12} más, en la agenda.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
