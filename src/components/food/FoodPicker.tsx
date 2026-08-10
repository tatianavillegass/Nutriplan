import { useEffect, useMemo, useRef, useState } from 'react';
import type { Alimento } from '../../types/food';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import { gramosPorIntercambio } from '../../utils/recipeComposition';

interface Props {
  foods: Alimento[];
  /** Alimento seleccionado, si lo hay. */
  value?: string;
  /** Texto libre cuando no hay alimento del catálogo. */
  nombreLibre?: string;
  onSelect: (food: Alimento) => void;
  onLibre?: (nombre: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /**
   * Para los buscadores que sirven de acción ("añadir a la lista"): tras
   * elegir se vacía la caja, de forma que la siguiente búsqueda parte de cero.
   * Sin esto, el nombre anterior se queda escrito y no encuentra nada.
   */
  limpiarTrasElegir?: boolean;
  /**
   * Por qué un alimento está vetado para este cliente (lactosa, gluten, una
   * aversión…). No lo esconde: lo enseña en ámbar con el motivo, porque
   * desaparecer sin explicación parece que la app está rota.
   */
  motivoBloqueo?: (food: Alimento) => string | undefined;
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Buscador de alimentos: se escribe "pollo" y salen todos los cortes.
 * No hay que saber en qué subgrupo está guardado.
 */
export function FoodPicker({
  foods,
  value,
  nombreLibre,
  onSelect,
  onLibre,
  placeholder = 'Escribe un alimento…',
  autoFocus,
  limpiarTrasElegir = false,
  motivoBloqueo,
}: Props) {
  const seleccionado = value ? foods.find((f) => f.id === value) : undefined;
  const [q, setQ] = useState(seleccionado?.nombre ?? nombreLibre ?? '');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQ(seleccionado?.nombre ?? nombreLibre ?? '');
  }, [seleccionado?.nombre, nombreLibre]);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  const resultados = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return [];
    const conPuntos = foods
      .map((f) => {
        const n = norm(f.nombre);
        // Empezar por el término pesa más que contenerlo en medio.
        if (n.startsWith(t)) return { f, p: 0 };
        // "pollo" debe encontrar "Pollo, contramuslo" y "Caldo de pollo".
        const partes = n.split(/[\s,()]+/);
        if (partes.some((x) => x.startsWith(t))) return { f, p: 1 };
        if (n.includes(t)) return { f, p: 2 };
        return null;
      })
      .filter(Boolean) as { f: Alimento; p: number }[];

    return conPuntos
      .sort((a, b) => a.p - b.p || a.f.nombre.localeCompare(b.f.nombre))
      .slice(0, 10)
      .map((x) => x.f);
  }, [q, foods]);

  useEffect(() => setActivo(0), [q]);

  const elegir = (f: Alimento) => {
    onSelect(f);
    setQ(limpiarTrasElegir ? '' : f.nombre);
    setAbierto(false);
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (!abierto || !resultados.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      elegir(resultados[activo]);
    } else if (e.key === 'Escape') {
      setAbierto(false);
    }
  };

  return (
    <div ref={caja} className="relative">
      <input
        value={q}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          setQ(e.target.value);
          setAbierto(true);
          onLibre?.(e.target.value);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={teclas}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 ${
          seleccionado ? 'border-brand-300 text-slate-800' : 'border-slate-200 text-slate-700'
        }`}
      />

      {seleccionado && !abierto && (
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-700">
          {seleccionado.grupo ? EXCHANGE_GROUPS[seleccionado.grupo].nombre : 'Libre'}
        </span>
      )}

      {abierto && resultados.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {resultados.map((f, i) => {
            const g = f.grupo ? EXCHANGE_GROUPS[f.grupo] : undefined;
            const gpi = gramosPorIntercambio(f);
            const veto = motivoBloqueo?.(f);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => elegir(f)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition ${
                    i === activo ? 'bg-brand-50' : ''
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: g?.color ?? "#cbd5e1" }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-xs ${veto ? 'text-amber-800' : 'text-slate-800'}`}
                    >
                      {f.nombre}
                    </span>
                    {veto && <span className="block text-[10px] text-amber-600">{veto}</span>}
                  </span>
                  <span className="tnum shrink-0 text-[10px] text-slate-400">
                    {gpi ? `${gpi} g` : ''}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {g?.nombre ?? 'Libre'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {abierto && q.trim().length > 1 && resultados.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500 shadow-lg">
          Sin resultados. Se usará «{q.trim()}» como texto libre; puedes darlo de alta en Alimentos.
        </div>
      )}
    </div>
  );
}
