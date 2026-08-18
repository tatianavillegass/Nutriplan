import { useMemo, useState } from 'react';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';
import type { ExchangeCounts } from '../../utils/exchanges';
import { exchangesToMacros } from '../../utils/exchanges';
import { EXCHANGE_GROUPS, type MacroBucket } from '../../data/exchangeGroups';
import { scaleRecipe } from '../../utils/recipeScaling';
import { composicionDesdeIngredientes } from '../../utils/recipeComposition';
import { estadoComida, avisoDeGrasa } from '../../utils/completitud';
import { BUCKET_LABEL } from '../../utils/mealOptions';
import {
  TIPOS_ACOMPANAMIENTO,
  LABEL_ACOMPANAMIENTO,
  type Acompanamiento,
  type TipoAcompanamiento,
} from '../../types/plan';
import { gramosPorIntercambio } from '../../utils/recipeComposition';
import { FoodPicker } from '../food/FoodPicker';
import { uid } from '../../utils/storage';
import { Button, Input, fmt } from '../common/ui';

interface Props {
  receta: Receta;
  /** Intercambios pautados de esta comida, para esta clienta. */
  requeridos: ExchangeCounts;
  foods: Alimento[];
  /** Gramos ya ajustados a mano: ingredienteId → gramos. */
  ajustes: Record<string, number>;
  /** Lo que ya se le ha puesto al lado. */
  acompanamientos?: Acompanamiento[];
  /**
   * El banco entero, para poder poner al lado un acompañamiento ya escrito
   * —la ensalada de tomate, el puré— en vez de sus alimentos uno a uno.
   */
  recetas?: Receta[];
  onGuardar: (ajustes: Record<string, number>, acompanamientos: Acompanamiento[]) => void;
  onCerrar: () => void;
}

/** «3», «3½»: las medias porciones son parte del sistema. */
const porciones = (n: number): string => {
  const entero = Math.floor(n + 0.001);
  const media = n - entero >= 0.4;
  if (!media) return String(entero);
  return entero === 0 ? '½' : `${entero}½`;
};

const TONO: Record<MacroBucket, string> = {
  proteina: 'text-brand-800',
  carbohidrato: 'text-amber-800',
  grasa: 'text-rose-800',
};

/**
 * AJUSTAR LAS CANTIDADES A MANO
 *
 * La app escala la receta a lo pautado y propone unos gramos. Pero la última
 * palabra es de quien pauta: a veces conviene subir el pan y bajar el aceite
 * aunque los macros salgan parecidos, o cuadrar a un número redondo que la
 * clienta pueda medir sin báscula.
 *
 * Arriba va lo pautado de esa comida, que es la referencia contra la que se
 * decide. Debajo, cada ingrediente con sus gramos editables. Y al final, cómo
 * quedan los macros con lo que hay escrito ahora mismo.
 *
 * Lo que se guarda vive en el plan de esa clienta, no en la receta del banco:
 * la misma receta se cuadra distinto según a quién se le pauta.
 */
export function AjustarCantidades({
  receta,
  requeridos,
  foods,
  ajustes,
  acompanamientos: inicial = [],
  recetas = [],
  onGuardar,
  onCerrar,
}: Props) {
  const [valores, setValores] = useState<Record<string, number>>(ajustes);
  const [acompanamientos, setAcompanamientos] = useState<Acompanamiento[]>(inicial);
  const [tipo, setTipo] = useState<TipoAcompanamiento>('acompanamiento');

  /** Lo que propone la app, sin ajustes: es el punto de partida. */
  const propuesta = useMemo(
    () => scaleRecipe(receta, requeridos, foods),
    [receta, requeridos, foods],
  );

  /** Lo que hay ahora mismo, con lo escrito a mano y los acompañamientos. */
  const actual = useMemo(
    () => scaleRecipe(receta, requeridos, foods, valores, acompanamientos),
    [receta, requeridos, foods, valores, acompanamientos],
  );

  /**
   * Los macros de verdad de lo que hay escrito. No se pueden sacar del
   * escalado —que razona en intercambios— porque al cambiar los gramos a mano
   * la relación se rompe: hay que volver a leer el catálogo.
   */
  const enPlato = useMemo(() => {
    const ingredientes = actual.ingredientes.map((i) => ({
      ...i,
      cantidad_base: i.cantidad_final,
    }));
    return composicionDesdeIngredientes({ ingredientes }, foods).base as ExchangeCounts;
  }, [actual.ingredientes, foods]);

  const resumen = useMemo(() => estadoComida(requeridos, enPlato), [requeridos, enPlato]);
  const grasa = useMemo(() => avisoDeGrasa(requeridos, enPlato), [requeridos, enPlato]);

  /** Lo pautado, en el idioma con el que se decide: porciones por subgrupo. */
  const pauta = (Object.entries(requeridos) as [keyof typeof EXCHANGE_GROUPS, number][])
    .filter(([g, n]) => n > 0 && !EXCHANGE_GROUPS[g].ilimitado)
    .sort(([a], [b]) => EXCHANGE_GROUPS[a].orden - EXCHANGE_GROUPS[b].orden);

  const hayAjustes = Object.keys(valores).length > 0;

  /**
   * PONER UN ACOMPAÑAMIENTO DEL BANCO
   *
   * Al lado del salmón va la ensalada de tomate entera, no sus cuatro
   * alimentos buscados de uno en uno. Entra con los gramos con los que está
   * escrita —un acompañamiento no se escala: es la guarnición de siempre— y
   * desde ahí se retoca como cualquier otro.
   *
   * Sólo cuentan los ingredientes enlazados al catálogo, que son los únicos de
   * los que se sabe cuánto aportan. La verdura y lo que no gasta intercambios
   * —gelatinas, bebida de almendras— entran igual y suman cero: es justo lo
   * que se espera de ellos.
   */
  const guarniciones = useMemo(() => recetas.filter((r) => r.acompanamiento), [recetas]);

  const ponerGuarnicion = (r: Receta) => {
    /*
     * Entran TODOS sus ingredientes, también la sal y el eneldo. No hay que
     * meterlos en la base de datos para que se vean: sin alimento enlazado
     * salen «al gusto» y suman cero, que es exactamente lo que aportan.
     */
    const nuevos = r.ingredientes.map((i) => ({
      id: uid('ac_'),
      foodId: i.foodId,
      nombre: i.nombre,
      gramos: i.cantidad_base ?? 0,
      unidad: i.unidad || 'g',
      // El tipo elegido arriba: así un café con leche entra como «Café».
      tipo,
      deReceta: r.id,
      deRecetaNombre: r.nombre,
    }));
    setAcompanamientos((prev) => [...prev, ...nuevos]);
  };

  /**
   * Lo puesto, agrupado por el acompañamiento del que salió. Los sueltos —un
   * yogur, un café— son un grupo de uno y se ven igual que antes.
   */
  const grupos = useMemo(() => {
    const out: { clave: string; receta?: Receta; suyos: Acompanamiento[] }[] = [];
    for (const a of acompanamientos) {
      const clave = a.deReceta ?? a.id;
      const ya = out.find((g) => g.clave === clave);
      if (ya) ya.suyos.push(a);
      else
        out.push({
          clave,
          receta: a.deReceta ? recetas.find((r) => r.id === a.deReceta) : undefined,
          suyos: [a],
        });
    }
    return out;
  }, [acompanamientos, recetas]);

  /** Lo que no está enlazado no cuenta, y callárselo sería mentir. */
  const sueltos = (r: Receta) => r.ingredientes.filter((i) => !i.foodId).length;

  const poner = (id: string, v: string) => {
    setValores((prev) => {
      if (v === '') {
        const { [id]: _fuera, ...resto } = prev;
        return resto;
      }
      return { ...prev, [id]: Number(v) };
    });
  };

  return (
    <div className="rounded-xl border border-brand-300 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-brand-900">
          Cantidades de «{receta.nombre}»
        </h4>
        <span className="text-[11px] text-slate-400">
          Los cambios son sólo para esta clienta
        </span>
      </div>

      {/* ── Lo pautado, que es la referencia ──────────────── */}
      <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2">
        <p className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
          Esta comida tiene pautado
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-700">
          {pauta.map(([g, n]) => (
            <span key={g}>
              <strong className="tnum font-semibold">{porciones(n)}</strong>{' '}
              {EXCHANGE_GROUPS[g].nombre.toLowerCase()}
            </span>
          ))}
        </p>
      </div>

      {/* ── Los ingredientes, con sus gramos ──────────────── */}
      <ul className="space-y-1.5">
        {actual.ingredientes
          .filter((ing) => !ing.acompanamiento)
          .map((ing) => {
          const sugerido = propuesta.ingredientes.find((p) => p.id === ing.id);
          const libre = ing.cantidad_base == null || !ing.escalable;

          return (
            <li key={ing.id} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
                {ing.nombre}
                <span className="ml-1.5 text-[10px] text-slate-400">
                  {EXCHANGE_GROUPS[ing.grupo as keyof typeof EXCHANGE_GROUPS]?.nombre.toLowerCase() ??
                    'condimento'}
                </span>
              </span>

              {libre ? (
                <span className="text-xs text-emerald-700">{ing.display}</span>
              ) : (
                <>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={valores[ing.id] ?? ing.cantidad_final ?? ''}
                    onChange={(e) => poner(ing.id, e.target.value)}
                    className="w-20 text-sm"
                  />
                  <span className="w-8 text-[11px] text-slate-400">{ing.unidad}</span>
                  {/* Lo que proponía la app, para poder volver de un vistazo. */}
                  {sugerido?.cantidad_final != null &&
                    valores[ing.id] != null &&
                    valores[ing.id] !== sugerido.cantidad_final && (
                      <button
                        onClick={() => poner(ing.id, '')}
                        className="text-[10px] text-brand-600 underline"
                        title="Volver a lo que calcula la app"
                      >
                        {sugerido.cantidad_final} {ing.unidad}
                      </button>
                    )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      {/* ── Lo que se le pone al lado ─────────────────────── */}
      <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/40 p-2.5">
        <p className="text-[10px] font-medium tracking-wide text-brand-800 uppercase">
          Acompañamientos
        </p>
        <p className="mt-0.5 mb-2 text-[11px] leading-snug text-slate-600">
          Para tapar un hueco sin tocar la receta: a una arepa con huevo no se le echa más
          huevo, se le pone un yogur al lado.
        </p>

        {acompanamientos.length > 0 && (
          <div className="mb-2 space-y-2">
            {/*
              LO PUESTO, AGRUPADO POR DE DÓNDE VIENE
              ======================================
              Un acompañamiento del banco entra con varios ingredientes. En una
              lista corrida se veían cuatro filas de gramos sin saber que eran
              «la salsa de yogur»: se sabía que había añadido algo, no qué.
            */}
            {grupos.map((g) => (
              <div key={g.clave} className="rounded-lg bg-white p-1.5">
                {g.receta && (
                  <div className="mb-1 flex items-center gap-2 px-0.5">
                    {g.receta.foto_url ? (
                      <img
                        src={g.receta.foto_url}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <span className="h-6 w-6 rounded-full bg-brand-100" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-brand-900">
                      {g.receta.nombre}
                    </span>
                    <button
                      onClick={() =>
                        setAcompanamientos((prev) =>
                          prev.filter((x) => (x.deReceta ?? x.id) !== g.clave),
                        )
                      }
                      className="text-[11px] text-slate-400 transition hover:text-red-600"
                    >
                      Quitar
                    </button>
                  </div>
                )}
                <ul className="space-y-1">
                  {g.suyos.map((a) => (
              <li key={a.id} className="rounded bg-white px-2 py-1.5">
                {/*
                  El nombre arriba y entero. En una sola fila, con tres o cuatro
                  puestos, se quedaba en «Yogur grie…» y no se sabía cuál se
                  estaba editando.
                */}
                <p className="mb-1 flex flex-wrap items-baseline gap-1.5 text-xs text-slate-700">
                  <span className="font-medium">{a.nombre}</span>
                  {a.deRecetaNombre && (
                    <span className="text-[10px] text-slate-400">de {a.deRecetaNombre}</span>
                  )}
                  {!a.foodId && (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">
                      al gusto · no cuenta
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-[10px] text-brand-700">
                  {LABEL_ACOMPANAMIENTO[a.tipo]}
                </span>
                <Input
                  type="number"
                  min="0"
                  value={a.gramos}
                  onChange={(e) =>
                    setAcompanamientos((prev) =>
                      prev.map((x) =>
                        x.id === a.id ? { ...x, gramos: Number(e.target.value) || 0 } : x,
                      ),
                    )
                  }
                  className="w-20 text-sm"
                />
                <span className="w-6 text-[11px] text-slate-400">{a.unidad ?? 'g'}</span>
                <button
                  onClick={() =>
                    setAcompanamientos((prev) => prev.filter((x) => x.id !== a.id))
                  }
                  className="ml-auto text-slate-300 transition hover:text-red-600"
                  aria-label={`Quitar ${a.nombre}`}
                >
                  ×
                </button>
                </div>
              </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] text-slate-500">
            <span className="mb-0.5 block">Tipo</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoAcompanamiento)}
              className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 outline-none focus:border-brand-400"
            >
              {TIPOS_ACOMPANAMIENTO.map((t) => (
                <option key={t} value={t}>
                  {LABEL_ACOMPANAMIENTO[t]}
                </option>
              ))}
            </select>
          </label>
          <div className="min-w-[12rem] flex-1">
            <FoodPicker
              foods={foods}
              placeholder="Buscar un alimento…"
              limpiarTrasElegir
              onSelect={(f) => {
                const gpi = gramosPorIntercambio(f);
                setAcompanamientos((prev) => [
                  ...prev,
                  {
                    id: uid('ac_'),
                    foodId: f.id,
                    nombre: f.nombre,
                    // Una porción de entrada: es lo que suele faltar.
                    gramos: gpi ? Math.round(gpi) : f.gramos || 100,
                    unidad: f.unidad ?? 'g',
                    tipo,
                  },
                ]);
              }}
            />
          </div>
        </div>

        {/*
          Los acompañamientos del banco, con foto pequeña: se eligen mirando
          varios a la vez, no leyendo una lista de nombres.
        */}
        {guarniciones.length > 0 && (
          <div className="mt-2.5">
            <p className="mb-1.5 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
              O uno del banco
            </p>
            <div className="flex flex-wrap gap-1.5">
              {guarniciones.map((r) => (
                <button
                  key={r.id}
                  onClick={() => ponerGuarnicion(r)}
                  title={
                    sueltos(r)
                      ? `Ojo: ${sueltos(r)} de sus ingredientes no están enlazados al catálogo y no contarán`
                      : 'Entra con los gramos con los que está escrita'
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1 pr-2 pl-1 text-xs text-slate-700 transition hover:border-brand-400"
                >
                  {r.foto_url ? (
                    <img src={r.foto_url} alt="" className="h-7 w-7 rounded object-cover" />
                  ) : (
                    <span className="h-7 w-7 rounded bg-brand-50" />
                  )}
                  <span className="max-w-[9rem] truncate">{r.nombre}</span>
                  {sueltos(r) > 0 && <span className="text-amber-600">!</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Cómo quedan los macros con lo escrito ─────────── */}
      <div className="mt-3 rounded-lg border border-slate-200 p-2.5">
        <p className="mb-1.5 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
          Con estas cantidades
        </p>
        <ul className="space-y-1">
          {resumen.filas.map((f) => (
            <li key={f.bucket} className="flex items-baseline justify-between gap-2 text-xs">
              <span className={TONO[f.bucket]}>{BUCKET_LABEL[f.bucket]}</span>
              <span className="tnum text-slate-600">
                {porciones(f.cubierto)} de {porciones(f.pautado)}
                <span
                  className={`ml-2 ${
                    f.estado === 'ok'
                      ? 'text-emerald-700'
                      : f.estado === 'falta'
                        ? 'text-amber-700'
                        : 'text-rose-700'
                  }`}
                >
                  {f.estado === 'ok'
                    ? '✓'
                    : f.estado === 'falta'
                      ? `faltan ${porciones(Math.abs(f.falta))}`
                      : `sobran ${porciones(Math.abs(f.falta))}`}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <p className="tnum mt-1.5 border-t border-slate-100 pt-1.5 text-[11px] text-slate-500">
          {fmt(kcal(enPlato))} kcal · pautadas {fmt(kcal(requeridos))}
        </p>

        {grasa && <p className="mt-1 text-[11px] text-amber-700">{grasa.texto}</p>}
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {hayAjustes && (
          <Button variant="outline" onClick={() => setValores({})}>
            Volver a lo calculado
          </Button>
        )}
        <Button variant="outline" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button onClick={() => onGuardar(valores, acompanamientos)}>Guardar cantidades</Button>
      </div>
    </div>
  );
}

function kcal(counts: ExchangeCounts): number {
  const m = exchangesToMacros(counts);
  return m.hc * 4 + m.proteina * 4 + m.grasa * 9;
}
