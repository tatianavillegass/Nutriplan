import { useMemo, useState } from 'react';
import type { Client } from '../../types/client';
import type { Alimento } from '../../types/food';
import { CATEGORIA_PATOLOGIA_LABELS, PATOLOGIAS } from '../../data/patologias';
import { catalogoPermitido, evaluarAlimento } from '../../utils/restrictions';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import { Input } from './ui';

interface Props {
  client: Client;
  foods: Alimento[];
  onChange: (patch: Partial<Client>) => void;
}

const CATEGORIAS = ['intolerancia', 'digestivo', 'metabolico', 'preferencia'] as const;

function ListaAlimentos({
  titulo,
  descripcion,
  seleccion,
  foods,
  color,
  onToggle,
}: {
  titulo: string;
  descripcion: string;
  seleccion: string[];
  foods: Alimento[];
  color: 'red' | 'emerald';
  onToggle: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return foods
      .filter((f) => f.nombre.toLowerCase().includes(t) && !seleccion.includes(f.id))
      .slice(0, 8);
  }, [q, foods, seleccion]);

  const chip =
    color === 'red'
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  return (
    <div>
      <p className="text-xs font-medium text-slate-700">{titulo}</p>
      <p className="mt-0.5 mb-2 text-[11px] leading-snug text-slate-500">{descripcion}</p>

      {seleccion.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {seleccion.map((id) => {
            const f = foods.find((x) => x.id === id);
            return (
              <button
                key={id}
                onClick={() => onToggle(id)}
                className={`rounded border px-2 py-0.5 text-[11px] ${chip}`}
                title="Quitar"
              >
                {f?.nombre ?? id} ×
              </button>
            );
          })}
        </div>
      )}

      <div className="relative">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar alimento…"
          className="w-full text-xs"
        />
        {filtrados.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {filtrados.map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => {
                    onToggle(f.id);
                    setQ('');
                  }}
                  className="flex w-full items-baseline justify-between px-3 py-1.5 text-left text-xs hover:bg-brand-50"
                >
                  <span>{f.nombre}</span>
                  <span className="text-[10px] text-slate-400">
                    {f.grupo ? EXCHANGE_GROUPS[f.grupo].nombre : 'Libre'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Patologías, aversiones y preferidos del cliente.
 * Lo que se marca aquí bloquea alimentos y recetas al pautar.
 */
export function RestrictionsPanel({ client, foods, onChange }: Props) {
  const patologias = client.patologias ?? [];
  const aversiones = client.aversiones ?? [];
  const preferidos = client.preferidos ?? [];

  const permitidos = useMemo(() => catalogoPermitido(foods, client), [foods, client]);
  const bloqueadosPorPatologia = useMemo(
    () =>
      foods.filter((f) => {
        const ev = evaluarAlimento(f, { ...client, aversiones: [] });
        return ev.bloqueado;
      }),
    [foods, client],
  );

  const toggle = (campo: 'patologias' | 'aversiones' | 'preferidos', id: string) => {
    const actual = client[campo] ?? [];
    onChange({ [campo]: actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id] });
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium text-slate-700">Patologías y condiciones</p>
        <p className="mt-0.5 mb-2 text-[11px] leading-snug text-slate-500">
          Bloquean alimentos y recetas de forma automática. No se pueden saltar al pautar.
        </p>
        <div className="space-y-3">
          {CATEGORIAS.map((cat) => {
            const items = PATOLOGIAS.filter((p) => p.categoria === cat);
            if (!items.length) return null;
            return (
              <div key={cat}>
                <p className="mb-1 text-[10px] font-medium tracking-wide text-slate-400 uppercase">
                  {CATEGORIA_PATOLOGIA_LABELS[cat]}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((p) => {
                    const activa = patologias.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggle('patologias', p.id)}
                        title={p.descripcion}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] transition ${
                          activa
                            ? 'border-brand-500 bg-brand-600 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                        }`}
                      >
                        {p.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <ListaAlimentos
          titulo="No quiere comer"
          descripcion="Aversiones concretas. Desaparecen de sus opciones aunque no haya motivo clínico."
          seleccion={aversiones}
          foods={foods}
          color="red"
          onToggle={(id) => toggle('aversiones', id)}
        />
        <ListaAlimentos
          titulo="Le gustan"
          descripcion="No bloquean nada: las recetas que los llevan suben en las recomendaciones."
          seleccion={preferidos}
          foods={foods}
          color="emerald"
          onToggle={(id) => toggle('preferidos', id)}
        />
      </div>

      <div className="rounded-lg bg-slate-50 px-3 py-2">
        <p className="tnum text-[11px] text-slate-600">
          Quedan <strong className="font-medium text-brand-800">{permitidos.length}</strong> alimentos
          disponibles de {foods.length}.
          {bloqueadosPorPatologia.length > 0 && (
            <> {bloqueadosPorPatologia.length} bloqueados por patología, {aversiones.length} por aversión.</>
          )}
        </p>
      </div>
    </div>
  );
}
