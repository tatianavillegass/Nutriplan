import type { Client } from '../../types/client';
import type {
  Composicion,
  DeltaMedicion,
  FormulaGrasaId,
  Medicion,
} from '../../types/anthropometry';
import {
  DIAMETRO_LABELS,
  FORMULA_GRASA_LABELS,
  PERIMETRO_LABELS,
  PLIEGUE_LABELS,
  type DiametroId,
  type PerimetroId,
  type PliegueId,
} from '../../types/anthropometry';
import { fechaLarga } from './printing';

/**
 * EL INFORME DE ANTROPOMETRÍA
 *
 * Hasta ahora los números de una medición sólo se veían en pantalla. En
 * consulta hace falta poder darle algo a la clienta —o guardarlo en su
 * carpeta— sin tener que copiarlo a mano.
 *
 * Tres decisiones sobre qué NO lleva:
 *
 *  · **No lleva lo que faltó por medir.** El cálculo interno sabe qué pliegues
 *    faltan para completar una fórmula, y eso le sirve a ella en pantalla. En
 *    una hoja que se le entrega a la clienta, una lista de lo que no se midió
 *    sólo dice que el trabajo está a medias.
 *  · **No lleva juicios.** Van las categorías clínicas que ya se calculan
 *    (IMC, riesgo por índice cintura-cadera) y nada más. Ni «bien», ni «mal»,
 *    ni flechas de colores: unos pliegues no son una nota.
 *  · **La bioimpedancia va aparte.** Cada báscula usa su fórmula, así que no
 *    se mezcla con lo de los pliegues; se enseña en su bloque y se compara
 *    consigo misma. Es la misma regla que en pantalla.
 */

const num = (v: number | undefined, dec = 1, unidad = '') =>
  v === undefined || Number.isNaN(v) ? '—' : `${v.toFixed(dec)}${unidad ? ` ${unidad}` : ''}`;

/** Un cambio con su signo: lo que se lee de un vistazo es si sube o baja. */
const conSigno = (v: number | undefined, dec = 1) =>
  v === undefined || Number.isNaN(v) ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(dec)}`;

function Bloque({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h2 className="mb-2 border-b border-brand-200 pb-1 text-[10px] font-bold tracking-[0.15em] text-brand-800 uppercase">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/** Una rejilla de «etiqueta: valor», que es como se lee una ficha. */
function Datos({ filas }: { filas: [string, string][] }) {
  const conAlgo = filas.filter(([, v]) => v !== '—');
  if (!conAlgo.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] sm:grid-cols-3">
      {conAlgo.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2 border-b border-slate-100 py-0.5">
          <dt className="text-slate-500">{k}</dt>
          <dd className="tnum font-medium text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AnthroReportPDF({
  client,
  medicion,
  composicion,
  evolucion,
  formula,
  numeroVisita,
}: {
  client: Client;
  medicion: Medicion;
  composicion: Composicion;
  evolucion: DeltaMedicion[];
  formula: FormulaGrasaId;
  /** La cuántas veces la has medido: «visita 3». */
  numeroVisita: number;
}) {
  const c = composicion;
  const soma = c.somatotipo;
  const bio = medicion.bioimpedancia;
  const hayBio =
    !!bio && [bio.grasaPct, bio.musculoPct, bio.aguaPct, bio.visceral].some((v) => v !== undefined);

  /* Sólo se enseñan las filas que tienen dato: una tabla llena de rayas no
     informa, y en una hoja impresa ocupa el mismo sitio que lo que sí hay. */
  const filasEvolucion = evolucion.filter((f) => f.actual !== undefined);
  /*
   * Sólo se compara si hay una visita anterior de verdad. Con una sola, el
   * cálculo compara la medición consigo misma y sale una columna de ceros que
   * no dice nada.
   */
  const hayComparacion = filasEvolucion.some((f) => f.deltaPrevio !== undefined);

  return (
    <div className="print-doc">
      <section className="print-page">
        <header className="mb-4 border-b-2 border-brand-700 pb-3">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-brand-600 uppercase">
            Informe de antropometría
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-900">
            {client.nombre}
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            Medición del {fechaLarga(new Date(`${medicion.fecha}T12:00:00`))}
            {numeroVisita > 1 && ` · visita ${numeroVisita}`}
          </p>
        </header>

        <Bloque titulo="Medidas básicas">
          <Datos
            filas={[
              ['Peso', num(medicion.peso, 1, 'kg')],
              ['Talla', num(medicion.talla, 1, 'cm')],
              ['IMC', c.imc === undefined ? '—' : `${c.imc.toFixed(1)} · ${c.categoriaImc ?? ''}`],
              [
                'Índice cintura-cadera',
                c.ratioCinturaCadera === undefined
                  ? '—'
                  : `${c.ratioCinturaCadera.toFixed(2)} · ${c.riesgoIcc ?? ''}`,
              ],
              ['Talla sentado', num(medicion.talla_sentado, 1, 'cm')],
              ['Envergadura', num(medicion.envergadura, 1, 'cm')],
            ]}
          />
        </Bloque>

        <Bloque titulo={`Composición corporal · ${FORMULA_GRASA_LABELS[formula]}`}>
          <Datos
            filas={[
              ['Grasa', num(c.grasaPct[formula], 1, '%')],
              ['Grasa', num(c.grasaKg[formula], 1, 'kg')],
              ['Masa magra', num(c.masaMagraKg[formula], 1, 'kg')],
              ['Masa muscular', num(c.masaMuscularKg, 1, 'kg')],
              ['Masa muscular', num(c.masaMuscularPct, 1, '%')],
              ['Masa ósea', num(c.masaOseaKg, 1, 'kg')],
              ['Σ 6 pliegues', num(c.suma6, 1, 'mm')],
              ['Σ 8 pliegues', num(c.suma8, 1, 'mm')],
            ]}
          />
        </Bloque>

        {hayComparacion && (
          <Bloque titulo="Cómo va cambiando">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[9px] tracking-wide text-slate-400 uppercase">
                  <th className="py-1 text-left font-medium">Medida</th>
                  <th className="py-1 text-right font-medium">Hoy</th>
                  <th className="py-1 text-right font-medium">Desde la anterior</th>
                  <th className="py-1 text-right font-medium">Desde la primera</th>
                </tr>
              </thead>
              <tbody>
                {filasEvolucion.map((f) => (
                  <tr key={f.key} className="border-t border-slate-100">
                    <td className="py-1 text-slate-600">{f.label}</td>
                    <td className="tnum py-1 text-right font-medium text-slate-900">
                      {num(f.actual, f.decimales)} <span className="text-slate-400">{f.unidad}</span>
                    </td>
                    <td className="tnum py-1 text-right text-slate-600">
                      {conSigno(f.deltaPrevio, f.decimales)}
                    </td>
                    <td className="tnum py-1 text-right text-slate-600">
                      {conSigno(f.deltaInicial, f.decimales)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Bloque>
        )}

        <Bloque titulo="Pliegues cutáneos (mm)">
          <Datos
            filas={(Object.keys(PLIEGUE_LABELS) as PliegueId[]).map((k) => [
              PLIEGUE_LABELS[k],
              num(medicion.pliegues[k], 1),
            ])}
          />
        </Bloque>

        <Bloque titulo="Perímetros (cm)">
          <Datos
            filas={[
              ...(Object.keys(PERIMETRO_LABELS) as PerimetroId[]).map(
                (k) => [PERIMETRO_LABELS[k], num(medicion.perimetros[k], 1)] as [string, string],
              ),
              ['Brazo corregido', num(c.perimetroCorregidoBrazo, 1)],
              ['Muslo corregido', num(c.perimetroCorregidoMuslo, 1)],
              ['Pierna corregida', num(c.perimetroCorregidoPierna, 1)],
            ]}
          />
        </Bloque>

        <Bloque titulo="Diámetros óseos (cm)">
          <Datos
            filas={(Object.keys(DIAMETRO_LABELS) as DiametroId[]).map((k) => [
              DIAMETRO_LABELS[k],
              num(medicion.diametros[k], 1),
            ])}
          />
        </Bloque>

        {soma && (
          <Bloque titulo="Somatotipo">
            <Datos
              filas={[
                ['Endomorfia', num(soma.endomorfia, 1)],
                ['Mesomorfia', num(soma.mesomorfia, 1)],
                ['Ectomorfia', num(soma.ectomorfia, 1)],
                ['Clasificación', soma.categoria || '—'],
              ]}
            />
          </Bloque>
        )}

        {hayBio && (
          <Bloque titulo="Bioimpedancia">
            <Datos
              filas={[
                ['Grasa', num(bio?.grasaPct, 1, '%')],
                ['Músculo', num(bio?.musculoPct, 1, '%')],
                ['Agua', num(bio?.aguaPct, 1, '%')],
                ['Grasa visceral', num(bio?.visceral, 0)],
              ]}
            />
            <p className="mt-1.5 text-[9px] leading-snug text-slate-400">
              Cada báscula usa su propia fórmula, así que estos valores no se mezclan con los
              obtenidos por pliegues: se comparan con los de la misma báscula.
            </p>
          </Bloque>
        )}

        {medicion.notas && (
          <Bloque titulo="Notas">
            <p className="text-[11px] leading-relaxed whitespace-pre-line text-slate-700">
              {medicion.notas}
            </p>
          </Bloque>
        )}

        <footer className="mt-8 border-t border-slate-200 pt-2 text-[9px] text-slate-400">
          TVS Nutrición · Tatiana Villegas · Dietista-Nutricionista · Col. MAD001160
        </footer>
      </section>
    </div>
  );
}
