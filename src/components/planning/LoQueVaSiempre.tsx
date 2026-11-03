import type { Alimento } from '../../types/food';
import type { DayType, Fijo, Meal, TipoDeFijo } from '../../types/plan';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import type { ExchangeGroupId } from '../../data/exchangeGroups';
import { fijoSeElige, pautaDeComida, tipoDeFijo, TIPOS_DE_FIJO } from '../../utils/fijos';
import { gramosPorIntercambio } from '../../utils/recipeComposition';
import { FoodPicker } from '../food/FoodPicker';
import { uid } from '../../utils/storage';
import { useState } from 'react';
import { Card, Input, fmt } from '../common/ui';

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DIAS_LARGO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

interface Props {
  dayType: DayType;
  foods: Alimento[];
  onChange: (fijos: Record<string, Fijo[]>) => void;
}

/** «½ lácteo semi», para decir lo que se lleva. */
const enPorciones = (counts: Record<string, number | undefined>) =>
  (Object.entries(counts) as [ExchangeGroupId, number][])
    .filter(([, n]) => n > 0.001)
    .map(([g, n]) => `${fmt(n, n % 1 ? 1 : 0)} ${EXCHANGE_GROUPS[g].nombre.toLowerCase()}`)
    .join(' · ');

/**
 * LO QUE VA SIEMPRE CON CADA COMIDA
 *
 * El café con leche del desayuno, el matcha con bebida de coco, el cuadrito de
 * chocolate de después de cenar. Hasta ahora había que meterlo **opción por
 * opción**: cinco desayunos, cinco cafés — y cambiar la leche era volver a
 * entrar cinco veces.
 *
 * Aquí se pone una vez en la comida y va con todas sus opciones, elija la que
 * elija. Y **gasta de lo pautado de esa comida**: el café se lleva su medio
 * lácteo y a las opciones les queda el otro medio, igual que ya hacía el
 * aceite de cocción.
 *
 * EL POSTRE SON LOS MISMOS DÍAS
 * =============================
 * «Chocolate los martes y los viernes» es esto con unos días marcados. No es
 * otra pantalla ni otra cuenta: sin días marcados va siempre, con días va esos.
 *
 * LO QUE NO ESTÁ PAUTADO SE DICE
 * ==============================
 * Si le pone café con leche a un desayuno sin lácteo, la app no se lo quita a
 * otra comida por su cuenta —eso sería mover su pauta sin que lo vea— sino que
 * lo avisa aquí mismo y ella decide: subir la pauta o quitarlo de otro sitio.
 */
export function LoQueVaSiempre({ dayType, foods, onChange }: Props) {
  const fijos = dayType.fijos ?? {};

  const poner = (mealId: string, suyos: Fijo[]) =>
    onChange({ ...fijos, [mealId]: suyos });

  const anadir = (meal: Meal, f: Alimento) => {
    const gpi = gramosPorIntercambio(f);
    poner(meal.id, [
      ...(fijos[meal.id] ?? []),
      {
        id: uid('fj_'),
        foodId: f.id,
        nombre: f.nombre,
        /* Una porción de entrada: desde ahí se baja a la mitad si hace falta. */
        gramos: gpi ? Math.round(gpi) : f.gramos || 100,
        unidad: f.unidad ?? 'g',
      },
    ]);
  };

  /**
   * ALGO QUE NO ESTÁ EN EL CATÁLOGO
   *
   * La creatina, un multivitamínico, «una infusión». No tienen macros que
   * descontar y meterlos en el catálogo de alimentos para poder nombrarlos
   * sería ensuciarlo con cosas que no son comida. **Sin alimento detrás no
   * gasta nada**, que es la regla que ya tenían los fijos, y se dice en la
   * línea.
   *
   * Lo que sí gasta —un flan de proteína, un batido— se da de alta en el
   * catálogo con sus macros y se elige como cualquier otro: si no, su
   * proteína no saldría de ninguna cuenta.
   */
  const anadirLibre = (meal: Meal, nombre: string) => {
    const texto = nombre.trim();
    if (!texto) return;
    poner(meal.id, [
      ...(fijos[meal.id] ?? []),
      { id: uid('fj_'), nombre: texto, gramos: 0, tipo: 'suplemento' },
    ]);
  };

  const cambiar = (mealId: string, id: string, patch: Partial<Fijo>) =>
    poner(
      mealId,
      (fijos[mealId] ?? []).map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );

  const quitar = (mealId: string, id: string) =>
    poner(
      mealId,
      (fijos[mealId] ?? []).filter((f) => f.id !== id),
    );

  const alternarDia = (mealId: string, f: Fijo, dia: number) => {
    const dias = f.dias ?? [];
    const nuevos = dias.includes(dia) ? dias.filter((d) => d !== dia) : [...dias, dia].sort();
    /* Todos marcados es lo mismo que ninguno: va siempre, y se dice así. */
    cambiar(mealId, f.id, { dias: nuevos.length === 7 ? undefined : nuevos });
  };

  return (
    <Card
      title="Lo que va siempre"
      subtitle="El café con leche, el postre… va con todas las opciones de esa comida y gasta de lo pautado. La fruta y la verdura las puede cambiar ella"
    >
      <div className="space-y-4">
        {dayType.meals.map((meal) => {
          const suyos = fijos[meal.id] ?? [];
          const p = pautaDeComida(dayType, meal.id, foods);

          return (
            <div key={meal.id}>
              <p className="mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                {meal.nombre}
              </p>

              {suyos.length > 0 && (
                <ul className="mb-1.5 space-y-1.5">
                  {suyos.map((f) => {
                    const gasta = enPorciones(
                      pautaDeComida(
                        { fijos: { [meal.id]: [f] }, grid: dayType.grid },
                        meal.id,
                        foods,
                      ).gastado,
                    );
                    const siempre = !f.dias?.length;
                    return (
                      <li
                        key={f.id}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                            {f.nombre}
                          </span>
                          <Input
                            type="number"
                            min="0"
                            value={f.gramos}
                            onChange={(e) =>
                              cambiar(meal.id, f.id, { gramos: Number(e.target.value) || 0 })
                            }
                            aria-label={`Cantidad de ${f.nombre}`}
                            className="w-20 text-sm"
                          />
                          <span className="w-6 text-[11px] text-slate-400">
                            {f.unidad ?? 'g'}
                          </span>
                          <button
                            onClick={() => quitar(meal.id, f.id)}
                            aria-label={`Quitar ${f.nombre}`}
                            className="text-slate-300 transition hover:text-rose-600"
                          >
                            ×
                          </button>
                        </div>

                        {/*
                          DE QUÉ ES
                          El café con leche va con el desayuno, el yogur con
                          frutos rojos después de la cena, la ensalada al lado y
                          la creatina no es comida. Los cuatro se pautan y
                          gastan igual: lo único que cambia es cómo se lo lee
                          ella. Sin esto, un flan de proteína de postre salía en
                          la línea de «con esta comida» y parecía parte del
                          plato.
                        */}
                        <div
                          className="mt-1 flex flex-wrap gap-1"
                          role="group"
                          aria-label={`De qué es ${f.nombre}`}
                        >
                          {TIPOS_DE_FIJO.map((t) => {
                            const on = tipoDeFijo(f) === t.id;
                            return (
                              <button
                                key={t.id}
                                onClick={() =>
                                  cambiar(meal.id, f.id, { tipo: t.id as TipoDeFijo })
                                }
                                aria-pressed={on}
                                className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                                  on
                                    ? 'border-brand-500 bg-brand-600 text-white'
                                    : 'border-slate-200 bg-white text-slate-500 hover:border-brand-400'
                                }`}
                              >
                                {t.etiqueta}
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {/*
                            SIN DÍAS MARCADOS VA TODOS
                            Es lo que hace que el postre no sea otra pantalla:
                            el café no marca ninguno y el chocolate marca dos.
                          */}
                          <span className="flex gap-1">
                            {DIAS.map((d, i) => {
                              const on = siempre || f.dias!.includes(i);
                              return (
                                <button
                                  key={i}
                                  onClick={() => alternarDia(meal.id, f, i)}
                                  aria-pressed={on}
                                  aria-label={`${f.nombre} el ${DIAS_LARGO[i]}`}
                                  className={`h-6 w-6 rounded border text-[10px] transition ${
                                    on
                                      ? 'border-brand-500 bg-brand-600 text-white'
                                      : 'border-slate-200 bg-white text-slate-400 hover:border-brand-400'
                                  }`}
                                >
                                  {d}
                                </button>
                              );
                            })}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {siempre ? 'todos los días' : `${f.dias!.length} días`}
                          </span>
                          {gasta && (
                            <span className="ml-auto text-[11px] text-slate-500">
                              se lleva {gasta}
                            </span>
                          )}
                          {!f.foodId && (
                            <span className="ml-auto text-[11px] text-slate-400">
                              sin alimento: no gasta nada
                            </span>
                          )}
                        </div>

                        {/*
                          QUIÉN ELIGE ESTE ALIMENTO
                          «La manzana del postre es sólo un reflejo de que de
                          postre tiene una porción de fruta: puede elegir la que
                          quiera.» La fruta y la verdura se abren solas —es la
                          misma regla de la despensa y de las combinaciones— y
                          el resto no, porque una leche concreta o un batido
                          concreto pueden ser la pauta y no un ejemplo. Esto es
                          para decirlo cuando el reflejo no coincide con el
                          subgrupo.
                        */}
                        {f.foodId && (
                          <label className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                            <input
                              type="checkbox"
                              checked={fijoSeElige(f, foods)}
                              onChange={(e) =>
                                cambiar(meal.id, f.id, { abierto: e.target.checked })
                              }
                              className="h-3 w-3 rounded border-slate-300"
                            />
                            Puede cambiarlo por otro equivalente
                          </label>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <FoodPicker
                foods={foods}
                placeholder={`Añadir algo fijo a ${meal.nombre.toLowerCase()}…`}
                limpiarTrasElegir
                onSelect={(f) => anadir(meal, f)}
              />

              {/*
                Y LO QUE NO ES COMIDA SE ESCRIBE
                ================================
                La creatina, un multivitamínico, «una infusión». No tienen
                macros que descontar, y darlos de alta en el catálogo de
                alimentos para poder nombrarlos sería ensuciarlo con cosas que
                no se comen. Entra sin alimento detrás, así que **no gasta
                nada** —la regla que ya tenían los fijos— y la línea lo dice.

                Va aparte del buscador y con su botón a propósito: el buscador
                avisa en cada tecla, así que engancharlo ahí daría de alta un
                fijo por letra escrita.
              */}
              <EscribirLibre meal={meal} onAnadir={anadirLibre} />

              {/*
                LO QUE NO ESTÁ PAUTADO, EN ÁMBAR Y SIN ARREGLARLO SOLO
                Quitárselo a otra comida sería mover su pauta sin que lo vea.
              */}
              {Object.keys(p.sinPautar).length > 0 && (
                <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] leading-snug text-amber-800">
                  Aquí no tienes pautado {enPorciones(p.sinPautar)}. Súbelo en el reparto o
                  quítaselo a otra comida: así como está, el día se pasa de lo pautado.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** «Creatina» escrito a mano: lo que no es comida y no tiene macros. */
function EscribirLibre({
  meal,
  onAnadir,
}: {
  meal: Meal;
  onAnadir: (meal: Meal, nombre: string) => void;
}) {
  const [texto, setTexto] = useState('');

  const guardar = () => {
    if (!texto.trim()) return;
    onAnadir(meal, texto);
    setTexto('');
  };

  return (
    <div className="mt-1.5 flex gap-1.5">
      <Input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            guardar();
          }
        }}
        placeholder="…o algo que no esté en el catálogo: creatina, una infusión"
        aria-label={`Añadir algo que no está en el catálogo a ${meal.nombre.toLowerCase()}`}
        className="flex-1 text-sm"
      />
      <button
        onClick={guardar}
        disabled={!texto.trim()}
        className="rounded-lg border border-slate-200 px-2.5 text-[12px] text-slate-600 transition hover:border-brand-400 disabled:opacity-40"
      >
        Añadir
      </button>
    </div>
  );
}
