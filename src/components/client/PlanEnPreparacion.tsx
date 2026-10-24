/**
 * «TU SIGUIENTE PLAN ESTÁ SIENDO ELABORADO»
 *
 * Empezar una planificación nueva dejaba a la clienta sin plan: «todavía se
 * está preparando» durante las horas —a veces el día entero— que se tarda en
 * montarlo, y justo ese día es cuando más mira la app. Ahora sigue viendo el
 * que tenía (ver `planVisibleParaCliente`) y esto le explica por qué le va a
 * cambiar de un momento a otro.
 *
 * SE PUEDE QUITAR, Y POR ESO SE PUEDE PONER
 * =========================================
 * Un aviso que no se cierra acaba leyéndose como parte del decorado y estorba
 * cada vez que se abre la app para mirar la cena. Como se quita, puede estar
 * arriba y verse; y como se guarda **por planificación**, cerrarlo vale para
 * siempre con ésta y el aviso del siguiente plan vuelve a salir.
 *
 * NO DICE CUÁNDO
 * ==============
 * Nada de «en 24 h» ni «esta tarde»: una fecha que se incumple hace más daño
 * que la espera, y aquí no hay forma de saberla — depende de cuándo se siente
 * ella a montarlo.
 */

interface Props {
  onCerrar: () => void;
}

export function PlanEnPreparacion({ onCerrar }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 no-print">
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug font-medium text-sky-900">
          Tu siguiente plan está siendo elaborado
        </p>
        {/*
          Lo que de verdad hace falta decir: que mientras tanto NO está en el
          aire. Sin esta línea, el aviso sólo crea la duda de si lo que tiene
          delante sigue valiendo.
        */}
        <p className="mt-0.5 text-xs leading-snug text-sky-800">
          Mientras tanto sigue con éste, que es el último que te mandé. Cuando
          el nuevo esté listo lo verás aquí sin hacer nada.
        </p>
      </div>
      <button
        onClick={onCerrar}
        aria-label="Cerrar el aviso"
        className="shrink-0 rounded px-1.5 py-0.5 text-sky-400 transition hover:text-sky-700"
      >
        ×
      </button>
    </div>
  );
}
