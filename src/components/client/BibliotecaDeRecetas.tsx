import { useState } from 'react';
import { fijosDeComida, pautaDeComida } from '../../utils/fijos';
import type { Alimento } from '../../types/food';
import type { DayType, Meal, Plan } from '../../types/plan';
import {
  acompanamientosDeReceta,
  ajustesDeReceta,
  anadidosDeReceta,
  comidasConPauta,
  quitadosDeReceta,
  recetasDeLaComida,
} from '../../types/plan';
import type { Receta } from '../../types/recipe';
import { scaleRecipe } from '../../utils/recipeScaling';
import { gramosPorIntercambio } from '../../utils/recipeComposition';
import { snapHalf } from '../../utils/macros';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import { ScaledRecipeView } from '../phase1/ScaledRecipeView';
import { Button } from '../common/ui';

interface Props {
  /** De dónde salen las recetas: son del plan, no del día. */
  plan: Plan;
  /** De dónde salen los gramos: eso sí es del día. */
  dayType: DayType;
  recipes: Receta[];
  foods: Alimento[];
  /**
   * MARCARLA DE UN TOQUE
   *
   * En fase 3 le fija las porciones de esa comida (`fijarAlimento`); en fase 4
   * le apunta los gramos. Sin esto la biblioteca sólo se mira, que también
   * vale — es lo que pasa en la vista previa y en el PDF.
   */
  /**
   * ELLA ELIGE EN QUÉ COMIDA
   *
   * `meal` es la que ha elegido, que no tiene que ser la comida bajo la que
   * está listada: su nutricionista le puso la tortilla en la cena y ella la
   * cenó el martes y la comió el jueves. `reparto` son los gramos de la ficha
   * que estaba leyendo — lo que cocinó —, y de ahí salen las porciones.
   */
  onUsar?: (meal: Meal, receta: Receta, reparto: Record<string, number>) => void;
  /** «Me lo he comido» sólo lo pulsa quien come, no quien pauta. */
  soyElCliente?: boolean;
}

/**
 * SU BIBLIOTECA DE RECETAS
 *
 * Hay quien quiere la autonomía de la fase 3 —componerse la comida con sus
 * porciones— y a la vez las ideas de la fase 1: saber que le tocan dos
 * almidones y un proteico no contesta la pregunta de «¿pero qué cocino?».
 *
 * Por eso esto es **una pestaña y no un trozo del día**: en su pantalla de hoy
 * lo que manda son sus porciones, y meter las recetas ahí volvería a decirle
 * qué comer, que es justo lo que esta fase deja atrás. Aquí se entra cuando no
 * se te ocurre nada, que es cuando hace falta.
 *
 * Las recetas son **las que ella le eligió** (`recetasAsignadas`), agrupadas
 * por comida y **con los gramos escalados a lo que le toca ese día**: la misma
 * receta en un día de entreno lleva más arroz, y una biblioteca con los gramos
 * del banco obligaría a echar la cuenta a mano cada vez.
 */
export function BibliotecaDeRecetas({
  plan,
  dayType,
  recipes,
  foods,
  onUsar,
  soyElCliente = false,
}: Props) {
  const [viendo, setViendo] = useState<string | null>(null);
  /** De qué comida es la receta abierta: la misma puede estar en dos. */
  const [deLaComida, setDeLaComida] = useState<string | null>(null);

  const porComida = comidasConPauta(dayType)
    .map((m) => ({
      meal: m,
      recetas: recetasDeLaComida(plan, m.id)
        .map((id) => recipes.find((r) => r.id === id))
        .filter(Boolean) as Receta[],
    }))
    .filter((x) => x.recetas.length > 0);

  if (!porComida.length) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
        <p className="text-sm font-medium text-slate-700">Aún no tienes recetas aquí</p>
        <p className="mt-1 text-xs leading-snug text-slate-500">
          Tu nutricionista te irá poniendo ideas para cada comida. Mientras tanto, tus
          porciones del día siguen en «Hoy».
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-snug text-slate-500">
        Ideas para cada comida, con los gramos ya ajustados a lo que te toca hoy. No tienes
        que comer esto: están aquí para cuando no se te ocurra qué hacer.
      </p>

      {porComida.map(({ meal, recetas }) => (
        <section key={meal.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold tracking-wide text-brand-800 uppercase">
              {meal.nombre}
            </h2>
            <span className="text-[11px] text-slate-400">
              {recetas.length} {recetas.length === 1 ? 'idea' : 'ideas'}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {recetas.map((r) => {
              const abierta = viendo === r.id && deLaComida === meal.id;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setViendo(abierta ? null : r.id);
                    setDeLaComida(abierta ? null : meal.id);
                  }}
                  aria-pressed={abierta}
                  className={`flex items-center gap-1.5 rounded-lg border py-1 pr-2.5 pl-1 text-xs transition ${
                    abierta
                      ? 'border-brand-400 bg-brand-50 text-brand-900'
                      : 'border-slate-200 text-slate-700 hover:border-brand-300'
                  }`}
                >
                  {/* La foto es como se reconoce una receta: antes que el nombre. */}
                  {r.foto_url ? (
                    <img
                      src={r.foto_url}
                      alt=""
                      loading="lazy"
                      className="h-7 w-7 rounded object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-7 w-7 items-center justify-center rounded bg-slate-100 text-[11px] text-slate-400"
                    >
                      🍽
                    </span>
                  )}
                  {r.nombre}
                </button>
              );
            })}
          </div>

          {recetas
            .filter((r) => r.id === viendo && deLaComida === meal.id)
            .map((r) => (
              <div key={r.id} className="mt-3">
                <ScaledRecipeView
                  receta={r}
                  recetas={recipes}
                  requeridos={pautaDeComida(dayType, meal.id, foods).pauta}
                  fijos={fijosDeComida(dayType, meal.id)}
                  foods={foods}
                  ajustes={ajustesDeReceta(dayType, meal.id, r.id)}
                  acompanamientos={acompanamientosDeReceta(dayType, meal.id, r.id)}
                  quitados={quitadosDeReceta(dayType, meal.id, r.id)}
                  anadidos={anadidosDeReceta(dayType, meal.id, r.id)}
                  soloLectura
                />

                {onUsar && soyElCliente && (
                  <MeLoHeComido
                    comidas={comidasConPauta(dayType)}
                    deEntrada={meal}
                    /*
                     * Los gramos son los de la ficha que acaba de leer, no los
                     * de la comida que elija: es lo que ha cocinado. Su
                     * nutricionista le puso la tortilla en la cena y ella la
                     * comió a mediodía — la tortilla es la misma.
                     */
                    onUsar={(elegida) =>
                      onUsar(elegida, r, pautaDeComida(dayType, meal.id, foods).pauta)
                    }
                  />
                )}
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}

/**
 * QUÉ PORCIONES GASTA UNA RECETA
 * ==============================
 * Las que de verdad lleva, calculadas de sus gramos ya escalados: los gramos
 * del ingrediente partidos por lo que pesa una porción de su grupo en la tabla
 * (`gramosPorIntercambio`). Es la misma cuenta que hace ella a mano.
 *
 * ANTES SE LEÍAN DE LA CASILLA DE LA COMIDA, Y ESTABA MAL DE TRES MANERAS
 * ======================================================================
 * Se le daba a **cada** ingrediente las porciones que esa comida tenía
 * pautadas de su grupo, y de ahí:
 *
 *  1. **Contaba doble.** Un desayuno con 3 almidones y una receta con avena y
 *     pan apuntaba 3 por la avena y 3 por el pan: 6 de 3.
 *  2. **Se perdía lo que la comida no pautaba.** El yogur de la receta no
 *     entraba si esa comida no tenía lácteo pautado, aunque se lo comiera.
 *  3. **Y si la comida no pautaba nada de lo que lleva la receta, no apuntaba
 *     NADA**: se pulsaba «me lo he comido» y no pasaba absolutamente nada. Es
 *     lo que ella veía — «no se están agregando a su plan».
 *
 * La receta sabe lo que lleva; la casilla sólo sabe lo que se pautó. Son dos
 * cosas distintas y la que manda aquí es la primera.
 *
 * Se redondea a medias porciones, que es el paso con el que se cuenta en esta
 * fase (§10.3) y con el que se mueven los anillos de la pantalla de hoy. Lo
 * ilimitado —la verdura— no se apunta: no gasta nada.
 */
export function aportesDeLaReceta(
  receta: Receta,
  reparto: Record<string, number>,
  foods: Alimento[],
): { foodId: string; intercambios: number }[] {
  const escalada = scaleRecipe(receta, reparto, foods);
  const porId = new Map(foods.map((f) => [f.id, f]));
  /* Por alimento y no por ingrediente: la misma avena dos veces se suma. */
  const porAlimento = new Map<string, number>();

  for (const ing of escalada.ingredientes) {
    if (!ing.foodId) continue;
    const food = porId.get(ing.foodId);
    if (!food?.grupo) continue;
    if (EXCHANGE_GROUPS[food.grupo]?.ilimitado) continue;

    const gpi = gramosPorIntercambio(food);
    const gramos = ing.cantidad_final ?? 0;
    if (!gpi || !(gramos > 0)) continue;

    porAlimento.set(food.id, (porAlimento.get(food.id) ?? 0) + gramos / gpi);
  }

  return [...porAlimento.entries()]
    .map(([foodId, n]) => ({ foodId, intercambios: snapHalf(n) }))
    .filter((a) => a.intercambios > 0);
}

/**
 * «ME LO HE COMIDO»: EN QUÉ COMIDA Y SI LAS CANTIDADES SON LAS SUYAS
 * =================================================================
 * Era un botón suelto que lo apuntaba en la comida bajo la que estaba
 * listada, y eso no es como se come: su nutricionista le pone la tortilla en
 * la cena y ella la cena el martes y la come el jueves. Así que **lo elige
 * ella**, que es además lo que pedía.
 *
 * Y se pregunta si usó las cantidades tal cual. No cambia la cuenta —las
 * porciones son las de la receta en las dos— pero sí lo que se le dice: si las
 * cambió, lo apuntado es un punto de partida y hay que decírselo, porque
 * callarlo sería darle por exacto un número que no lo es. Ajustarlo son los
 * mismos anillos de «Hoy» que ya usa.
 */
function MeLoHeComido({
  comidas,
  deEntrada,
  onUsar,
}: {
  comidas: Meal[];
  /** La comida bajo la que está listada: lo más probable, así que va elegida. */
  deEntrada: Meal;
  onUsar: (meal: Meal, talCual: boolean) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [elegida, setElegida] = useState(deEntrada.id);
  const [hecho, setHecho] = useState<string | null>(null);

  const meal = comidas.find((m) => m.id === elegida) ?? deEntrada;

  const apuntar = (talCual: boolean) => {
    onUsar(meal, talCual);
    setHecho(
      talCual
        ? `Apuntado en ${meal.nombre.toLowerCase()}.`
        : `Apuntado en ${meal.nombre.toLowerCase()} con las cantidades de la receta. Ajústalas en «Hoy».`,
    );
    setAbierto(false);
  };

  if (hecho) {
    return (
      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
        <p className="text-xs text-emerald-900">{hecho}</p>
        <button
          onClick={() => setHecho(null)}
          className="mt-0.5 text-[11px] text-emerald-700 underline"
        >
          Apuntarla otra vez
        </button>
      </div>
    );
  }

  if (!abierto) {
    return (
      <div className="mt-2">
        <Button onClick={() => setAbierto(true)} className="text-xs">
          Me lo he comido
        </Button>
        <p className="mt-1 text-[10px] leading-snug text-slate-400">
          Te descuenta sus porciones de la comida que elijas.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50/40 px-3 py-2.5">
      <p className="text-[11px] font-medium text-slate-600">¿En qué comida?</p>
      <div
        className="mt-1.5 flex flex-wrap gap-1.5"
        role="group"
        aria-label="En qué comida la apunto"
      >
        {comidas.map((m) => (
          <button
            key={m.id}
            onClick={() => setElegida(m.id)}
            aria-pressed={m.id === elegida}
            className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
              m.id === elegida
                ? 'border-brand-500 bg-brand-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-brand-400'
            }`}
          >
            {m.nombre}
          </button>
        ))}
      </div>

      <p className="mt-2.5 text-[11px] font-medium text-slate-600">
        ¿Has usado las cantidades tal cual?
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Button onClick={() => apuntar(true)} className="text-xs">
          Sí, tal cual
        </Button>
        <button
          onClick={() => apuntar(false)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-600 transition hover:border-brand-400"
        >
          Las cambié un poco
        </button>
        <button
          onClick={() => setAbierto(false)}
          className="px-1 text-[12px] text-slate-400 underline"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
