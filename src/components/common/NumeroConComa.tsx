import { Input } from './ui';

interface Props {
  value: string;
  onChange: (texto: string) => void;
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
 */
export function NumeroConComa({ value, onChange, ...resto }: Props) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
      {...resto}
    />
  );
}

/** «59,8» → 59.8. Vacío o ilegible → undefined, que es «no lo ha puesto». */
export function aNumero(texto: string): number | undefined {
  const limpio = texto.replace(',', '.').trim();
  if (!limpio) return undefined;
  const n = Number(limpio);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
