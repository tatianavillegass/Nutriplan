import { fmt } from './ui';

export interface ColumnaDeToma {
  /** Fecha ISO de la toma. */
  fecha: string;
  /** Lo que se escribe encima: 0, 1, 2… como en su planilla. */
  etiqueta: string;
}

export interface FilaDeSeguimiento {
  key: string;
  label: string;
  unidad?: string;
  decimales?: number;
  /** Un valor por columna, en el mismo orden. `undefined` = ese día no se tomó. */
  valores: (number | undefined)[];
  /** Si bajar es lo que se busca (grasa, cintura). Decide el color. */
  bajarEsMejor?: boolean;
  /** Las que no se comparan consigo mismas: la talla. */
  sinDiferencia?: boolean;
}

export interface GrupoDeFilas {
  titulo?: string;
  filas: FilaDeSeguimiento[];
}

interface Props {
  columnas: ColumnaDeToma[];
  grupos: GrupoDeFilas[];
  /** Cabecera de la primera columna. */
  titulo?: string;
}

const fechaCorta = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Días entre dos tomas: la «Diferencia» de la fila de la fecha, en su planilla. */
function diasEntre(a: string, b: string): number | undefined {
  const x = Date.parse(`${a.slice(0, 10)}T12:00:00`);
  const y = Date.parse(`${b.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(x) || Number.isNaN(y)) return undefined;
  return Math.round((y - x) / 86400000);
}

/**
 * LA TABLA QUE ELLA YA TENÍA EN SU EXCEL
 * ======================================
 * Una fila por medida y **una columna por toma**, con su fecha, y detrás de
 * cada una la diferencia con la anterior. Es como lleva el seguimiento desde
 * antes de que existiera la app, y no es casualidad: lo que se mira en consulta
 * no es el último número sino **la línea entera** — dónde se estancó, qué mes
 * se movió, si la cintura baja mientras el muslo se mantiene.
 *
 * Lo que había enseñaba inicial, anterior y actual: tres columnas de las que
 * dos son siempre las mismas. Con cinco o seis tomas eso esconde justo lo que
 * se viene a ver, y obligaba a abrir el Excel al lado para comparar de verdad.
 *
 * EL COLOR DICE LA DIRECCIÓN, NO SI ESTÁ BIEN
 * ===========================================
 * Verde es «hacia donde vamos» y ámbar «al revés», según `bajarEsMejor` de cada
 * fila. Nada más: un perímetro que sube no es un fracaso —puede ser el muslo de
 * quien está ganando músculo— y por eso no hay rojos ni avisos. Lo que
 * significa se habla en consulta.
 *
 * SE LEE DE IZQUIERDA A DERECHA Y LA PRIMERA COLUMNA NO SE VA
 * ==========================================================
 * Con ocho tomas la tabla no cabe en una pantalla, así que se desplaza — y el
 * nombre de la medida se queda fijo. Una tabla de números sin saber de qué fila
 * son no es una tabla.
 */
export function TablaDeSeguimiento({ columnas, grupos, titulo = 'Medida' }: Props) {
  if (columnas.length === 0) return null;

  const conFilas = grupos.filter((g) => g.filas.length > 0);
  if (!conFilas.length) return null;

  /* Cuántas columnas ocupa una fila entera, para los títulos de grupo. */
  const anchoTotal = 1 + columnas.length * 2 - 1;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border-b border-slate-200 bg-white py-1.5 pr-3 text-left text-[11px] font-medium text-slate-500">
              {titulo}
            </th>
            {columnas.map((c, i) => (
              <Celdas key={c.fecha + c.etiqueta}>
                <th className="border-b border-slate-200 px-2 py-1.5 text-right text-[11px] font-semibold text-slate-700">
                  {c.etiqueta}
                </th>
                {i > 0 && (
                  <th className="border-b border-slate-200 px-2 py-1.5 text-right text-[10px] font-medium text-slate-400 italic">
                    Dif.
                  </th>
                )}
              </Celdas>
            ))}
          </tr>
          {/* La fecha va en la cabecera: es de la toma, no una medida más. */}
          <tr>
            <th className="sticky left-0 z-10 border-b border-slate-200 bg-white py-1 pr-3 text-left text-[10px] font-normal text-slate-400">
              Fecha
            </th>
            {columnas.map((c, i) => (
              <Celdas key={`f-${c.fecha}-${i}`}>
                <td className="tnum border-b border-slate-200 px-2 py-1 text-right text-[10px] text-slate-500">
                  {fechaCorta(c.fecha)}
                </td>
                {i > 0 && (
                  <td className="tnum border-b border-slate-200 px-2 py-1 text-right text-[10px] text-slate-400">
                    {(() => {
                      const d = diasEntre(columnas[i - 1].fecha, c.fecha);
                      return d == null ? '' : `${d} d`;
                    })()}
                  </td>
                )}
              </Celdas>
            ))}
          </tr>
        </thead>

        <tbody className="tnum">
          {conFilas.map((g) => (
            <Celdas key={g.titulo ?? g.filas[0].key}>
              {g.titulo && (
                <tr>
                  <td
                    colSpan={anchoTotal}
                    className="pt-3 pb-1 text-[10px] font-medium tracking-wide text-slate-400 uppercase"
                  >
                    {g.titulo}
                  </td>
                </tr>
              )}
              {g.filas.map((f) => (
                <Fila key={f.key} fila={f} columnas={columnas} />
              ))}
            </Celdas>
          ))}
        </tbody>
      </table>

      <p className="mt-2 text-[11px] leading-snug text-slate-400">
        Cada columna es una toma y «Dif.» es el cambio desde la anterior. En verde lo que va
        hacia donde buscáis; lo que no se midió ese día sale vacío.
      </p>
    </div>
  );
}

/** Agrupa celdas sin meter un elemento por medio: la tabla no admite divs. */
function Celdas({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Fila({ fila, columnas }: { fila: FilaDeSeguimiento; columnas: ColumnaDeToma[] }) {
  const dec = fila.decimales ?? 1;

  return (
    <tr className="border-b border-slate-50">
      <th
        scope="row"
        className="sticky left-0 z-10 bg-white py-1.5 pr-3 text-left text-xs font-normal text-slate-600"
      >
        {fila.label}
        {fila.unidad && <span className="ml-1 text-[10px] text-slate-400">{fila.unidad}</span>}
      </th>

      {columnas.map((c, i) => {
        const v = fila.valores[i];
        const previo = i > 0 ? fila.valores[i - 1] : undefined;
        const d = v != null && previo != null ? v - previo : undefined;

        return (
          <Celdas key={`${fila.key}-${c.fecha}-${i}`}>
            <td className="px-2 py-1.5 text-right text-xs font-medium text-slate-800">
              {v != null ? fmt(v, dec) : <span className="text-slate-300">·</span>}
            </td>
            {i > 0 && (
              <td className="px-2 py-1.5 text-right text-xs">
                {fila.sinDiferencia ? (
                  <span className="text-slate-300">·</span>
                ) : (
                  <Diferencia valor={d} decimales={dec} bajarEsMejor={fila.bajarEsMejor} />
                )}
              </td>
            )}
          </Celdas>
        );
      })}
    </tr>
  );
}

/**
 * «Igual» y no «0,0» cuando no se mueve: un cero en una columna de cambios se
 * lee como un dato y lo que dice es que no pasó nada.
 */
function Diferencia({
  valor,
  decimales,
  bajarEsMejor,
}: {
  valor?: number;
  decimales: number;
  bajarEsMejor?: boolean;
}) {
  if (valor == null) return <span className="text-slate-300">·</span>;

  /*
   * «Igual» es lo que no se vería en los decimales que se enseñan: medio
   * dígito del último. Con un umbral fijo, el cociente cintura/cadera —que va
   * a dos decimales— decía «igual» entre 0,67 y 0,65, que es un cambio que sí
   * se lee en la columna de al lado.
   */
  const minimo = 0.5 / 10 ** decimales;
  if (Math.abs(valor) < minimo) return <span className="text-slate-400">igual</span>;

  const haciaDonde = bajarEsMejor == null ? undefined : bajarEsMejor ? valor < 0 : valor > 0;
  const color =
    haciaDonde == null
      ? 'text-slate-600'
      : haciaDonde
        ? 'bg-emerald-50 text-emerald-800'
        : 'bg-amber-50 text-amber-800';

  return (
    <span className={`rounded px-1 py-0.5 ${color}`}>
      {valor > 0 ? '+' : '−'}
      {fmt(Math.abs(valor), decimales)}
    </span>
  );
}
