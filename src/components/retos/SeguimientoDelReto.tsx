import { Link } from 'react-router-dom';
import type { Client } from '../../types/client';
import type { Plan } from '../../types/plan';
import type { Medicion } from '../../types/anthropometry';
import type { RegistroDia } from '../../types/diary';
import type { Reto } from '../../types/reto';
import { hayCambiosSinEnviar } from '../../types/plan';
import { calcularRacha, diaCerrado, inicioDeMes, libresDesde } from '../../utils/racha';
import { diaDelReto } from '../../utils/retos';
import { preparacionDe, PASOS_DE_PREPARACION } from '../../utils/preparacion';
import { fmt } from '../common/ui';

interface Props {
  reto: Reto;
  hoy: string;
  clients: Client[];
  plans: Plan[];
  registros: RegistroDia[];
  mediciones: Medicion[];
}

/**
 * CÓMO VA EL GRUPO
 *
 * Con veinte participantes no se puede abrir ficha por ficha todas las mañanas.
 * Esta tabla es para el vistazo: quién está cerrando días, quién lleva una
 * semana sin aparecer y a quién le falta el plan por enviar.
 *
 * Lo que se compara es **constancia**, no medidas. Un ranking de kilos premia a
 * quien empieza más pesada y a quien se deshidrata, y en un grupo siempre hay
 * alguien última en público. Los días cerrados los controla cada una y no
 * castigan por comer fuera: una comida libre cierra el día igual que una hecha.
 */
export function SeguimientoDelReto({
  reto,
  hoy,
  clients,
  plans,
  registros,
  mediciones,
}: Props) {
  const dia = diaDelReto(reto, hoy);
  const empezado = dia >= 1;

  const filas = reto.participantes
    .map((id) => clients.find((c) => c.id === id))
    .filter(Boolean)
    .map((c) => {
      const cliente = c as Client;
      const suyos = registros.filter((r) => r.clientId === cliente.id);
      const plan = plans.find((p) => p.clientId === cliente.id && !p.archivado);
      const racha = calcularRacha(suyos, plan?.dayTypes ?? [], hoy);

      /** Días cerrados desde que empezó el reto: es el número del grupo. */
      const desdeElInicio = suyos.filter((r) => r.fecha >= reto.fechaInicio);
      const cerrados = desdeElInicio.filter((r) =>
        diaCerrado(
          r,
          (plan?.dayTypes ?? []).find((d) => d.id === r.dayTypeId) ?? plan?.dayTypes?.[0],
        ),
      ).length;

      const pesos = mediciones
        .filter((m) => m.clientId === cliente.id && m.peso)
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
      const cambio =
        pesos.length > 1 ? (pesos[pesos.length - 1].peso ?? 0) - (pesos[0].peso ?? 0) : undefined;

      return {
        cliente,
        plan,
        racha: racha.actual,
        cerrados,
        libres: libresDesde(suyos, inicioDeMes(hoy)).total,
        ultimoDia: suyos.map((r) => r.fecha).sort().at(-1),
        peso: pesos.at(-1)?.peso ?? cliente.peso,
        cambio,
        preparacion: preparacionDe(suyos),
        sinEnviar: !!plan && hayCambiosSinEnviar(plan),
      };
    })
    .sort((a, b) => b.cerrados - a.cerrados || a.cliente.nombre.localeCompare(b.cliente.nombre));

  if (!filas.length) {
    return (
      <p className="text-sm text-slate-500">
        Cuando des de alta a alguien, aquí verás cómo le va sin abrir su ficha.
      </p>
    );
  }

  /** «hace 3 días» dicho corto: es lo que decide a quién escribir hoy. */
  const sinAparecer = (fecha?: string) => {
    if (!fecha) return 'nunca';
    const dias = Math.round(
      (new Date(`${hoy}T12:00:00`).getTime() - new Date(`${fecha}T12:00:00`).getTime()) / 86400000,
    );
    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'ayer';
    return `hace ${dias} d`;
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50/70 text-[10px] tracking-wide text-slate-400 uppercase">
            <th className="px-3 py-2 text-left font-medium">Participante</th>
            <th className="px-3 py-2 text-right font-medium">
              {empezado ? 'Días cerrados' : 'Preparación'}
            </th>
            <th className="px-3 py-2 text-right font-medium">Racha</th>
            <th className="px-3 py-2 text-right font-medium">Fuera</th>
            <th className="px-3 py-2 text-right font-medium">Peso</th>
            <th className="px-3 py-2 text-right font-medium">Última vez</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.cliente.id} className="border-t border-slate-100">
              <td className="px-3 py-2">
                <Link
                  to={`/clientes/${f.cliente.id}`}
                  className="text-sm text-slate-800 hover:text-brand-700 hover:underline"
                >
                  {f.cliente.nombre}
                </Link>
                {f.sinEnviar && (
                  <span className="mt-0.5 block text-[11px] font-medium text-amber-700">
                    Plan sin enviar
                  </span>
                )}
              </td>
              <td className="tnum px-3 py-2 text-right text-sm text-slate-700">
                {empezado ? (
                  `${f.cerrados} de ${dia}`
                ) : (
                  <span
                    className={
                      f.preparacion.hechos.length === PASOS_DE_PREPARACION.length
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }
                  >
                    {f.preparacion.hechos.length}/{PASOS_DE_PREPARACION.length}
                  </span>
                )}
              </td>
              <td className="tnum px-3 py-2 text-right text-sm text-slate-600">{f.racha}</td>
              <td className="tnum px-3 py-2 text-right text-sm text-slate-600">{f.libres}</td>
              <td className="tnum px-3 py-2 text-right text-sm text-slate-600">
                {fmt(f.peso, 1)} kg
                {f.cambio !== undefined && Math.abs(f.cambio) >= 0.1 && (
                  <span className={f.cambio < 0 ? ' text-emerald-700' : ' text-slate-400'}>
                    {' '}
                    {f.cambio > 0 ? '+' : '−'}
                    {fmt(Math.abs(f.cambio), 1)}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right text-sm text-slate-500">
                {sinAparecer(f.ultimoDia)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="border-t border-slate-100 px-3 py-2 text-[11px] leading-snug text-slate-500">
        {empezado
          ? 'Se ordena por días cerrados, que es lo único que depende de ellas. Una comida fuera cierra el día igual que una hecha: si salir a cenar rompiera la racha, la app estaría enseñando que salir a cenar es un fallo.'
          : 'Todavía no ha empezado: lo que se mira es quién ha completado su preparación.'}
      </p>
    </div>
  );
}
