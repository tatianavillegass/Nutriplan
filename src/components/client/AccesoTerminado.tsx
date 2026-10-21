import { Button } from '../common/ui';

/**
 * SU ACCESO SE TERMINÓ
 *
 * Esto no existía, y eso era el problema: «Acceso hasta» era una nota en la
 * tabla de la nutricionista y nada más. Nadie comprobaba la fecha, así que una
 * clienta dada de baja en marzo seguía entrando en octubre y marcando comidas
 * como si siguiera en consulta — y el recuento de activas decía la verdad de
 * lo apuntado y una mentira de lo que pasaba.
 *
 * CÓMO SE DICE
 * ============
 * Con la fecha y sin regañar. Que se acabe un bono no es un castigo ni un
 * fallo suyo: es que terminó lo que contrató. El mensaje da la fecha —para
 * que no parezca un error de la app— y una salida: escribirle.
 *
 * Y se dice que **sus datos siguen ahí**. Es lo primero que se piensa al ver
 * una pantalla así («¿he perdido mis medidas de seis meses?») y es lo único
 * que convierte un final en una pausa.
 *
 * LO QUE NO SE HACE
 * =================
 * **No se enseña el plan de fondo, ni en gris.** Un plan que se ve pero no se
 * puede tocar es una tienda con la persiana a medias: se intenta, no funciona,
 * y la clienta escribe para preguntar si la app está rota.
 *
 * **No se pide pagar aquí.** Lo que viene después se habla con ella, que es
 * quien sabe si toca renovar, cambiar de plan o dejarlo.
 */

interface Props {
  nombre: string;
  /** YYYY-MM-DD, el día en que se le acabó. */
  termino?: string;
  /** Para escribirle: su correo, si la app lo sabe. */
  emailNutri?: string;
  nombreNutri?: string;
}

const legible = (iso?: string) => {
  if (!iso) return undefined;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
};

export function AccesoTerminado({ nombre, termino, emailNutri, nombreNutri }: Props) {
  const fecha = legible(termino);
  const asunto = encodeURIComponent('Quiero seguir con mi plan');
  const cuerpo = encodeURIComponent(
    `¡Hola${nombreNutri ? ` ${nombreNutri}` : ''}! Soy ${nombre}. Se me ha terminado el acceso a la app y me gustaría seguir.`,
  );

  return (
    <div className="vista-cliente mx-auto max-w-md space-y-4 py-10 text-center">
      <h1 className="text-2xl leading-tight font-semibold tracking-tight text-brand-900">
        Hasta aquí por ahora, {nombre.split(' ')[0]}
      </h1>

      <p className="text-sm leading-relaxed text-slate-600">
        {fecha ? (
          <>
            Tu acceso a la app terminó el <span className="font-medium">{fecha}</span>.
          </>
        ) : (
          <>Tu acceso a la app ha terminado.</>
        )}{' '}
        No es un fallo de la aplicación: es que se acabó lo que tenías
        contratado.
      </p>

      {/*
        Lo primero que se piensa al ver esta pantalla es «¿he perdido mis
        medidas?». Contestarlo antes de que lo pregunte es la mitad del
        mensaje.
      */}
      <p className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm leading-relaxed text-brand-900">
        Lo tuyo se queda guardado: tus medidas, tus fotos y tu racha siguen
        aquí. Si vuelves, lo encuentras donde lo dejaste.
      </p>

      {emailNutri ? (
        <div className="space-y-2">
          <Button
            onClick={() => {
              window.location.href = `mailto:${emailNutri}?subject=${asunto}&body=${cuerpo}`;
            }}
          >
            Escribir para seguir
          </Button>
          <p className="text-[11px] text-slate-400">{emailNutri}</p>
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Escribe a tu nutricionista si quieres seguir.
        </p>
      )}
    </div>
  );
}
