import type { Client } from '../../types/client';
import { seMide } from '../../types/client';
import { CAMPOS } from '../../utils/misMedidas';
import { Card } from '../common/ui';

/**
 * QUE SE MIDA ELLA
 *
 * A las presenciales las mides tú con el plicómetro, y pedirles además que se
 * pasen la cinta en casa es duplicar el trabajo con peor dato. A las online no
 * hay forma de medirlas: hasta ahora se les mandaba una planilla por correo,
 * que se rellena una vez y se deja de rellenar —hay que abrir el correo, buscar
 * el archivo, encontrar la columna del mes y acordarse de devolverlo—.
 *
 * Por eso es un interruptor y no algo que esté para todas.
 */
export function MedidasDeCliente({
  client,
  onChange,
}: {
  client: Client;
  onChange: (p: Partial<Client>) => void;
}) {
  const encendido = seMide(client);
  const online = client.modalidad === 'online';

  return (
    <Card
      title="Que se mida ella"
      subtitle="Los mismos campos de tu planilla, en su app: peso, altura, perímetros, bioimpedancia y fotos"
    >
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={encendido}
          onChange={(e) => onChange({ medidas: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-teal-600"
        />
        <span className="text-sm leading-snug text-slate-700">
          Dejarle apuntar sus medidas
          <span className="mt-0.5 block text-xs text-slate-500">
            Le sale en su pestaña «Resumen». Todo opcional: no se le pide, no se le recuerda y no
            rompe ninguna racha. Tú lo ves en Seguimiento.
          </span>
        </span>
      </label>

      {/*
        No se enciende solo por ser online: es una sugerencia, no una regla. Hay
        gente online a la que pedirle que se mida le hace daño, y eso lo sabe
        ella y no la app.
      */}
      {online && !encendido && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-900">
          Esta clienta es online, así que no la mides tú en consulta. Sin esto, lo único que vas a
          saber de su cuerpo es lo que te cuente por mensaje.
        </p>
      )}

      {!online && encendido && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-snug text-slate-600">
          Es presencial: la mides tú en consulta. Si lo dejas encendido, tendrás dos juegos de
          medidas —los tuyos y los suyos— y no se mezclan a propósito.
        </p>
      )}

      {encendido && (
        <>
          <p className="mt-4 mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Lo que se le pide
          </p>
          <p className="text-xs leading-snug text-slate-600">
            {CAMPOS.map((c) => c.nombre).join(' · ')}. Además, lo que marque su báscula de
            bioimpedancia si tiene, tres fotos y una nota.
          </p>
          <p className="mt-2 text-xs leading-snug text-slate-500">
            Sus números <strong className="font-medium">no entran en tu antropometría</strong>: su
            báscula de casa y tus pliegues no se comparan, igual que no se comparan la
            bioimpedancia y los pliegues. Van en su propio bloque.
          </p>
        </>
      )}
    </Card>
  );
}
