import type { Fijo } from '../../types/plan';
import type { Alimento } from '../../types/food';
import { esUnidadMedible } from '../../types/food';
import { fijoSeElige } from '../../utils/fijos';
import { gramosPorIntercambio } from '../../utils/recipeComposition';
import { IngredientSwap } from '../phase1/IngredientSwap';
import { fmt } from '../common/ui';

interface Props {
  fijos: Fijo[];
  mealNombre: string;
  /** Hace falta para ofrecer equivalentes; sin él, el bloque sólo se lee. */
  foods?: Alimento[];
  /** Lo que ya ha cambiado hoy: fijoId → foodId. */
  cambios?: Record<string, string>;
  onCambiar?: (fijoId: string, foodId: string | undefined) => void;
  /** Qué alimentos se le pueden ofrecer. Ver `IngredientSwap`. */
  permitido?: (f: Alimento) => boolean;
}

/**
 * LO QUE VA CON ESTA COMIDA, COMA LO QUE COMA
 *
 * El café con leche del desayuno, el cuadrito de chocolate de después de
 * cenar. Su nutricionista lo pautó una vez para la comida entera, así que va
 * con cualquiera de las opciones y no hace falta que ella lo elija.
 *
 * SE DICE, NO SE MARCA
 * ====================
 * No lleva casilla de «hecho»: no es una comida aparte ni una tarea más del
 * día, es parte de ese desayuno — y sus intercambios ya están descontados de
 * lo que tienen que cubrir las opciones. Marcar la comida como hecha lo marca
 * también, porque es la misma comida.
 *
 * EL POSTRE SE DICE DISTINTO
 * ==========================
 * «Después» en vez de «con»: el chocolate de la cena no se come con la cena.
 * Es la misma pauta con los días marcados, pero leerlo como parte del plato
 * sería raro.
 */
export function LoFijoDeLaComida({
  fijos,
  mealNombre,
  foods,
  cambios,
  onCambiar,
  permitido,
}: Props) {
  if (!fijos.length) return null;

  const conLaComida = fijos.filter((f) => f.tipo !== 'postre');
  const despues = fijos.filter((f) => f.tipo === 'postre');

  const linea = (f: Fijo) => {
    const unidad = esUnidadMedible(f.unidad) ? f.unidad : 'g';
    /*
     * El fijo que ya viene cambiado trae el nombre y los gramos del alimento
     * nuevo (`fijosElegidos`), así que aquí no hay nada que resolver: se
     * pinta lo que se va a comer. Lo único que hace falta saber es de qué
     * alimento sale, para seguir ofreciendo la lista y poder volver atrás.
     */
    const alimento = f.foodId ? foods?.find((x) => x.id === f.foodId) : undefined;
    const gpi = alimento ? gramosPorIntercambio(alimento) : undefined;
    /* Sin grupo no hay con qué compararlo: un alimento suelto, sin tabla. */
    const grupo = alimento?.grupo;
    const puedeElegir =
      !!onCambiar && !!foods && !!alimento && !!gpi && !!grupo && fijoSeElige(f, foods);

    return (
      <span key={f.id} className="inline-flex flex-wrap items-baseline gap-1">
        <span className="font-medium">{f.nombre}</span>
        {f.gramos > 0 && (
          <span className="tnum text-slate-500">
            {fmt(f.gramos)} {unidad}
          </span>
        )}
        {puedeElegir && (
          <IngredientSwap
            ingrediente={{
              nombre: f.nombre,
              grupo: grupo,
              foodId: alimento.id,
            }}
            intercambios={(f.gramos || 0) / (gpi as number)}
            foods={foods}
            /*
              Lo elegido hoy, no `f.foodId`: el fijo que llega ya viene
              cambiado, y pasarle su propio alimento como «original» haría que
              la lista se ordenara por parecido a la pera en vez de a la
              manzana, y que no hubiera con qué volver atrás.
            */
            cambiadoPor={cambios?.[f.id]}
            onCambiar={(fid) => onCambiar(f.id, fid)}
            permitido={permitido}
          />
        )}
      </span>
    );
  };

  const bloque = (titulo: string, suyos: Fijo[]) => (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-slate-700">
      <span className="text-[10px] tracking-wide text-slate-400 uppercase">{titulo}</span>
      {suyos.map((f, i) => (
        <span key={f.id} className="flex items-baseline gap-2">
          {i > 0 && <span className="text-slate-300">·</span>}
          {linea(f)}
        </span>
      ))}
    </div>
  );

  return (
    <div
      className="mt-1.5 space-y-0.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
      aria-label={`Lo que va con ${mealNombre.toLowerCase()}`}
    >
      {conLaComida.length > 0 && bloque('Con esta comida', conLaComida)}
      {despues.length > 0 && bloque('Después', despues)}
      {/*
        Por qué no hay que contarlo aparte. Sin esta línea, quien lleva la
        cuenta de sus porciones se pregunta si el café va «encima» del plan.
      */}
      <p className="text-[10px] leading-snug text-slate-400">
        Ya está contado en lo que te toca en esta comida.
      </p>
    </div>
  );
}
