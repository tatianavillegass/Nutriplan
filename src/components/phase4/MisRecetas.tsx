import { useMemo, useState } from 'react';
import type { Alimento } from '../../types/food';
import type { IngredientePropio, RecetaPropia } from '../../types/diary';
import { macrosDeReceta } from '../../utils/recetasPropias';
import { FoodPicker } from '../food/FoodPicker';
import { NumeroConComa, aNumero } from '../common/NumeroConComa';
import { Button, fmt } from '../common/ui';
import { uid, nowIso } from '../../utils/storage';

interface Props {
  recetas: RecetaPropia[];
  foods: Alimento[];
  onGuardar: (receta: RecetaPropia) => void;
  onBorrar: (id: string) => void;
}

/**
 * LO QUE COCINA ELLA
 *
 * Se escribe una vez —ingredientes y qué sale— y a partir de ahí se apunta
 * como cualquier otro alimento: sale en el buscador de la comida y, si dijo
 * cuántas raciones salen, la casilla de gramos ya viene con lo que pesa una.
 *
 * Lo que hay que preguntarle es QUÉ SALE, no cuánto se come: del banana bread
 * salen diez rebanadas y mañana se servirá las que quiera. Preguntarlo al
 * cocinar es fácil —lo tiene delante— y preguntarlo al comer es imposible.
 */
export function MisRecetas({ recetas, foods, onGuardar, onBorrar }: Props) {
  const [abierta, setAbierta] = useState(false);
  const [editando, setEditando] = useState<RecetaPropia | null>(null);
  /**
   * PLEGADA, PORQUE APUNTAR NO PASA POR AQUÍ
   *
   * Sus recetas se apuntan desde el buscador de cada comida, así que esta
   * lista no hace falta para comer: es para escribirlas y retocarlas. Con
   * quince recetas abiertas, el contador del día —que es lo que se mira— se
   * iría media pantalla más abajo.
   */
  const [desplegada, setDesplegada] = useState(false);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => setDesplegada((v) => !v)}
          aria-expanded={desplegada}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="text-sm font-semibold text-slate-800">Mis recetas</span>
          {recetas.length > 0 && (
            <span className="tnum rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
              {recetas.length}
            </span>
          )}
          <span className="text-xs text-slate-400">{desplegada ? '▾' : '▸'}</span>
        </button>
        <button
          onClick={() => {
            setEditando(null);
            setDesplegada(true);
            setAbierta((v) => !v);
          }}
          className="text-xs font-medium text-brand-700 hover:underline"
        >
          {abierta ? 'Cerrar' : '+ Nueva receta'}
        </button>
      </div>
      {(desplegada || abierta) && (
        <p className="mt-1 text-xs leading-snug text-slate-500">
          Lo que cocinas tú. Escríbela una vez con lo que le echas y lo que sale, y luego apúntala
          como cualquier alimento.
        </p>
      )}

      {abierta && (
        <Formulario
          key={editando?.id ?? 'nueva'}
          inicial={editando}
          foods={foods}
          onGuardar={(r) => {
            onGuardar(r);
            setAbierta(false);
            setEditando(null);
          }}
          onCancelar={() => {
            setAbierta(false);
            setEditando(null);
          }}
        />
      )}

      {desplegada && recetas.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {recetas.map((r) => {
            const { peso, gramosPorRacion, totales } = macrosDeReceta(r, foods);
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-slate-800">{r.nombre}</span>
                  <span className="tnum block text-[11px] text-slate-500">
                    {gramosPorRacion
                      ? `${r.raciones} raciones · ${Math.round(gramosPorRacion)} g cada una`
                      : `${Math.round(peso)} g en total`}
                    {' · '}
                    {fmt(totales.kcal ?? 0, 0)} kcal la receta entera
                  </span>
                </span>
                <button
                  onClick={() => {
                    setEditando(r);
                    setAbierta(true);
                  }}
                  className="text-[11px] text-slate-500 hover:text-brand-700"
                >
                  Editar
                </button>
                <button
                  onClick={() => onBorrar(r.id)}
                  aria-label={`Borrar ${r.nombre}`}
                  className="text-slate-300 transition hover:text-rose-600"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Formulario({
  inicial,
  foods,
  onGuardar,
  onCancelar,
}: {
  inicial: RecetaPropia | null;
  foods: Alimento[];
  onGuardar: (r: RecetaPropia) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [ingredientes, setIngredientes] = useState<IngredientePropio[]>(
    inicial?.ingredientes ?? [],
  );
  const [raciones, setRaciones] = useState(inicial?.raciones ? String(inicial.raciones) : '');
  const [gramosFinales, setGramosFinales] = useState(
    inicial?.gramosFinales ? String(inicial.gramosFinales) : '',
  );
  const [vuelta, setVuelta] = useState(0);

  const borrador: RecetaPropia = useMemo(
    () => ({
      id: inicial?.id ?? 'borrador',
      nombre,
      ingredientes,
      raciones: aNumero(raciones),
      gramosFinales: aNumero(gramosFinales),
      creada: inicial?.creada ?? nowIso(),
    }),
    [inicial, nombre, ingredientes, raciones, gramosFinales],
  );

  const { totales, peso, gramosPorRacion } = macrosDeReceta(borrador, foods);
  const listo = nombre.trim().length > 1 && ingredientes.some((i) => i.gramos > 0);

  const poner = (i: number, patch: Partial<IngredientePropio>) =>
    setIngredientes((prev) => prev.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing)));

  return (
    <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Cómo se llama: banana bread, mugcake…"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
      />

      <p className="mt-3 mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
        Lo que le echas
      </p>
      <ul className="space-y-1.5">
        {ingredientes.map((ing, i) => (
          <li key={ing.id} className="flex items-center gap-2 rounded bg-white px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
              {ing.nombre}
              {!ing.foodId && (
                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">
                  no cuenta
                </span>
              )}
            </span>
            <NumeroConComa
              value={String(ing.gramos)}
              onChange={(t) => poner(i, { gramos: aNumero(t) ?? 0 })}
              className="w-20 text-sm"
              aria-label={`Gramos de ${ing.nombre}`}
            />
            <span className="w-4 text-[11px] text-slate-400">g</span>
            <button
              onClick={() => setIngredientes((prev) => prev.filter((_, idx) => idx !== i))}
              aria-label={`Quitar ${ing.nombre}`}
              className="text-slate-300 transition hover:text-rose-600"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-2">
        <FoodPicker
          key={vuelta}
          foods={foods}
          placeholder="Añadir ingrediente…"
          limpiarTrasElegir
          onSelect={(f) => {
            setIngredientes((prev) => [
              ...prev,
              { id: uid('ip_'), foodId: f.id, nombre: f.nombre, gramos: f.gramos || 100 },
            ]);
            setVuelta((v) => v + 1);
          }}
        />
      </div>

      {/*
        QUÉ SALE DE AHÍ
        ===============
        Las dos casillas son la misma receta contada de dos maneras y sirven
        para momentos distintos: las raciones para servirse una entera, los
        gramos finales para pesarse un trozo. Se puede rellenar una, la otra o
        las dos.
      */}
      <p className="mt-3 mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
        Qué sale
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-0.5 block text-[11px] text-slate-600">
            Cuántas raciones salen
          </span>
          <NumeroConComa
            value={raciones}
            onChange={setRaciones}
            className="w-full text-sm"
            placeholder="10 rebanadas"
            aria-label="Cuántas raciones salen"
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] text-slate-600">
            Lo que pesa ya hecho
          </span>
          <NumeroConComa
            value={gramosFinales}
            onChange={setGramosFinales}
            className="w-full text-sm"
            placeholder="1000 g"
            aria-label="Lo que pesa ya hecho"
          />
        </label>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">
        Con las raciones puedes apuntarte una entera; con el peso, servirte los gramos que
        quieras. Si lo pesas al sacarlo del horno, ese peso manda: al cocinar se va el agua.
      </p>

      {peso > 0 && (
        <div className="mt-3 rounded-lg bg-white px-3 py-2">
          <p className="tnum text-xs text-slate-600">
            Por 100 g: P {fmt((totales.proteina / peso) * 100, 1)} · HC{' '}
            {fmt((totales.hc / peso) * 100, 1)} · G {fmt((totales.grasa / peso) * 100, 1)} ·{' '}
            {fmt(((totales.kcal ?? 0) / peso) * 100, 0)} kcal
          </p>
          {gramosPorRacion && (
            <p className="tnum mt-0.5 text-xs text-brand-800">
              Una ración ({Math.round(gramosPorRacion)} g): P{' '}
              {fmt((totales.proteina / peso) * gramosPorRacion, 1)} · HC{' '}
              {fmt((totales.hc / peso) * gramosPorRacion, 1)} · G{' '}
              {fmt((totales.grasa / peso) * gramosPorRacion, 1)} ·{' '}
              {fmt(((totales.kcal ?? 0) / peso) * gramosPorRacion, 0)} kcal
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          onClick={() =>
            onGuardar({
              ...borrador,
              id: inicial?.id ?? uid('rp_'),
              nombre: nombre.trim(),
            })
          }
          disabled={!listo}
        >
          Guardar receta
        </Button>
        <Button variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
