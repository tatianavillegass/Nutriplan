import { useMemo, useRef, useState } from 'react';
import type { Receta } from '../../types/recipe';
import type { Meal, DayType } from '../../types/plan';
import {
  RECETAS_POR_COMIDA,
  ajustesDeReceta,
  acompanamientosDeReceta,
  quitadosDeReceta,
  type Acompanamiento,
} from '../../types/plan';
import type { Client } from '../../types/client';
import type { Alimento, MealSlot } from '../../types/food';
import { matchRecipes } from '../../utils/recipeMatcher';
import { porQueCoincide, recetaCoincide } from '../../utils/buscarRecetas';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import { ScaledRecipeView } from './ScaledRecipeView';
import { RecipeQuickEditor } from './RecipeQuickEditor';
import { AjustarCantidades } from './AjustarCantidades';
import { Badge, Button, EmptyState, Input } from '../common/ui';
import { RecipeCard } from '../recipes/RecipeCard';

interface Props {
  dayType: DayType;
  meal: Meal;
  recetas: Receta[];
  client: Client;
  /** Recetas ya elegidas para esta comida. */
  seleccionadas: string[];
  /** Recetas usadas en otras comidas, para dar variedad. */
  yaAsignadas: string[];
  onToggle: (recetaId: string) => void;
  /**
   * PLEGADA, SALVO LA QUE SE ESTÁ TRABAJANDO
   *
   * Con todas las recetas en cuadrícula, cinco comidas abiertas son cinco
   * pantallas de fotos: elegir el desayuno y bajar a la cena era un viaje, y
   * volver arriba otro. Se abre una, se eligen sus opciones y se cierra.
   *
   * Sin estas props se comporta como antes —siempre abierta—, que es como la
   * usan los tests y cualquier pantalla que sólo tenga una comida.
   */
  abierto?: boolean;
  onAlternar?: () => void;
  /** Cerrar ésta y abrir la siguiente, que es lo que se hace de verdad. */
  onSiguiente?: () => void;
  foods?: Alimento[];
  /** Guardar cambios en la receta del banco. */
  onEditarReceta?: (recetaId: string, patch: Partial<Receta>) => void;
  /** Guardar los gramos ajustados a mano, sólo para esta clienta. */
  onAjustarCantidades?: (
    recetaId: string,
    ajustes: Record<string, number>,
    acompanamientos: Acompanamiento[],
    /** Ingredientes que esta clienta no se come. */
    quitados: string[],
  ) => void;
}

const SLOTS: { id: MealSlot; nombre: string }[] = [
  { id: 'desayuno', nombre: 'Desayuno' },
  { id: 'almuerzo', nombre: 'Almuerzo' },
  { id: 'comida', nombre: 'Comida' },
  { id: 'merienda', nombre: 'Merienda' },
  { id: 'cena', nombre: 'Cena' },
  { id: 'extra', nombre: 'Extra' },
];

/** De doce en doce: lo que cabe en una pantalla sin que tarde en pintarse. */
const PASO = 12;

/** Cuántas recetas del banco llevan cada tag, para no ofrecer filtros vacíos. */
function tagsDisponibles(recetas: Receta[]): string[] {
  const cuenta = new Map<string, number>();
  for (const r of recetas) {
    for (const t of r.tags) {
      const limpio = t.trim();
      if (limpio) cuenta.set(limpio, (cuenta.get(limpio) ?? 0) + 1);
    }
  }
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t);
}

/**
 * FASE 1 — la nutricionista elige varias recetas por comida (3 por defecto)
 * y el cliente escoge entre ellas cada día.
 *
 * El recomendador ordena por lo que cuadra con el reparto, pero con el banco
 * ya grande hacía falta poder acotar a mano: enseñar sólo las de desayuno, o
 * sólo las dulces, o sólo las que llevan huevo.
 */
export function RecipeRecommender({
  dayType,
  meal,
  recetas,
  client,
  seleccionadas,
  yaAsignadas,
  onToggle,
  abierto = true,
  onAlternar,
  onSiguiente,
  foods = [],
  onEditarReceta,
  onAjustarCantidades,
}: Props) {
  const [editando, setEditando] = useState<string | null>(null);
  /**
   * Al cerrar se vuelve a su cabecera. Sin esto te quedas donde estabas —a
   * media pantalla de fotos que acaba de desaparecer— y hay que buscar dónde
   * estás: justo el viaje que esto viene a quitar.
   */
  const caja = useRef<HTMLDivElement>(null);
  const volverArriba = () =>
    /* El `typeof` es por los tests: jsdom no implementa scrollIntoView y sin
       esto cerrar una comida reventaba con un error suelto en la consola. */
    typeof caja.current?.scrollIntoView === 'function' &&
    caja.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  /** Receta cuyas cantidades se están ajustando para esta clienta. */
  const [ajustando, setAjustando] = useState<string | null>(null);
  /**
   * De entrada, el tipo de comida que toca aquí: en el desayuno se enseñan
   * recetas de desayuno. Antes la categoría sólo sumaba puntos, así que un
   * plato de comida cuyo perfil de grupos encajara bien con el reparto del
   * desayuno se colaba por delante de los desayunos de verdad.
   *
   * `'todas'` es la vía de escape, para cuando una receta se esconde porque
   * se le olvidó ponerle la categoría.
   */
  const [slot, setSlot] = useState<MealSlot | 'todas'>(meal.slot);
  const [tags, setTags] = useState<string[]>([]);
  /** Ir a por una receta concreta, esté donde esté en la puntuación. */
  const [busqueda, setBusqueda] = useState('');
  /**
   * CUÁNTAS SE ENSEÑAN DE GOLPE
   *
   * Antes eran ocho y punto: el resto del banco no existía desde aquí. Ahora
   * están todas y se van pidiendo de doce en doce — que con foto es lo que
   * entra en una pantalla sin que tarde en pintarse. Es el mismo gesto de
   * cualquier tienda: bajas y sigue habiendo.
   */
  const [cuantas, setCuantas] = useState(PASO);
  const reparto = dayType.grid[meal.id] ?? {};

  const todosLosTags = useMemo(() => tagsDisponibles(recetas), [recetas]);

  /**
   * Los acompañamientos van al lado del plato y los postres son otra cosa:
   * ninguno de los dos es «la cena». El filtro de tags es un Y: «dulce» +
   * «huevos» son las que llevan ambos.
   */
  const delBanco = useMemo(
    () =>
      recetas.filter(
        (r) => !r.acompanamiento && !r.postre && tags.every((t) => r.tags.includes(t)),
      ),
    [recetas, tags],
  );

  const candidatas = useMemo(
    () => delBanco.filter((r) => slot === 'todas' || r.categorias.includes(slot)),
    [delBanco, slot],
  );

  /**
   * BUSCAR POR NOMBRE O POR INGREDIENTE
   *
   * Al pautar la pregunta casi nunca es «¿cómo se llamaba?» sino «¿qué tengo
   * con salmón?»: se busca una idea para esta persona, no un plato concreto.
   * Buscando se salta también el filtro de comida — si la escribes, la quieres,
   * esté donde esté.
   */
  const buscando = busqueda.trim().length >= 2;

  /**
   * UNA SOLA LISTA, CON TODO, ORDENADA POR LO QUE MEJOR CUADRA
   *
   * Antes eran dos: ocho tarjetas recomendadas y, si buscabas, una lista de
   * nombres sin foto. Eso obligaba a elegir a ciegas en cuanto lo que querías
   * no estaba entre las ocho — y con doscientas recetas en el banco, eso es
   * casi siempre.
   *
   * Ahora están **todas**, en tarjetas con su foto y ordenadas por lo que
   * cubre del reparto. Las primeras son las que la app propondría; a partir de
   * ahí se sigue bajando, que es lo que hace falta cuando ya sabes lo que
   * buscas y sólo quieres verlo.
   *
   * Las bloqueadas por una alergia o una patología salen al final, en gris y
   * con el motivo: esconderlas sin explicación es lo que hacía parecer que
   * faltaban del banco.
   */
  const todas = useMemo(
    () =>
      matchRecipes(
        /* Buscando se mira el banco entero, no sólo lo de esta comida. */
        buscando ? delBanco.filter((r) => recetaCoincide(r, busqueda, foods)) : candidatas,
        reparto,
        {
          /* Buscando no se filtra por comida: la quieres esté donde esté. */
          slot: buscando ? 'todas' : slot,
          preferencias: client.preferencias,
          yaAsignadas,
          limite: Number.POSITIVE_INFINITY,
          client,
          foods,
          incluirBloqueadas: true,
        },
      ),
    [candidatas, delBanco, reparto, slot, client, foods, yaAsignadas, buscando, busqueda],
  );

  const bloqueadas = useMemo(() => todas.filter((r) => r.bloqueada), [todas]);

  /** Lo pintado ahora mismo. El resto está a un botón. */
  const visibles = todas.slice(0, cuantas);
  const hayMas = todas.length > visibles.length;

  const filtrando = slot !== meal.slot || tags.length > 0;
  const alternarTag = (t: string) =>
    setTags((v) => (v.includes(t) ? v.filter((x) => x !== t) : [...v, t]));

  /** Cuántas se están escondiendo por no ser de este tipo de comida. */
  const ocultasPorSlot =
    slot === 'todas'
      ? 0
      : /* Sobre las que se podrían elegir: los acompañamientos y los postres
           nunca son «la cena», así que ofrecerlos sería mentir en la cuenta. */
        delBanco.filter((r) => !r.categorias.includes(slot)).length;

  const elegidas = seleccionadas
    .map((id) => recetas.find((r) => r.id === id))
    .filter(Boolean) as Receta[];

  const vacio = Object.values(reparto).every((v) => !v);
  if (vacio) {
    return (
      <EmptyState title={`${meal.nombre} sin intercambios`}>
        Reparte intercambios en la grilla para recibir recomendaciones.
      </EmptyState>
    );
  }

  /** El resumen del reparto, que se enseña abierta y cerrada. */
  const loPautado = (Object.entries(reparto) as [keyof typeof EXCHANGE_GROUPS, number][])
    .filter(([, n]) => n > 0)
    .map(([g, n]) => `${n} ${EXCHANGE_GROUPS[g].nombre.toLowerCase()}`)
    .join(' · ');

  /**
   * EL REPERTORIO CRECE, NO SE SUSTITUYE
   *
   * Antes había un tope de tres y para meter una cuarta receta había que quitar
   * otra. Eso convertía cada seguimiento en un cambio de plan: la clienta
   * perdía el desayuno que ya se sabía de memoria justo cuando lo tenía
   * cogido. Ahora tres es lo mínimo recomendable para arrancar y a partir de
   * ahí se suma — que es lo que hace que se note el paso del tiempo.
   */
  const minimoPuesto = elegidas.length >= RECETAS_POR_COMIDA;

  const cabecera = (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div className="flex items-baseline gap-2">
        {onAlternar && (
          <span aria-hidden className="text-[10px] text-slate-400">
            {abierto ? '▾' : '▸'}
          </span>
        )}
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {meal.nombre}
        </p>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] ${
            minimoPuesto
              ? 'bg-emerald-50 text-emerald-700'
              : elegidas.length > 0
                ? 'bg-amber-50 text-amber-700'
                : 'bg-slate-100 text-slate-500'
          }`}
        >
          {elegidas.length} {elegidas.length === 1 ? 'opción' : 'opciones'}
          {!minimoPuesto && ` · mínimo ${RECETAS_POR_COMIDA}`}
        </span>
      </div>
      <p className="tnum text-[11px] text-slate-400">{loPautado}</p>
    </div>
  );

  /**
   * CERRADA: EL NOMBRE, LA CUENTA Y LO QUE YA LE PUSISTE
   *
   * Una fila plegada que sólo dijera «Desayuno» obligaría a abrirla para
   * acordarse de qué le habías puesto. Con las miniaturas se repasa el plan
   * entero de un vistazo, que es justo lo que no se podía hacer con cinco
   * cuadrículas abiertas.
   */
  if (onAlternar && !abierto) {
    return (
      <div ref={caja} className="rounded-xl border border-slate-200 bg-white">
        <button onClick={onAlternar} className="w-full px-4 py-3 text-left">
          {cabecera}
          {elegidas.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {elegidas.map((r) => (
                <span
                  key={r.id}
                  title={r.nombre}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-0.5 pr-2 pl-0.5 text-[11px] text-slate-600"
                >
                  {r.foto_url ? (
                    <img
                      src={r.foto_url}
                      alt=""
                      loading="lazy"
                      className="h-6 w-6 rounded object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 text-[10px] text-slate-400"
                    >
                      🍽
                    </span>
                  )}
                  <span className="max-w-[10rem] truncate">{r.nombre}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] text-amber-700">
              Sin recetas todavía. Pulsa para elegirlas.
            </p>
          )}
        </button>
      </div>
    );
  }

  return (
    <div ref={caja} className="rounded-xl border border-slate-200 bg-white p-4">
      {onAlternar ? (
        <button
          onClick={() => {
            onAlternar();
            volverArriba();
          }}
          className="mb-3 w-full text-left"
        >
          {cabecera}
        </button>
      ) : (
        <div className="mb-3">{cabecera}</div>
      )}

      {/* ── Filtros: tipo de comida y tags ───────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2">
        <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
          Tipo de comida
          <select
            value={slot}
            onChange={(e) => setSlot(e.target.value as MealSlot | 'todas')}
            className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 outline-none focus:border-brand-400"
          >
            {SLOTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
            <option value="todas">Todas ({recetas.length})</option>
          </select>
        </label>

        {todosLosTags.length > 0 && <span className="mx-1 h-4 w-px bg-slate-200" />}

        <div className="flex flex-wrap items-center gap-1">
          {todosLosTags.map((t) => {
            const activo = tags.includes(t);
            return (
              <button
                key={t}
                onClick={() => alternarTag(t)}
                aria-pressed={activo}
                className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                  activo
                    ? 'border-brand-500 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300'
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>

        {filtrando && (
          <button
            onClick={() => {
              setSlot(meal.slot);
              setTags([]);
            }}
            className="ml-auto text-[10px] text-slate-400 underline hover:text-slate-600"
          >
            Quitar filtros
          </button>
        )}
      </div>

      {/* ── Buscar por nombre o por ingrediente ───────────── */}
      <div className="mb-3">
        <Input
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            /* Al cambiar la búsqueda se vuelve arriba: si no, una búsqueda
               con tres resultados heredaría el «ver más» de la anterior. */
            setCuantas(PASO);
          }}
          placeholder="Busca por nombre o por ingrediente: salmón, avena, huevo…"
          className="w-full text-sm"
        />
        {buscando && (
          <p className="mt-1 text-[11px] text-slate-500">
            {visibles.length === 0
              ? 'Nada en el banco con eso, ni en el nombre ni en los ingredientes.'
              : `${todas.length} ${todas.length === 1 ? 'receta' : 'recetas'} en todo el banco, sin filtrar por comida.`}
          </p>
        )}
      </div>

      {/* ── Todas, con foto y ordenadas por lo que mejor cuadra ── */}
      <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibles.map((s) => {
          const activa = seleccionadas.includes(s.receta.id);
          const porQue = buscando ? porQueCoincide(s.receta, busqueda, foods) : undefined;
          return (
            <RecipeCard
              key={s.receta.id}
              receta={s.receta}
              seleccionada={activa}
              bloqueada={s.bloqueada}
              onClick={() => onToggle(s.receta.id)}
              esquina={
                s.faltantes.length === 0 && s.sobrantes.length === 0 ? (
                  <Badge tone="brand">exacta</Badge>
                ) : undefined
              }
              pie={
                <>
                  {/*
                    Qué cubre y qué falta, no un porcentaje: un 96 % no dice si
                    lo que falla es la proteína o el hidrato, y con eso no se
                    decide nada. Con «falta grasa» ya sabes que le pones un
                    yogur al lado.
                  */}
                  {s.bloqueada ? (
                    <span className="block text-[10px] leading-snug text-red-600">
                      {s.motivosBloqueo?.join(' · ')}
                    </span>
                  ) : (
                    <span
                      className={`block text-[10px] leading-snug ${
                        s.faltantes.length ? 'text-amber-600' : 'text-emerald-700'
                      }`}
                    >
                      Cubre {s.cubiertos} de {s.requeridos}
                      {!!s.faltantes.length && (
                        <>
                          {' · falta '}
                          {s.faltantes
                            .map((g) => EXCHANGE_GROUPS[g].nombre.toLowerCase())
                            .join(', ')}
                        </>
                      )}
                    </span>
                  )}
                  {porQue && (
                    <span className="block text-[10px] text-slate-400">{porQue}</span>
                  )}
                </>
              }
            />
          );
        })}
      </div>

      {!todas.length && (
        <EmptyState title={buscando ? 'Sin resultados' : 'Sin recetas para esta comida'}>
          {buscando ? (
            <p>Prueba con el nombre de un ingrediente: salmón, avena, garbanzo.</p>
          ) : slot !== 'todas' && ocultasPorSlot > 0 ? (
            <p>
              No hay recetas de {SLOTS.find((s) => s.id === slot)?.nombre.toLowerCase()} en el
              banco. Pon «Todas» en el tipo de comida para ver el resto.
            </p>
          ) : tags.length > 0 ? (
            <p>Con estos tags no queda ninguna.</p>
          ) : (
            'Añade recetas al banco para poder asignarlas.'
          )}
        </EmptyState>
      )}

      {/*
        VER MÁS, QUE NO ES LO MISMO QUE VER OTRAS
        Aquí sigue estando el banco entero de esta comida: sólo se han pintado
        las primeras. El botón de abajo es el que cruza a las otras comidas, y
        por eso son dos botones y no uno.
      */}
      {hayMas && (
        <button
          onClick={() => setCuantas((n) => n + PASO)}
          className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
        >
          Ver más recetas
          <span className="tnum ml-1 text-slate-400">
            ({visibles.length} de {todas.length})
          </span>
        </button>
      )}

      {minimoPuesto && (
        <p className="mt-2 text-[11px] text-slate-400">
          Puedes seguir añadiendo: en cada seguimiento, sumar una o dos hace que su repertorio
          crezca sin quitarle lo que ya se sabe.
        </p>
      )}

      {/*
        Las bloqueadas ya salen en la cuadrícula, en gris y con su motivo. Este
        resumen sigue porque con treinta tarjetas en pantalla una en gris se
        pasa por alto, y lo que hay que saber es *cuántas* se están perdiendo
        por lo que no puede tomar.
      */}
      {bloqueadas.length > 0 && (
        <p className="mt-2 text-[11px] text-slate-400">
          {bloqueadas.length}{' '}
          {bloqueadas.length === 1 ? 'receta está descartada' : 'recetas están descartadas'} por lo
          que {client.nombre.split(' ')[0]} no puede tomar; salen en gris y no se pueden elegir.
        </p>
      )}

      {!buscando && slot !== 'todas' && ocultasPorSlot > 0 && (
        <p className="mt-1 text-[11px] text-slate-400">
          Sólo se enseñan recetas de{' '}
          {SLOTS.find((s) => s.id === slot)?.nombre.toLowerCase()}.{' '}
          <button onClick={() => setSlot('todas')} className="underline hover:text-slate-600">
            Ver también las de otras comidas ({ocultasPorSlot})
          </button>
        </p>
      )}

      {elegidas.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-[11px] font-medium text-slate-500">
            Así las verá el cliente, con los gramajes ya escalados
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {elegidas.map((r) =>
              editando === r.id && onEditarReceta ? (
                <div key={r.id} className="lg:col-span-2">
                  <RecipeQuickEditor
                    receta={r}
                    foods={foods}
                    requeridos={reparto}
                    onCerrar={() => setEditando(null)}
                    onGuardar={(patch) => {
                      onEditarReceta(r.id, patch);
                      setEditando(null);
                    }}
                  />
                </div>
              ) : (
                <div key={r.id}>
                  {ajustando === r.id && onAjustarCantidades ? (
                    <AjustarCantidades
                      receta={r}
                      requeridos={reparto}
                      foods={foods}
                      ajustes={ajustesDeReceta(dayType, meal.id, r.id)}
                      acompanamientos={acompanamientosDeReceta(dayType, meal.id, r.id)}
                      quitados={quitadosDeReceta(dayType, meal.id, r.id)}
                      recetas={recetas}
                      onGuardar={(a, ac, q) => {
                        onAjustarCantidades(r.id, a, ac, q);
                        setAjustando(null);
                      }}
                      onCerrar={() => setAjustando(null)}
                    />
                  ) : (
                    <ScaledRecipeView
                          recetas={recetas}
                      receta={r}
                      requeridos={reparto}
                      foods={foods}
                      ajustes={ajustesDeReceta(dayType, meal.id, r.id)}
                      acompanamientos={acompanamientosDeReceta(dayType, meal.id, r.id)}
                      quitados={quitadosDeReceta(dayType, meal.id, r.id)}
                      paraNutricionista
                      acciones={
                        <>
                          {onAjustarCantidades && (
                            <Button variant="outline" onClick={() => setAjustando(r.id)}>
                              Ajustar cantidades
                            </Button>
                          )}
                          {onEditarReceta && (
                            <Button variant="outline" onClick={() => setEditando(r.id)}>
                              Editar receta
                            </Button>
                          )}
                        </>
                      }
                    />
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {/*
        CERRAR SIN TENER QUE SUBIR
        Después de elegir las recetas estás abajo del todo, y volver a la
        cabecera para plegarla es el viaje que esto viene a quitar. «Siguiente
        comida» es lo que se hace de verdad: cierra ésta y abre la de abajo.
      */}
      {onAlternar && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            onClick={() => {
              onAlternar();
              volverArriba();
            }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300"
          >
            Cerrar {meal.nombre.toLowerCase()}
          </button>
          {onSiguiente && (
            <button
              onClick={onSiguiente}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700"
            >
              Siguiente comida →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
