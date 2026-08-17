import { useMemo, useState } from 'react';
import type { Alimento } from '../../types/food';
import type { Client } from '../../types/client';
import type { RegistroDia } from '../../types/diary';
import { Button, fmt } from '../common/ui';
import { guardarOmitidos, leerOmitidos, omitir } from '../../utils/repartos';

interface Props {
  clients: Client[];
  registros: RegistroDia[];
  /** El catálogo: lo que ya está no se vuelve a ofrecer. */
  foods: Alimento[];
  onAnadir: (alimento: Alimento) => void;
}

export interface AlimentoDeCliente {
  alimento: Alimento;
  quien: string;
  fecha: string;
}

/**
 * Los que se han calculado ellos con la etiqueta, de lo más nuevo a lo más
 * viejo. Se salta lo que ya esté en el catálogo con el mismo nombre: lo que se
 * busca aquí es lo que falta, no una lista de repetidos.
 */
export function alimentosDeClientes(
  clients: Client[],
  registros: RegistroDia[],
  foods: Alimento[],
  omitidos: string[] = [],
): AlimentoDeCliente[] {
  const yaEstan = new Set([
    ...foods.map((f) => f.nombre.trim().toLowerCase()),
    ...omitidos,
  ]);
  const nombreDe = new Map(clients.map((c) => [c.id, c.nombre]));
  const vistos = new Set<string>();
  const out: AlimentoDeCliente[] = [];

  for (const r of [...registros].sort((a, b) => b.fecha.localeCompare(a.fecha))) {
    for (const a of r.alimentosPropios ?? []) {
      const clave = a.nombre.trim().toLowerCase();
      if (!clave || yaEstan.has(clave) || vistos.has(clave)) continue;
      vistos.add(clave);
      out.push({
        alimento: a,
        quien: nombreDe.get(r.clientId)?.split(' ')[0] ?? 'Alguien',
        fecha: r.fecha,
      });
    }
  }
  return out;
}

/**
 * LO QUE APUNTAN ELLOS, REVISADO POR TI
 *
 * Cuando alguien copia la etiqueta de su yogur, ese alimento se queda suyo: no
 * entra en el catálogo por su cuenta, porque un dato mal copiado se llevaría
 * por delante los planes de todo el mundo.
 *
 * Pero casi siempre es un alimento que le sirve a más gente. Aquí se ven, con
 * sus números a la vista para comprobarlos de un golpe, y pasan al catálogo
 * cuando tú lo dices. Así el catálogo crece con lo que la gente come de verdad
 * sin dejar de ser tuyo.
 */
export function AlimentosDeClientes({ clients, registros, foods, onAnadir }: Props) {
  const [anadidos, setAnadidos] = useState<string[]>([]);
  const [omitidos, setOmitidos] = useState<string[]>(() => leerOmitidos());

  const suyos = useMemo(
    () => alimentosDeClientes(clients, registros, foods, omitidos),
    [clients, registros, foods, omitidos],
  );

  if (!suyos.length) return null;

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <h2 className="text-sm font-bold tracking-wide text-amber-900 uppercase">
        Alimentos que han apuntado tus clientes
      </h2>
      <p className="mt-1 text-xs leading-snug text-amber-900/80">
        Los han copiado de una etiqueta para poder contarlos. Comprueba los números y pásalos al
        catálogo si te sirven para más gente: mientras tanto sólo los ve quien los creó.
      </p>

      <ul className="mt-3 space-y-1.5">
        {suyos.map(({ alimento, quien, fecha }) => {
          const n = alimento.nutrientes;
          const puesto = anadidos.includes(alimento.id);
          return (
            <li
              key={alimento.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-800">{alimento.nombre}</span>
                <span className="tnum block text-[11px] text-slate-500">
                  Por 100 g: P {fmt(n?.proteina ?? 0, 1)} · HC {fmt(n?.hc ?? 0, 1)} · G{' '}
                  {fmt(n?.grasa ?? 0, 1)}
                  {n?.fibra ? ` · fibra ${fmt(n.fibra, 1)}` : ''}
                </span>
                <span className="block text-[10px] text-slate-400">
                  Lo apuntó {quien} el {fecha}
                </span>
              </span>

              {puesto ? (
                <span className="shrink-0 text-xs font-medium text-emerald-700">
                  En el catálogo ✓
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="outline"
                    onClick={() => {
                      onAnadir(alimento);
                      setAnadidos((v) => [...v, alimento.id]);
                    }}
                  >
                    Añadir al catálogo
                  </Button>
                  {/*
                    Descartar no toca el alimento: es de quien lo creó y lo
                    sigue usando. Sólo deja de proponerse aquí.
                  */}
                  <button
                    onClick={() => {
                      const nueva = omitir(omitidos, alimento.nombre);
                      guardarOmitidos(nueva);
                      setOmitidos(nueva);
                    }}
                    aria-label={`Descartar ${alimento.nombre}`}
                    title="No lo quiero en el catálogo"
                    className="rounded px-2 py-1 text-slate-300 transition hover:text-rose-600"
                  >
                    ×
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
