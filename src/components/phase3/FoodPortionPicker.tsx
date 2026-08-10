import { useMemo, useState } from 'react';
import type { Alimento } from '../../types/food';
import type { DayType, Meal } from '../../types/plan';
import type { PorcionesMarcadas } from '../../types/diary';
import { EXCHANGE_GROUPS, type MacroBucket, type ExchangeGroupId } from '../../data/exchangeGroups';
import { alimentosDeBucket, notaAceite, repartoElegible } from '../../utils/pantry';
import { balanceComida, balanceGrasa, balanceSubgruposDeBucket } from '../../utils/dailyBudget';
import { seleccionPorBucket, seleccionPorGrupo } from '../../utils/marcado';
import { BUCKET_LABEL } from '../../utils/mealOptions';
import { gramosMarcados } from '../../utils/diary';
import { escalarMedida } from '../../utils/measures';
import { coincide } from '../../utils/similitud';
import { PortionRing, SubgrupoBarra } from '../common/PortionRing';
import { fmt } from '../common/ui';

interface Props {
  dayType: DayType;
  meal: Meal;
  foods: Alimento[];
  /** Porciones marcadas de todo el día: mealId → foodId → nº. */
  porciones: PorcionesMarcadas;
  onMarcar: (mealId: string, foodId: string, delta: number) => void;
}

/** Subgrupos que se presentan con su nombre general y se concretan al pulsar. */
const GENERICOS: Partial<Record<ExchangeGroupId, string>> = {
  fruta: 'Fruta',
  verduras: 'Verdura',
};

type Entrada =
  | { tipo: 'alimento'; food: Alimento }
  | { tipo: 'grupo'; grupo: ExchangeGroupId; nombre: string; foods: Alimento[] };

/** Subgrupo al que pertenece una entrada, para poder ponerle cabecera. */
function grupoDeEntrada(e: Entrada): ExchangeGroupId | undefined {
  return e.tipo === 'grupo' ? e.grupo : e.food.grupo;
}

/**
 * La fruta no se lista una a una: se ofrece "Fruta" y el cliente busca cuál
 * se ha comido. Con cuarenta frutas en pantalla la lista era ilegible.
 *
 * Una porción de fruta es cualquier fruta, así que el buscador recorre todo
 * el catálogo aunque en la despensa sólo haya un par: lo que la nutricionista
 * elige son sugerencias, no una jaula. Las suyas salen primero.
 *
 * Los genéricos van al principio de su macro: al final de setenta almidones
 * no los encontraba nadie.
 */
export function agrupar(
  opciones: Alimento[],
  catalogo: Alimento[] = [],
  prescritos: ExchangeGroupId[] = [],
): Entrada[] {
  const sueltos: Entrada[] = [];
  const genericos = new Map<ExchangeGroupId, Alimento[]>();

  for (const f of opciones) {
    const g = f.grupo;
    if (g && GENERICOS[g]) {
      genericos.set(g, [...(genericos.get(g) ?? []), f]);
    } else {
      sueltos.push({ tipo: 'alimento', food: f });
    }
  }

  const conTodoElGrupo = (grupo: ExchangeGroupId, sugeridos: Alimento[]): Alimento[] => [
    ...sugeridos,
    ...catalogo.filter((f) => f.grupo === grupo && !sugeridos.some((s) => s.id === f.id)),
  ];

  // Si el día pauta fruta, la fruta se ofrece aunque la despensa no traiga
  // ninguna: una porción de fruta es cualquier fruta.
  for (const g of prescritos) {
    if (GENERICOS[g] && !genericos.has(g)) genericos.set(g, []);
  }

  const cabeza = [...genericos.entries()]
    .map(([grupo, sugeridos]) => ({
      tipo: 'grupo' as const,
      grupo,
      nombre: GENERICOS[grupo]!,
      foods: conTodoElGrupo(grupo, sugeridos),
    }))
    .sort(
      (a, b) => (EXCHANGE_GROUPS[a.grupo]?.orden ?? 0) - (EXCHANGE_GROUPS[b.grupo]?.orden ?? 0),
    );

  // Ordenados por subgrupo para poder agruparlos bajo su nombre: el cliente
  // ve en qué grupo está cada alimento, igual que la nutricionista.
  sueltos.sort(
    (a, b) =>
      (EXCHANGE_GROUPS[(a as { food: Alimento }).food.grupo!]?.orden ?? 0) -
      (EXCHANGE_GROUPS[(b as { food: Alimento }).food.grupo!]?.orden ?? 0),
  );

  return [...cabeza, ...sueltos];
}

function BotonAlimento({
  food,
  n,
  onElegir,
  sangria = false,
}: {
  food: Alimento;
  n: number;
  onElegir: () => void;
  sangria?: boolean;
}) {
  const gpi = gramosMarcados(food, 1);
  return (
    <button
      onClick={onElegir}
      className={`flex w-full items-baseline gap-1.5 rounded py-1 text-left text-[12px] leading-snug transition ${
        sangria ? 'pr-1.5 pl-5' : 'px-1.5'
      } ${n > 0 ? 'text-brand-800 hover:bg-brand-50' : 'text-slate-600 hover:bg-slate-50'}`}
    >
      <span
        className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${n > 0 ? 'bg-brand-500' : 'bg-slate-300'}`}
      />
      <span className="flex-1">
        {food.nombre}{' '}
        <span className="tnum text-slate-400">
          {food.medida_casera} ({gpi} {food.unidad ?? 'g'})
        </span>
      </span>
      {n > 0 && (
        <span className="tnum shrink-0 text-[10px] font-medium text-brand-700">
          ×{fmt(n, n % 1 ? 1 : 0)}
        </span>
      )}
    </button>
  );
}

/** "Fruta" — se despliega y se busca cuál. */
function GrupoGenerico({
  nombre,
  opciones,
  marcadas,
  onElegir,
}: {
  nombre: string;
  opciones: Alimento[];
  marcadas: (foodId: string) => number;
  onElegir: (foodId: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');

  const elegidas = opciones.filter((f) => marcadas(f.id) > 0);
  const visibles = opciones.filter((f) => coincide(f.nombre, q));

  return (
    <div>
      <button
        onClick={() => setAbierto((v) => !v)}
        className={`flex w-full items-baseline gap-1.5 rounded px-1.5 py-1 text-left text-[12px] leading-snug transition ${
          elegidas.length ? 'text-brand-800 hover:bg-brand-50' : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <span
          className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${
            elegidas.length ? 'bg-brand-500' : 'bg-slate-300'
          }`}
        />
        <span className="flex-1">
          {nombre}{' '}
          <span className="text-slate-400">
            {elegidas.length
              ? elegidas.map((f) => f.nombre.toLowerCase()).join(', ')
              : `la que quieras — ${opciones.length} opciones`}
          </span>
        </span>
        <span className="shrink-0 text-[10px] text-slate-400">{abierto ? '▾' : '▸'}</span>
      </button>

      {abierto && (
        <div className="mt-1 mb-1 rounded-lg border border-slate-200 bg-slate-50/60 p-1.5">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Buscar ${nombre.toLowerCase()}…`}
            className="mb-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-brand-400"
          />
          <div className="max-h-44 overflow-auto">
            {visibles.map((f) => (
              <BotonAlimento
                key={f.id}
                food={f}
                n={marcadas(f.id)}
                sangria
                onElegir={() => {
                  onElegir(f.id);
                  setQ('');
                  setAbierto(false);
                }}
              />
            ))}
            {!visibles.length && (
              <p className="px-2 py-1 text-[11px] text-slate-500">
                Nada con «{q.trim()}» en {nombre.toLowerCase()}.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * FASE 3 — el cliente pulsa el alimento y se le va sumando la porción.
 * Cada pulsación muestra la cantidad acumulada: 3 toques a pollo → 3/3 y 90 g.
 *
 * Aquí no se avisa de la grasa escondida de un alimento ("+5 g sobre su
 * grupo"): es información para decidir qué ofrecer, no para quien come. El
 * cliente ve el alimento y sus gramos; el aviso vive en la despensa de la
 * nutricionista, que es quien decide si lo pone o no.
 */
export function FoodPortionPicker({ dayType, meal, foods, porciones, onMarcar }: Props) {
  // El presupuesto se mira a dos niveles: por macro y por subgrupo.
  const seleccion = useMemo(() => seleccionPorBucket(porciones, foods), [porciones, foods]);
  const porGrupo = useMemo(() => seleccionPorGrupo(porciones, foods), [porciones, foods]);

  /** El aceite de cocción va aparte: no se elige, se da por puesto. */
  const { reserva } = repartoElegible(dayType, meal);
  const aceite = notaAceite(foods, reserva);

  // El día que se compara ya lleva descontado el aceite reservado.
  const diaElegible: DayType = useMemo(() => {
    if (!reserva) return dayType;
    const grid = { ...dayType.grid };
    const comida = { ...(grid[meal.id] ?? {}) };
    const resto = (comida.grasas ?? 0) - reserva;
    if (resto > 0) comida.grasas = resto;
    else delete comida.grasas;
    grid[meal.id] = comida;
    return { ...dayType, grid };
  }, [dayType, meal.id, reserva]);

  const balances = balanceComida(diaElegible, meal, seleccion);
  if (!balances.length && !aceite) return null;

  const marcadasEn = (foodId: string) => porciones[meal.id]?.[foodId] ?? 0;

  const opcionesDe = (bucket: MacroBucket) => alimentosDeBucket(dayType, meal, bucket, foods);

  /** Subgrupos que el día pauta para ese macro en esta comida. */
  const subgruposDe = (bucket: MacroBucket): ExchangeGroupId[] =>
    (Object.entries(diaElegible.grid[meal.id] ?? {}) as [ExchangeGroupId, number][])
      .filter(([g, n]) => n > 0 && EXCHANGE_GROUPS[g]?.bucket === bucket)
      .map(([g]) => g);

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-5 py-2.5">
        <h3 className="text-base font-bold tracking-wide text-slate-300 uppercase">{meal.nombre}</h3>
      </header>

      <div className="grid gap-5 p-5 md:grid-cols-3">
        {balances.map((b) => {
          const opciones = opcionesDe(b.bucket);
          const elegidos = opciones.filter((f) => marcadasEn(f.id) > 0);

          return (
            <div key={b.bucket}>
              {(() => {
                // El anillo sustituye al contador diminuto: el mismo dato,
                // pero visible desde el otro lado de la cocina. Los subgrupos
                // siguen debajo, en barras finas.
                const subs = balanceSubgruposDeBucket(diaElegible, meal, b.bucket, porGrupo);
                return (
                  <PortionRing
                    titulo={BUCKET_LABEL[b.bucket]}
                    elegido={b.elegidoComida}
                    pautado={b.pautadoComida}
                    detalle={
                      subs.length > 1 ? (
                        <div className="space-y-1.5">
                          {subs.map((sg) => (
                            <SubgrupoBarra
                              key={sg.grupo}
                              nombre={sg.nombre}
                              elegido={sg.elegidoComida}
                              pautado={sg.pautadoComida}
                            />
                          ))}
                        </div>
                      ) : undefined
                    }
                  />
                );
              })()}

              {/* Lo que lleva marcado, con su gramaje acumulado */}
              {elegidos.length > 0 && (
                <ul className="mt-3 mb-2 space-y-1.5">
                  {elegidos.map((f) => {
                    const n = marcadasEn(f.id);
                    return (
                      <li
                        key={f.id}
                        className="rounded-xl border border-brand-300 bg-brand-50 px-3 py-2 shadow-sm"
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-brand-900">
                              {f.nombre}
                            </p>
                            <p className="tnum mt-0.5 text-base font-bold text-brand-800">
                              {gramosMarcados(f, n)} {f.unidad ?? 'g'}
                              <span className="ml-1.5 text-[11px] font-normal text-brand-600">
                                {escalarMedida(f.medida_casera, n)}
                              </span>
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white/70 px-1 py-0.5">
                            <button
                              onClick={() => onMarcar(meal.id, f.id, -1)}
                              className="h-6 w-6 rounded text-base leading-none text-brand-700 transition hover:bg-brand-100"
                              aria-label={`Quitar una porción de ${f.nombre}`}
                            >
                              −
                            </button>
                            <span className="tnum w-5 text-center text-sm font-semibold text-brand-900">
                              {fmt(n, n % 1 ? 1 : 0)}
                            </span>
                            <button
                              onClick={() => onMarcar(meal.id, f.id, 1)}
                              className="h-6 w-6 rounded text-base leading-none text-brand-700 transition hover:bg-brand-100"
                              aria-label={`Añadir una porción de ${f.nombre}`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Los avisos de subgrupo, que sí piden atención */}
              {(() => {
                const subs = balanceSubgruposDeBucket(diaElegible, meal, b.bucket, porGrupo);
                const conMensaje = subs.filter((sg) => sg.mensaje);
                if (!conMensaje.length) return null;
                return (
                  <div className="mt-2 mb-2 space-y-1">
                    {conMensaje.map((sg) => (
                      <p
                        key={sg.grupo}
                        className={`rounded-lg border px-2 py-1 text-[11px] leading-snug ${
                          sg.estado === 'sin_margen'
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : 'border-amber-200 bg-amber-50 text-amber-800'
                        }`}
                      >
                        {sg.mensaje}
                      </p>
                    ))}
                  </div>
                );
              })()}

              {(() => {
                // El único aviso que importa en proteína: la grasa del día.
                if (b.bucket !== 'proteina') return null;
                const g = balanceGrasa(diaElegible, 'proteicos', porGrupo);
                if (!g.mensaje) return null;
                return (
                  <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800">
                    {g.mensaje}
                  </p>
                );
              })()}

              {b.mensaje && (
                <p
                  className={`mb-2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug ${
                    b.estado === 'sin_margen'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  {b.mensaje}
                </p>
              )}

              {/* Catálogo pulsable */}
              <ul className="max-h-72 space-y-0.5 overflow-auto">
                {(() => {
                  const entradas = agrupar(opciones, foods, subgruposDe(b.bucket));
                  return entradas.map((entrada, i) => {
                    const g = grupoDeEntrada(entrada);
                    const cambia = i === 0 || grupoDeEntrada(entradas[i - 1]) !== g;
                    const cabecera = cambia && g && (
                      <p className="mt-2 mb-0.5 text-[9px] font-medium tracking-wide text-slate-400 uppercase">
                        {EXCHANGE_GROUPS[g]?.nombre}
                      </p>
                    );
                    return entrada.tipo === 'grupo' ? (
                      <li key={entrada.grupo}>
                        {cabecera}
                        <GrupoGenerico
                          nombre={entrada.nombre}
                          opciones={entrada.foods}
                          marcadas={marcadasEn}
                          onElegir={(foodId) => onMarcar(meal.id, foodId, 1)}
                        />
                      </li>
                    ) : (
                      <li key={entrada.food.id}>
                        {cabecera}
                        <BotonAlimento
                          food={entrada.food}
                          n={marcadasEn(entrada.food.id)}
                          onElegir={() => onMarcar(meal.id, entrada.food.id, 1)}
                        />
                      </li>
                    );
                  });
                })()}
                {!opciones.length && (
                  <li className="text-[11px] text-slate-400">Sin opciones disponibles.</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {(aceite || dayType.notas?.[meal.id]) && (
        <div className="space-y-1 border-t border-slate-100 px-5 py-2 text-[11px]">
          {aceite && (
            <p className="text-amber-800">
              <strong className="font-medium">{aceite}</strong> — ya reservado, no hace falta
              contarlo.
            </p>
          )}
          {dayType.notas?.[meal.id] && <p className="text-slate-600">{dayType.notas[meal.id]}</p>}
        </div>
      )}
    </section>
  );
}
