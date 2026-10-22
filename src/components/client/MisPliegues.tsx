import { useMemo, useState } from 'react';
import {
  PLIEGUE_LABELS,
  type DeltaMedicion,
  type Medicion,
  type PliegueId,
} from '../../types/anthropometry';
import { calcularEvolucion, ordenarMediciones } from '../../utils/anthropometry';
import { edadDe, type Client } from '../../types/client';
import { fmt } from '../common/ui';

/**
 * SUS PLIEGUES SON SUYOS
 *
 * A las presenciales las mide ella con el plicómetro, y hasta ahora esos
 * números se quedaban en la consulta: la clienta veía su peso y su % de grasa
 * y nada más. Pero el pliegue es el dato que explica el resto —el % de grasa
 * sale de ellos— y cuando en consulta se dice «te ha bajado el abdominal»,
 * quien se lo escucha no tiene dónde mirarlo después.
 *
 * LO QUE IMPORTA ES LA DIRECCIÓN, NO EL NÚMERO
 * ============================================
 * Un pliegue suelto no dice nada: 18 mm no es bueno ni malo. Lo que informa es
 * que vaya a algún sitio, y por eso cada línea trae **cuánto ha cambiado desde
 * la vez anterior y desde la primera**, que es la comparación de la que se
 * habla en consulta.
 *
 * Y por eso también **empieza cerrado**. Quien entra a ver su racha no tiene
 * por qué encontrarse ocho medidas de su cuerpo de golpe; quien viene a
 * mirarlas, lo abre. Es la misma regla de las otras tarjetas que pesan.
 *
 * NI SEMÁFOROS NI VALORES DE REFERENCIA
 * =====================================
 * Nada de «estás por encima de lo normal». Un rango de referencia al lado de
 * un número del propio cuerpo convierte una medida en un aprobado o un
 * suspenso, y eso es justo lo que esta app no hace en ningún sitio. El verde y
 * el ámbar de los cambios son los mismos de la ficha de ella: dicen hacia
 * dónde va, no si está bien.
 *
 * SIN MEDIR, NO SE PINTA
 * ======================
 * Las online no tienen pliegues —no hay plicómetro al otro lado— así que esto
 * no existe para ellas. No hace falta preguntar si es presencial: si hay
 * pliegues medidos, se enseñan; si no, no hay tarjeta. El dato decide.
 */

interface Props {
  client: Client;
  mediciones: Medicion[];
}

const PLIEGUES = Object.keys(PLIEGUE_LABELS) as PliegueId[];

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

/**
 * «17», no «17,0». El decimal sólo aparece cuando lo hay: el plicómetro da
 * medios milímetros, pero una columna de ceros detrás de la coma se lee peor y
 * no añade nada.
 */
const num = (n: number, decimales: number) => fmt(n, n % 1 ? decimales : 0);

/** El cambio de una medida, con su signo y su color. */
function Cambio({ v, decimales, bajarEsMejor }: { v?: number; decimales: number; bajarEsMejor?: boolean }) {
  /*
   * «+0,0» no es un cambio, es ruido: si la diferencia se redondea a cero con
   * los decimales que se enseñan, no se ha movido nada que se pueda ver.
   */
  const visible = v != null && Math.abs(v) >= 0.5 / 10 ** decimales;
  if (!visible) return <span className="text-slate-300">—</span>;
  const mejora = bajarEsMejor ? v! < 0 : v! > 0;
  return (
    <span className={mejora ? 'text-emerald-700' : 'text-amber-700'}>
      {v! > 0 ? '+' : '−'}
      {num(Math.abs(v!), decimales)}
    </span>
  );
}

export function MisPliegues({ client, mediciones }: Props) {
  const [abierto, setAbierto] = useState(false);

  const orden = useMemo(() => ordenarMediciones(mediciones), [mediciones]);
  const ultima = orden[orden.length - 1];
  const previa = orden[orden.length - 2];
  const primera = orden[0];

  /** Las mismas filas que ve ella en la ficha: una sola forma de comparar. */
  const evolucion: DeltaMedicion[] = useMemo(
    () =>
      calcularEvolucion(
        mediciones,
        client.sexo,
        edadDe(client),
        client.formulaGrasa ?? 'faulkner',
      ),
    [mediciones, client],
  );

  const medidos = ultima
    ? PLIEGUES.filter((p) => ultima.pliegues?.[p] != null)
    : [];

  // Sin plicómetro no hay nada que enseñar, y una tarjeta vacía sobra.
  if (!ultima || !medidos.length) return null;

  const comparables = evolucion.filter(
    (f) => f.actual != null && (f.deltaPrevio != null || f.deltaInicial != null),
  );

  return (
    <section>
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-baseline gap-2 text-left"
      >
        <h2 className="text-sm font-bold tracking-widest text-brand-800 uppercase">
          Tus pliegues
        </h2>
        <span className="ml-auto text-xs text-slate-400">
          {abierto ? 'Cerrar' : 'Ver'}
        </span>
      </button>

      {abierto && (
        <div className="mt-2 space-y-3">
          <p className="text-[11px] leading-snug text-slate-500">
            Medidos con el plicómetro el {fechaCorta(ultima.fecha)}. Un pliegue
            suelto no dice nada por sí mismo: lo que cuenta es hacia dónde va.
          </p>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] tracking-wide text-slate-400 uppercase">
                  <th className="px-3 py-2 text-left font-medium">Pliegue</th>
                  <th className="px-2 py-2 text-right font-medium">mm</th>
                  {previa && <th className="px-2 py-2 text-right font-medium">vs anterior</th>}
                  {primera !== ultima && (
                    <th className="px-3 py-2 text-right font-medium">vs primera</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {medidos.map((p) => {
                  const ahora = ultima.pliegues![p]!;
                  const antes = previa?.pliegues?.[p];
                  const inicio = primera?.pliegues?.[p];
                  return (
                    <tr key={p} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-1.5 text-slate-700">{PLIEGUE_LABELS[p]}</td>
                      <td className="tnum px-2 py-1.5 text-right font-medium text-slate-800">
                        {num(ahora, 1)}
                      </td>
                      {previa && (
                        <td className="tnum px-2 py-1.5 text-right">
                          <Cambio
                            v={antes != null ? ahora - antes : undefined}
                            decimales={1}
                            bajarEsMejor
                          />
                        </td>
                      )}
                      {primera !== ultima && (
                        <td className="tnum px-3 py-1.5 text-right">
                          <Cambio
                            v={inicio != null ? ahora - inicio : undefined}
                            decimales={1}
                            bajarEsMejor
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/*
            EL COMPARATIVO, EL MISMO QUE VE ELLA
            Sale de `calcularEvolucion`, que es lo que pinta su ficha: dos
            tablas distintas del mismo cuerpo acabarían discrepando, y
            entonces la pregunta en consulta sería cuál de las dos vale.
          */}
          {comparables.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] tracking-wide text-slate-400 uppercase">
                    <th className="px-3 py-2 text-left font-medium">Cómo has ido</th>
                    <th className="px-2 py-2 text-right font-medium">Ahora</th>
                    {previa && <th className="px-2 py-2 text-right font-medium">vs anterior</th>}
                    {primera !== ultima && (
                      <th className="px-3 py-2 text-right font-medium">vs primera</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {comparables.map((f) => (
                    <tr key={f.key} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-1.5 text-slate-700">{f.label}</td>
                      <td className="tnum px-2 py-1.5 text-right font-medium text-slate-800">
                        {num(f.actual!, f.decimales)}
                        {f.unidad && <span className="ml-0.5 text-[11px] text-slate-400">{f.unidad}</span>}
                      </td>
                      {previa && (
                        <td className="tnum px-2 py-1.5 text-right">
                          <Cambio
                            v={f.deltaPrevio}
                            decimales={f.decimales}
                            bajarEsMejor={f.bajarEsMejor}
                          />
                        </td>
                      )}
                      {primera !== ultima && (
                        <td className="tnum px-3 py-1.5 text-right">
                          <Cambio
                            v={f.deltaInicial}
                            decimales={f.decimales}
                            bajarEsMejor={f.bajarEsMejor}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11px] leading-snug text-slate-500">
            Entre una medición y otra el cuerpo se mueve por muchas cosas —agua,
            sueño, el momento del ciclo—, así que lo que dice algo es la
            dirección de varias, no el salto de una.
          </p>
        </div>
      )}
    </section>
  );
}
