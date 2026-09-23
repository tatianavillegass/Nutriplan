import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Cita, Client } from '../../types/client';
import { LABEL_MODO_CITA, MODOS_CITA } from '../../types/client';
import { bonoVigente, resumenDeSesiones } from '../../utils/bonos';
import { DURACIONES, duracionPorDefecto } from '../../utils/citas';
import { Button, Card, Field, Input, Select } from '../common/ui';

interface Props {
  clients: Client[];
  /** El hueco que se pulsó: día y hora ya puestos. */
  fecha: string;
  hora: string;
  onPoner: (client: Client, cita: Cita) => void;
  onCerrar: () => void;
  hoy?: Date;
}

const sinTildes = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const dinero = (n: number, moneda = '€') =>
  `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} ${moneda}`;

/**
 * AGENDAR DESDE EL HUECO
 *
 * Se pulsa el viernes a las once y se abre esto, con el día y la hora ya
 * escritos: lo único que queda es decir quién y qué. Escribir la fecha a mano
 * en un formulario aparte es el paso que hace que una cita se apunte «luego».
 *
 * **Se busca por nombre, no se elige de una lista.** Con cuarenta fichas, un
 * desplegable obliga a bajar buscando con el ojo; escribiendo tres letras sale
 * la que es.
 *
 * **Y al elegirla se dice cómo va su bono**: por cuántas consultas va, lo
 * pagado y lo que falta. Es la pregunta que se hace justo al dar hora —«¿le
 * queda alguna?»— y hasta ahora había que abrir su ficha para saberlo.
 */
export function AgendarCita({ clients, fecha, hora, onPoner, onCerrar, hoy = new Date() }: Props) {
  const [busca, setBusca] = useState('');
  const [clientId, setClientId] = useState('');
  const [modo, setModo] = useState<Cita['modo']>('consulta');
  /** Los minutos, que se pueden tocar pero ya vienen puestos por el servicio. */
  const [duracion, setDuracion] = useState(duracionPorDefecto('consulta'));
  const [nota, setNota] = useState('');

  const elegida = clients.find((c) => c.id === clientId);

  const encontradas = useMemo(() => {
    const q = sinTildes(busca.trim());
    const suyas = clients.filter((c) => !c.soloReto);
    if (!q) return suyas.slice(0, 8);
    return suyas
      .filter((c) => sinTildes(c.nombre).includes(q) || sinTildes(c.email ?? '').includes(q))
      .slice(0, 8);
  }, [clients, busca]);

  const bono = elegida ? bonoVigente(elegida, hoy) : undefined;
  const moneda = elegida?.tarifa?.moneda?.trim() || bono?.bono.moneda || '€';

  /* Al cambiar de servicio se pone su duración: una llamada son 15 minutos. */
  const cambiarModo = (m: Cita['modo']) => {
    setModo(m);
    setDuracion(duracionPorDefecto(m));
  };

  return (
    <Card
      title={`Agendar · ${fecha} a las ${hora}`}
      subtitle="El día y la hora salen del hueco que has pulsado."
      actions={
        <button onClick={onCerrar} className="text-xs text-slate-400 hover:text-slate-600">
          Cerrar
        </button>
      }
    >
      {/* ── Quién ───────────────────────────────────────── */}
      {elegida ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 px-3 py-2">
          <span className="text-sm font-semibold text-brand-900">{elegida.nombre}</span>
          <button
            onClick={() => {
              setClientId('');
              setBusca('');
            }}
            className="text-[11px] text-slate-500 underline"
          >
            cambiar
          </button>
          <Link
            to={`/clientes/${elegida.id}`}
            className="ml-auto text-[11px] text-brand-700 underline"
          >
            Abrir su ficha
          </Link>
        </div>
      ) : (
        <div className="mb-3">
          <Field label="Quién" hint="Escribe tres letras de su nombre.">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nombre o correo…"
              autoFocus
            />
          </Field>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {encontradas.map((c) => (
              <button
                key={c.id}
                onClick={() => setClientId(c.id)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:border-brand-400 hover:text-brand-700"
              >
                {c.nombre}
              </button>
            ))}
            {!encontradas.length && (
              <p className="text-[11px] text-slate-500">
                Nadie con eso. Se agenda a quien ya tiene ficha: créala primero en Clientes.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Cómo va su bono ─────────────────────────────── */}
      {elegida &&
        (bono ? (
          <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            <p className="font-medium text-slate-700">{bono.bono.nombre}</p>
            <p>{resumenDeSesiones(bono)}</p>
            <p className={bono.pendiente > 0 ? 'text-amber-700' : 'text-emerald-700'}>
              {dinero(bono.pagado, moneda)} de {dinero(bono.importe, moneda)}
              {bono.pendiente > 0 ? ` · faltan ${dinero(bono.pendiente, moneda)}` : ' · pagado'}
            </p>
            {bono.lineas.every((l) => l.quedan <= 0) && (
              <p className="mt-0.5 text-amber-800">
                Se le acabaron las sesiones de este bono: toca renovar.
              </p>
            )}
          </div>
        ) : (
          <p className="mb-3 text-[11px] text-slate-500">
            Sin bono contratado. La consulta se apuntará como suelta.
          </p>
        ))}

      {/* ── Qué y cuánto dura ───────────────────────────── */}
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Servicio">
          <Select value={modo} onChange={(e) => cambiarModo(e.target.value as Cita['modo'])}>
            {MODOS_CITA.map((m) => (
              <option key={m} value={m}>
                {LABEL_MODO_CITA[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dura" hint="Las llamadas, 15 minutos; las consultas, 30.">
          <Select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>
            {DURACIONES.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nota">
          <Input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Traer la analítica"
          />
        </Field>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          disabled={!elegida}
          onClick={() =>
            elegida &&
            onPoner(elegida, {
              fecha,
              hora,
              duracionMin: duracion,
              modo,
              nota: nota.trim() || undefined,
            })
          }
        >
          Agendar
        </Button>
        <Button variant="ghost" onClick={onCerrar}>
          Cancelar
        </Button>
      </div>
    </Card>
  );
}
