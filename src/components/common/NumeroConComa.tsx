import { useEffect, useState } from 'react';
import { Input } from './ui';

interface Props {
  /** Modo texto: el padre guarda lo que se escribe tal cual. */
  value?: string;
  onChange?: (texto: string) => void;
  /**
   * Modo número: el padre guarda el número y la casilla se encarga del texto.
   * Es el que hay que usar cuando lo que se guarda es un número, porque si no
   * la coma se borra sola al teclearla (ver abajo).
   */
  numero?: number;
  onNumero?: (n: number | undefined) => void;
  /** Deja pasar el cero. En una etiqueta, 0 g de grasa es un dato. */
  cero?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * UN NÚMERO QUE ACEPTA COMA
 *
 * En España se escribe 59,8. Con `type="number"` el navegador espera un punto
 * y, al teclear la coma, tira el valor entero: la casilla se queda vacía y
 * parece que la app no deja poner decimales. Encima el teclado del móvil no
 * siempre ofrece el punto.
 *
 * Así que se usa una casilla de texto con teclado numérico y se admiten las
 * dos: la coma se traduce a punto al leerla. Lo que se filtra son las letras,
 * para que siga siendo un número.
 *
 * Y POR QUÉ HACE FALTA EL MODO NÚMERO
 * ===================================
 * El fallo no estaba aquí sino en quien la usaba. Guardando el número y
 * pintando `String(numero)`, al teclear «1,» el padre guarda 1 y devuelve
 * «1»: la coma que se acaba de escribir desaparece en el mismo gesto, así que
 * el decimal no se puede llegar a escribir nunca. Es el mismo fallo que tenían
 * los tags de las recetas con las comas.
 *
 * Con `numero`/`onNumero` la casilla guarda su propio texto y sólo lo vuelve a
 * pintar desde fuera cuando lo de fuera dice algo distinto —al cargar otro
 * alimento, por ejemplo—.
 */
export function NumeroConComa({ value, onChange, numero, onNumero, cero, ...resto }: Props) {
  const [texto, setTexto] = useState(() => deNumero(numero));
  const propio = aNumero(texto, cero);

  useEffect(() => {
    // Sólo se pisa lo que se está escribiendo si de fuera viene otra cosa.
    if (propio !== numero) setTexto(deNumero(numero));
    // `propio` se recalcula en cada render; lo que se vigila es el de fuera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numero]);

  const gestionado = !!onNumero;

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={gestionado ? texto : (value ?? '')}
      onChange={(e) => {
        const limpio = e.target.value.replace(/[^\d.,]/g, '');
        if (gestionado) {
          setTexto(limpio);
          onNumero(aNumero(limpio, cero));
        } else onChange?.(limpio);
      }}
      {...resto}
    />
  );
}

/** 59.8 → «59,8». Sin número, vacío. */
function deNumero(n: number | undefined): string {
  return n === undefined ? '' : String(n).replace('.', ',');
}

/**
 * «59,8» → 59.8. Vacío o ilegible → undefined, que es «no lo ha puesto».
 * Con `cero`, el 0 cuenta como dato: una bebida con 0 g de grasa lo pone en la
 * etiqueta y guardarlo como «no lo ha puesto» sería perderlo.
 */
export function aNumero(texto: string, cero = false): number | undefined {
  const limpio = texto.replace(',', '.').trim();
  if (!limpio) return undefined;
  const n = Number(limpio);
  if (!Number.isFinite(n)) return undefined;
  return cero ? (n >= 0 ? n : undefined) : n > 0 ? n : undefined;
}
