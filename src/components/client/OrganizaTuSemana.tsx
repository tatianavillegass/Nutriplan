import { useMemo, useState } from 'react';
import type { MenuSemana } from '../../types/diary';
import type { Alimento } from '../../types/food';
import type { DayType, Plan } from '../../types/plan';
import type { Receta } from '../../types/recipe';
import {
  comidasPuestas,
  diasConReceta,
  diasDeLaSemana,
  nombreDelDia,
  ponerEnDias,
  ponerTipoDeDia,
} from '../../utils/menuSemana';
import { listaDeLaCompra, SECCIONES } from '../../utils/listaCompra';
import { queCocinar, DIAS_QUE_AGUANTA } from '../../utils/batchCooking';
import { alternarComprado } from '../../utils/menuSemana';
import { fmt } from '../common/ui';

interface Props {
  menu: MenuSemana;
  plan: Plan;
  /** Las comidas del día y, para cada una, entre qué recetas puede elegir. */
  comidas: { meal: { id: string; nombre: string }; opciones: Receta[] }[];
  recetas: Receta[];
  foods: Alimento[];
  onCambiar: (menu: MenuSemana) => void;
}

const INICIALES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * ORGANIZA TU SEMANA
 *
 * En fase 1 y 2 la clienta elige cada día entre sus recetas, y eso hace
 * imposible la compra: nadie sabe qué va a comer el jueves hasta el jueves.
 * Aquí lo decide de una vez, y de ahí sale la lista.
 *
 * SE PIENSA POR RECETA, NO POR DÍA
 * ================================
 * Nadie planifica «lunes: pan con huevo; martes: avena; miércoles: pan con
 * huevo». Se piensa «pan con huevo, lunes y miércoles». Por eso se elige la
 * receta y se marcan los días, y no al revés: son siete pantallas menos.
 *
 * Y ES UNA PROPUESTA, NO UN CONTRATO
 * ==================================
 * Si el martes le apetece otra cosa, la cambia ese día y no pasa nada. Aquí no
 * hay ningún aviso de «no has cumplido tu menú»: eso convierte el plan en una
 * jaula y se deja de abrir a las dos semanas.
 */
export function OrganizaTuSemana({
  menu,
  plan,
  comidas,
  recetas,
  foods,
  onCambiar,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  /**
   * TRES COSAS, TRES PESTAÑAS
   *
   * El menú se toca el domingo, la lista en el supermercado y la cocina con el
   * delantal puesto. Todo junto en una columna obliga a bajar media pantalla
   * para encontrar lo que se necesita en ese momento.
   */
  const [pestana, setPestana] = useState<'menu' | 'compra' | 'cocina'>('menu');
  const dias = diasDeLaSemana(menu.inicio);
  const puestas = comidasPuestas(menu);

  const lista = useMemo(
    () => listaDeLaCompra(menu, plan, recetas, foods),
    [menu, plan, recetas, foods],
  );
  const pendientes = useMemo(
    () => lista.lineas.filter((l) => !(menu.comprados ?? []).includes(l.clave)).length,
    [lista, menu.comprados],
  );

  /** Qué poner al fuego, por ingrediente y partido por tandas. */
  const cocinar = useMemo(
    () => queCocinar(menu, plan, recetas, foods),
    [menu, plan, recetas, foods],
  );

  /** Los tipos de día que tenga su plan: entreno, descanso… */
  const tipos: DayType[] = plan.dayTypes ?? [];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="text-sm font-semibold text-slate-800">Organiza tu semana</span>
        {puestas > 0 && (
          <span className="tnum rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            {puestas}
          </span>
        )}
        <span className="ml-auto text-xs text-slate-400">{abierto ? 'Cerrar' : 'Abrir'}</span>
      </button>

      {abierto && (
        <>
          <p className="mt-1 text-xs leading-snug text-slate-500">
            Elige qué comes cada día y te hacemos la lista de la compra. Si un día te apetece otra
            cosa, la cambias y ya: esto es un plan, no una obligación.
          </p>

          <div className="mt-3 flex gap-1.5">
            {(
              [
                ['menu', 'Menú'],
                ['compra', `Compra${pendientes ? ` (${pendientes})` : ''}`],
                ['cocina', `Cocina${cocinar.length ? ` (${cocinar.length})` : ''}`],
              ] as const
            ).map(([id, texto]) => (
              <button
                key={id}
                onClick={() => setPestana(id)}
                aria-pressed={pestana === id}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  pestana === id
                    ? 'border-brand-500 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                }`}
              >
                {texto}
              </button>
            ))}
          </div>

          {/* ── Qué día es cada día ─────────────────────── */}
          {pestana === 'menu' && tipos.length > 1 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                Tus días
              </p>
              <div className="space-y-1">
                {dias.map((fecha) => {
                  const actual = menu.dias?.[fecha]?.dayTypeId ?? tipos[0].id;
                  return (
                    <div key={fecha} className="flex flex-wrap items-center gap-2">
                      <span className="w-20 shrink-0 text-xs text-slate-600">
                        {nombreDelDia(fecha)}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {tipos.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => onCambiar(ponerTipoDeDia(menu, fecha, t.id))}
                            className={`rounded-lg border px-2 py-0.5 text-[11px] transition ${
                              actual === t.id
                                ? 'border-brand-500 bg-brand-600 text-white'
                                : 'border-slate-200 text-slate-600 hover:border-brand-300'
                            }`}
                          >
                            {t.nombre}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">
                Las cantidades se ajustan solas: la misma receta lleva más comida el día que
                entrenas.
              </p>
            </div>
          )}

          {/* ── Qué comes, receta a receta ──────────────── */}
          {pestana === 'menu' &&
            comidas.map(({ meal, opciones }) => (
            <div key={meal.id} className="mt-4">
              <p className="mb-1.5 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                {meal.nombre}
              </p>
              <div className="space-y-1.5">
                {opciones.map((receta) => {
                  const puestos = diasConReceta(menu, meal.id, receta.id);
                  return (
                    <div
                      key={receta.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                        {receta.nombre}
                      </span>
                      <div className="flex gap-1">
                        {dias.map((fecha, i) => {
                          const puesto = puestos.includes(fecha);
                          const ocupada = menu.dias?.[fecha]?.comidas?.[meal.id];
                          const porOtra = !!ocupada && ocupada !== receta.id;
                          return (
                            <button
                              key={fecha}
                              onClick={() =>
                                onCambiar(
                                  ponerEnDias(
                                    menu,
                                    meal.id,
                                    receta.id,
                                    puesto
                                      ? puestos.filter((d) => d !== fecha)
                                      : [...puestos, fecha],
                                  ),
                                )
                              }
                              aria-label={`${receta.nombre} el ${nombreDelDia(fecha).toLowerCase()}`}
                              title={
                                porOtra
                                  ? 'Ese día ya tienes otra: al marcarlo, la cambias'
                                  : nombreDelDia(fecha)
                              }
                              className={`h-7 w-7 rounded-lg border text-[11px] transition ${
                                puesto
                                  ? 'border-brand-500 bg-brand-600 text-white'
                                  : porOtra
                                    ? 'border-slate-200 bg-white text-slate-300'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-400'
                              }`}
                            >
                              {INICIALES[i]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            ))}

          {/* ── Lo que hay que comprar ──────────────────── */}
          {pestana === 'compra' && lista.lineas.length === 0 && (
            <p className="mt-4 text-xs text-slate-500">
              Organiza algún día en «Menú» y aquí te sale la lista.
            </p>
          )}
          {pestana === 'compra' && lista.lineas.length > 0 && (
            <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-brand-900">Tu lista de la compra</p>
                <p className="tnum text-[11px] text-slate-600">
                  {pendientes} por comprar
                </p>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-600">
                Para las {lista.comidas} comidas que has organizado. Toca lo que vayas echando al
                carro.
              </p>

              {/*
                POR SECCIONES DEL SUPERMERCADO
                ==============================
                Ordenada por nombre obliga a dar cuatro vueltas: el aguacate al
                principio, el pollo en medio y el brócoli al final. Agrupada se
                recorre una vez.
              */}
              {SECCIONES.map((seccion) => {
                const suyas = lista.lineas.filter((l) => l.seccion === seccion);
                if (!suyas.length) return null;

                return (
                  <div key={seccion} className="mt-3">
                    <p className="mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                      {seccion}
                    </p>
                    <ul className="space-y-1">
                      {suyas.map((l) => {
                        const comprado = (menu.comprados ?? []).includes(l.clave);
                        return (
                          <li key={l.clave}>
                            <button
                              onClick={() => onCambiar(alternarComprado(menu, l.clave))}
                              aria-pressed={comprado}
                              className={`flex w-full items-baseline gap-2 rounded px-2 py-1.5 text-left text-sm transition ${
                                comprado ? 'bg-slate-100' : 'bg-white'
                              }`}
                            >
                              <span
                                aria-hidden
                                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                                  comprado
                                    ? 'border-brand-500 bg-brand-600 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {comprado ? '✓' : ''}
                              </span>
                              <span
                                className={`min-w-0 flex-1 ${
                                  comprado ? 'text-slate-400 line-through' : 'text-slate-700'
                                }`}
                              >
                                {l.nombre}
                                {l.sinEnlazar && !comprado && (
                                  <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-800">
                                    compruébalo
                                  </span>
                                )}
                              </span>
                              <span
                                className={`tnum shrink-0 text-xs font-medium ${
                                  comprado ? 'text-slate-400 line-through' : 'text-brand-800'
                                }`}
                              >
                                {l.alGusto
                                  ? `al gusto · ${l.veces} ${l.veces === 1 ? 'comida' : 'comidas'}`
                                  : l.piezas
                                    ? `${l.piezas} ${l.piezas === 1 ? 'ud' : 'uds'}`
                                    : `${fmt(l.cantidad, 0)} ${l.unidad}`}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}

              <p className="mt-2 text-[11px] leading-snug text-slate-500">
                Las cantidades son de lo que hay que comprar, no de lo que se sirve en el plato.
              </p>
            </div>
          )}

          {/* ── Lo que puedes cocinar de una vez ─────────── */}
          {pestana === 'cocina' && cocinar.length === 0 && (
            <p className="mt-4 text-xs leading-snug text-slate-500">
              Nada que adelantar por ahora. Aquí sale lo que se cocina y se guarda —arroz, pollo,
              legumbre, verduras al horno— cuando se repite en la semana.
            </p>
          )}
          {pestana === 'cocina' && cocinar.length > 0 && (
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">Cocina de una vez</p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                Lo cocinado aguanta unos {DIAS_QUE_AGUANTA} o 4 días en la nevera, así que va
                partido en tandas: cada una se hace el primer día que la necesitas.
              </p>

              <ul className="mt-2 space-y-2">
                {cocinar.map((c) => (
                  <li key={c.foodId ?? c.nombre} className="rounded-lg bg-white p-2">
                    <p className="flex flex-wrap items-baseline gap-1.5 text-sm text-slate-800">
                      <span className="font-medium">{c.nombre}</span>
                      <span className="tnum text-xs text-slate-500">
                        {c.veces} comidas · {fmt(c.total, 0)} {c.unidad}
                        {c.enCrudo ? ' en crudo' : ''}
                      </span>
                    </p>

                    <ul className="mt-1 space-y-1">
                      {c.tandas.map((t) => (
                        <li key={t.desde} className="text-xs text-slate-600">
                          <span className="font-medium text-brand-800">
                            {c.tandas.length > 1 ? `${nombreDelDia(t.desde)}: ` : ''}
                            cocina {t.piezas ? `${t.piezas} uds` : `${fmt(t.gramos, 0)} ${c.unidad}`}
                          </span>
                          <span className="text-slate-500">
                            {' '}
                            — {t.usos.map((u) => `${u.dia} (${u.receta})`).join(', ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </>
      )}
    </section>
  );
}
