import { useEffect, useMemo, useState } from 'react';
import type { Alimento } from '../../types/food';
import type { FilaCompletitud } from '../../utils/completitud';
import { huecos, nombreGrupo, type ResumenComida } from '../../utils/completitud';
import {
  buscarParaAnadir,
  crearAnadido,
  opcionesParaGrupo,
  verdurasLibres,
  type Anadido,
  type OpcionAnadido,
} from '../../utils/anadidos';
import { fmt } from '../common/ui';

type Pestana = 'verdura' | 'completar' | 'extra';

interface Props {
  foods: Alimento[];
  resumen: ResumenComida;
  anadidos: Anadido[];
  onAnadir: (a: Anadido) => void;
  onQuitar: (id: string) => void;
  onAlternarCuenta: (id: string) => void;
  /**
   * Hueco al que saltar cuando se pulsa "Completar con…" en el checklist.
   * Lleva un `nonce` porque el resumen se recalcula en cada render y comparar
   * la fila por identidad dispararía el salto sin parar.
   */
  foco?: { familia: string; nonce: number } | null;
}

/** Cantidades de verdura sugeridas: el resto es "al gusto". */
const PESTANAS: { id: Pestana; label: string; nota: string }[] = [
  { id: 'verdura', label: 'Verdura libre', nota: 'Al gusto — no gasta intercambios ni mueve tus macros.' },
  { id: 'completar', label: 'Completar plan', nota: 'Lo que le falta a esta comida, con el gramaje ya calculado.' },
  { id: 'extra', label: 'Extra', nota: 'Café con leche, una pieza de fruta de más… tú decides si cuenta.' },
];

/**
 * AÑADIR ALGO A LA COMIDA (§5)
 *
 * Tres puertas distintas porque son tres intenciones distintas: echarle
 * espinaca, tapar el hueco que dejó la receta, o meter algo que no estaba en
 * el plan. Sólo la tercera pregunta si cuenta o no — en las otras dos la
 * respuesta ya la sabe la app.
 */
export function AddFoodPanel({
  foods,
  resumen,
  anadidos,
  onAnadir,
  onQuitar,
  onAlternarCuenta,
  foco,
}: Props) {
  const pendientes = useMemo(() => huecos(resumen), [resumen]);

  const [pestana, setPestana] = useState<Pestana>(pendientes.length ? 'completar' : 'verdura');
  const [familiaElegida, setFamiliaElegida] = useState<string | undefined>();
  const [busqueda, setBusqueda] = useState('');
  /** En "Extra": si lo añadido ocupa sitio en el plan o va por encima. */
  const [cuentaExtra, setCuentaExtra] = useState(true);

  // Salto desde el checklist: abre la pestaña de completar en ese hueco.
  const nonce = foco?.nonce;
  useEffect(() => {
    if (!foco) return;
    setPestana('completar');
    setFamiliaElegida(foco.familia);
    setBusqueda('');
    // Sólo al pulsar, no en cada recálculo del resumen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  /**
   * El hueco vivo. Se busca por familia en la lista de pendientes recién
   * calculada: si se acaba de tapar, cae solo al siguiente que falte.
   */
  const activo: FilaCompletitud | undefined =
    pestana === 'completar'
      ? (pendientes.find((h) => h.familia === familiaElegida) ?? pendientes[0])
      : undefined;

  const opciones: OpcionAnadido[] = useMemo(() => {
    if (pestana === 'verdura') return verdurasLibres(foods, busqueda);
    if (pestana === 'extra') return buscarParaAnadir(foods, busqueda);
    if (!activo) return [];
    return opcionesParaGrupo(activo.grupoObjetivo, activo.falta, foods, busqueda);
  }, [pestana, foods, busqueda, activo]);

  const anadir = (o: OpcionAnadido) => {
    const cuenta = pestana === 'extra' ? cuentaExtra : pestana === 'completar';
    onAnadir(crearAnadido(o.food, o.intercambios, cuenta));
    setBusqueda('');
  };

  const nota = PESTANAS.find((p) => p.id === pestana)!.nota;

  return (
    <div className="rounded-lg border border-brand-200 bg-white p-3">
      <p className="text-[11px] font-semibold text-brand-800">Añadir a la comida</p>

      {/* ── Pestañas ─────────────────────────────────────── */}
      <div className="mt-1.5 flex gap-1">
        {PESTANAS.map((p) => {
          const cuenta = p.id === 'completar' ? pendientes.length : 0;
          return (
            <button
              key={p.id}
              onClick={() => setPestana(p.id)}
              className={`flex-1 rounded-md px-1.5 py-1 text-[10px] font-medium transition ${
                pestana === p.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.label}
              {cuenta > 0 && (
                <span
                  className={`ml-1 rounded-full px-1 text-[9px] ${
                    pestana === p.id ? 'bg-white/25' : 'bg-amber-200 text-amber-800'
                  }`}
                >
                  {cuenta}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-1.5 text-[10px] leading-snug text-slate-500">{nota}</p>

      {/* ── Selector de hueco ────────────────────────────── */}
      {pestana === 'completar' &&
        (pendientes.length > 1 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {pendientes.map((h) => (
              <button
                key={h.familia}
                onClick={() => setFamiliaElegida(h.familia)}
                className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                  activo?.familia === h.familia
                    ? 'border-brand-500 bg-brand-50 font-medium text-brand-800'
                    : 'border-slate-200 text-slate-600 hover:border-brand-300'
                }`}
              >
                {h.label} · falta {fmt(h.falta, h.falta % 1 ? 1 : 0)}
              </button>
            ))}
          </div>
        ) : !pendientes.length ? (
          <p className="mt-2 rounded bg-emerald-50 px-2 py-1.5 text-[10px] text-emerald-700">
            No falta nada: la receta ya cubre todo lo pautado.
          </p>
        ) : null)}

      {/* ── Buscador ─────────────────────────────────────── */}
      {(pestana !== 'completar' || pendientes.length > 0) && (
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={
            pestana === 'verdura'
              ? 'Espinaca, tomate, pepino…'
              : pestana === 'extra'
                ? 'Café con leche, yogur, fruta…'
                : `Buscar en ${nombreGrupo(activo?.grupoObjetivo ?? 'fruta').toLowerCase()}…`
          }
          className="mt-1.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] outline-none focus:border-brand-400"
        />
      )}

      {/* ── ¿Cuenta o es extra? ──────────────────────────── */}
      {pestana === 'extra' && (
        <div className="mt-1.5 flex rounded-md border border-slate-200 p-0.5 text-[10px]">
          <button
            onClick={() => setCuentaExtra(true)}
            className={`flex-1 rounded px-1.5 py-1 transition ${
              cuentaExtra ? 'bg-brand-600 font-medium text-white' : 'text-slate-600'
            }`}
            title="Ocupa el hueco pautado de su grupo"
          >
            Cuenta en el plan
          </button>
          <button
            onClick={() => setCuentaExtra(false)}
            className={`flex-1 rounded px-1.5 py-1 transition ${
              !cuentaExtra ? 'bg-amber-500 font-medium text-white' : 'text-slate-600'
            }`}
            title="Va por encima de lo pautado"
          >
            Es un extra
          </button>
        </div>
      )}

      {/* ── Resultados ───────────────────────────────────── */}
      {(pestana !== 'completar' || pendientes.length > 0) && (
        <div className="mt-1.5 max-h-44 overflow-auto rounded-md border border-slate-100">
          {opciones.length === 0 ? (
            <p className="px-2 py-2 text-[10px] text-slate-500">
              {pestana === 'extra' && !busqueda.trim()
                ? 'Escribe para buscar en el catálogo.'
                : `Nada con «${busqueda.trim()}».`}
            </p>
          ) : (
            opciones.map((o) => (
              <button
                key={o.food.id}
                onClick={() => anadir(o)}
                className="flex w-full items-baseline gap-1.5 px-2 py-1.5 text-left text-[11px] text-slate-700 transition hover:bg-brand-50"
              >
                <span className="text-brand-500">+</span>
                <span className="flex-1 truncate">{o.food.nombre}</span>
                <span className="tnum shrink-0 text-[10px] text-slate-500">
                  {o.cantidad == null ? 'al gusto' : `${o.cantidad} ${o.unidad}`}
                </span>
                {o.medida && o.cantidad != null && (
                  <span className="hidden shrink-0 text-[9px] text-slate-400 sm:inline">
                    {o.medida}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {/* ── Lo ya añadido ────────────────────────────────── */}
      {anadidos.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
          {anadidos.map((a) => (
            <li key={a.id} className="flex items-baseline gap-1.5 text-[11px]">
              <span className="flex-1 truncate text-slate-700">
                {a.nombre}
                <span className="tnum ml-1 text-slate-500">
                  {a.cantidad == null ? 'al gusto' : `${a.cantidad} ${a.unidad}`}
                </span>
              </span>

              {a.grupo && a.intercambios > 0 ? (
                <button
                  onClick={() => onAlternarCuenta(a.id)}
                  title={
                    a.cuenta
                      ? 'Ocupa el hueco pautado. Pulsa para pasarlo a extra.'
                      : 'Va por encima del plan. Pulsa para que cuente.'
                  }
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium transition ${
                    a.cuenta
                      ? 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  }`}
                >
                  {a.cuenta ? 'cuenta' : 'extra'}
                </button>
              ) : (
                <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] text-emerald-700">
                  libre
                </span>
              )}

              <button
                onClick={() => onQuitar(a.id)}
                title="Quitar"
                className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[11px] leading-5 text-slate-500 transition hover:bg-red-500 hover:text-white"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
