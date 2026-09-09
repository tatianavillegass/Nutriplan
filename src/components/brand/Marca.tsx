import { BROTE_PNG } from './brote';

/**
 * LA MARCA, PARA LO QUE SE IMPRIME
 *
 * La app por dentro usa su propia paleta (`brand-*`), más apagada, porque una
 * pantalla que se mira todos los días no puede ir a todo color. Una hoja que se
 * pega en la nevera es otra cosa: se ve de lejos, se enseña y lleva su nombre,
 * así que aquí manda el brand board — no los tokens de la interfaz.
 */
export const MARCA = {
  /** Verde principal del brand board. */
  verde: '#006257',
  /** El oscuro, para los titulares. */
  oscuro: '#02403A',
  /** El claro, para las bandas de cada comida. */
  claro: '#67B49B',
  /** El melocotón, para lo que acompaña sin pesar. */
  arena: '#F8D5B4',
  nombre: 'Tatiana Villegas',
  rol: 'Nutricionista',
} as const;

/** El brote, a la altura que se le pida. */
export function Brote({ alto = 22, className = '' }: { alto?: number; className?: string }) {
  return (
    <img
      src={BROTE_PNG}
      alt=""
      aria-hidden
      style={{ height: alto, width: 'auto' }}
      className={className}
    />
  );
}

/**
 * MARCA DE AGUA
 *
 * Va detrás del contenido y muy pálida: si se lee, estorba. El truco de las
 * hojas impresas es que el navegador **no imprime fondos** salvo que se le
 * diga, y por eso lleva `printColorAdjust: exact`. Sin eso, en el PDF la hoja
 * sale en blanco y negro y todo el trabajo de marca se pierde.
 */
export function MarcaDeAgua({ ancho = 320 }: { ancho?: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 0,
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      <img src={BROTE_PNG} alt="" style={{ width: ancho, opacity: 0.05 }} />
    </div>
  );
}

/** Cabecera de marca: el brote, su nombre y una línea de color. */
export function CabeceraDeMarca({ children }: { children?: React.ReactNode }) {
  return (
    <header
      className="mb-4 flex items-end justify-between gap-4 border-b pb-2"
      style={{ borderColor: MARCA.verde, printColorAdjust: 'exact' }}
    >
      <div className="min-w-0">{children}</div>
      <div className="flex shrink-0 items-center gap-2">
        <Brote alto={26} />
        <div className="text-right leading-tight">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase" style={{ color: MARCA.oscuro }}>
            {MARCA.nombre}
          </p>
          <p className="text-[8px] tracking-[0.18em] uppercase" style={{ color: MARCA.verde }}>
            {MARCA.rol}
          </p>
        </div>
      </div>
    </header>
  );
}
