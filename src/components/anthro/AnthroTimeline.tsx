import type { FormulaGrasaId, Medicion, Sexo } from '../../types/anthropometry';
import { tablaDeAntropometria } from '../../utils/seguimientoEnTabla';
import { TablaDeSeguimiento } from '../common/TablaDeSeguimiento';

interface Props {
  mediciones: Medicion[];
  seleccionada?: string;
  onSeleccionar: (id: string) => void;
  onEliminar: (id: string) => void;
  /** Hacen falta para la composición de cada toma, no sólo de la última. */
  sexo: Sexo;
  edad: number;
  formula: FormulaGrasaId;
}


const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' });

export function AnthroTimeline({
  mediciones,
  seleccionada,
  onSeleccionar,
  onEliminar,
  sexo,
  edad,
  formula,
}: Props) {
  const { columnas, grupos } = tablaDeAntropometria(mediciones, sexo, edad, formula);
  if (!mediciones.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {mediciones.map((m, i) => (
          <div key={m.id} className="group relative">
            <button
              onClick={() => onSeleccionar(m.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                m.id === seleccionada
                  ? 'border-brand-500 bg-brand-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
              }`}
            >
              {fecha(m.fecha)}
              {i === 0 && <span className="ml-1 opacity-60">· inicial</span>}
              {i === mediciones.length - 1 && i > 0 && <span className="ml-1 opacity-60">· última</span>}
            </button>
            <button
              onClick={() => onEliminar(m.id)}
              className="absolute -top-1.5 -right-1.5 hidden h-4 w-4 rounded-full bg-slate-200 text-[10px] leading-none text-slate-600 group-hover:block hover:bg-red-500 hover:text-white"
              title="Eliminar medición"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/*
        LA TABLA ENTERA, NO TRES COLUMNAS
        =================================
        Enseñaba inicial, anterior y actual: de tres columnas, dos son siempre
        las mismas, y con cinco tomas eso esconde justo lo que se viene a ver.
        Y sólo traía las sumas —«puedo ver la suma de pliegues pero no comparar
        los mm de grasa en cada punto ni las medidas, y eso me interesa»—.
        Ahora es su planilla: una columna por toma, con los ocho pliegues, los
        siete perímetros y la composición. Ver `TablaDeSeguimiento`.
      */}
      {mediciones.length > 1 && (
        <TablaDeSeguimiento columnas={columnas} grupos={grupos} />
      )}
    </div>
  );
}
