import { useEffect, useRef, useState } from 'react';
import { Button, Input } from '../common/ui';

interface Props {
  mealNombre: string;
  /** Si ya está marcada, la nota que escribió (puede estar vacía). */
  libre?: { nota?: string };
  onMarcar: (nota?: string) => void;
  onQuitar: () => void;
  soloLectura?: boolean;
  /**
   * Abierto desde fuera. En el día de la clienta el botón «Libre» vive en la
   * cabecera de la comida, junto a su nombre: tener aquí abajo otro botón
   * suelto hacía dudar de a qué comida pertenecía —¿a la de arriba o a la que
   * empieza justo debajo?—. Con esto, el de la cabecera abre este formulario.
   */
  abierto?: boolean;
  onCerrar?: () => void;
  /** No pintar el botón propio: alguien de fuera se encarga de abrirlo. */
  sinBoton?: boolean;
}

/**
 * COMIDA LIBRE
 *
 * Comer fuera del plan no es romperlo. Esto no pide gramos ni calorías: no se
 * pueden saber y fingir que sí sólo enseña a desconfiar de una comida normal.
 * Lo que se apunta es que pasó, para poder mirar la frecuencia en consulta.
 *
 * La nota es opcional y en blanco: si le apetece contar dónde fue o cómo se
 * sintió, tiene sitio; si no, marca y sigue con su día.
 */
export function ComidaLibre({
  mealNombre,
  libre,
  onMarcar,
  onQuitar,
  soloLectura,
  abierto: abiertoFuera,
  onCerrar,
  sinBoton = false,
}: Props) {
  const [abiertoDentro, setAbiertoDentro] = useState(false);
  const [nota, setNota] = useState(libre?.nota ?? '');

  const abierto = abiertoFuera ?? abiertoDentro;
  const cerrar = () => {
    setAbiertoDentro(false);
    onCerrar?.();
  };

  /**
   * BAJAR HASTA LO QUE SE ACABA DE ABRIR
   *
   * El botón «Libre» está en la cabecera de la comida y el formulario sale al
   * final del bloque, que en un móvil queda fuera de pantalla: se pulsaba, no
   * se movía nada, y parecía que el botón no hacía nada — o peor, que la
   * comida ya estaba marcada. Con esto la pantalla va sola hasta el
   * formulario.
   *
   * No se le pone el foco al campo a propósito: abriría el teclado y taparía
   * medio formulario justo cuando hay que leerlo. La nota es opcional.
   */
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    caja.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [abierto]);

  if (libre) {
    return (
      <div className="mt-1.5 rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2 no-print">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-violet-900">
            {mealNombre} libre · sin contar
          </span>
          {!soloLectura && (
            <button
              onClick={onQuitar}
              className="text-[11px] text-violet-700 underline hover:text-violet-900"
            >
              Deshacer
            </button>
          )}
        </div>
        {libre.nota && (
          <p className="mt-1 text-[11px] leading-snug text-slate-600">«{libre.nota}»</p>
        )}
      </div>
    );
  }

  if (soloLectura) return null;
  if (!abierto && sinBoton) return null;

  return (
    <div className="mt-1.5 no-print">
      {!abierto ? (
        <div className="flex justify-end">
          <button
            onClick={() => setAbiertoDentro(true)}
            className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-50"
          >
            Comida libre
          </button>
        </div>
      ) : (
        <div ref={caja} className="rounded-lg border border-violet-200 bg-violet-50/60 p-3">
          <p className="text-xs font-medium text-violet-900">
            Marcar {mealNombre.toLowerCase()} como comida libre
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
            No hace falta contar nada. Si te apetece dejar escrito algo, aquí tienes sitio.
          </p>
          <Input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Opcional: lo que quieras contar"
            className="mt-2 w-full text-sm"
          />
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={cerrar}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                onMarcar(nota.trim() || undefined);
                cerrar();
              }}
            >
              Marcar como libre
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
