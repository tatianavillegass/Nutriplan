import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DayType, DespensaComida } from '../../types/plan';
import {
  aplicarPlantillaDia,
  borrarPlantillaDia,
  cobertura,
  desdeDayType,
  guardarPlantillaDia,
  leerPlantillasDia,
  totalAlimentos,
  type PlantillaDia,
} from '../../utils/plantillas';
import { Button } from '../common/ui';

interface Props {
  dayType: DayType;
  onDespensa: (despensa: Record<string, DespensaComida>) => void;
}

/**
 * PARTIR DE UNA PLANTILLA
 *
 * Un clic deja el día entero montado con los alimentos de siempre, y a partir
 * de ahí se personaliza comida a comida. Es lo contrario de empezar en blanco
 * con cada cliente.
 */
export function DayTemplateBar({ dayType, onDespensa }: Props) {
  const [plantillas, setPlantillas] = useState<PlantillaDia[]>(() => leerPlantillasDia());
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [aplicada, setAplicada] = useState<string | null>(null);

  const propio = desdeDayType(dayType);
  const tieneAlgo = Object.keys(propio).length > 0;

  const aplicar = (p: PlantillaDia, sumar: boolean) => {
    onDespensa(aplicarPlantillaDia(dayType, p, sumar));
    setAplicada(p.id);
  };

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[11px] font-medium tracking-wide text-brand-800 uppercase">
          Partir de una plantilla
        </span>

        {plantillas.map((p) => {
          const cubre = cobertura(dayType, p);
          return (
            <span
              key={p.id}
              className={`flex items-center rounded-lg border bg-white text-xs ${
                p.id === aplicada ? 'border-emerald-300' : 'border-slate-200'
              }`}
            >
              <button
                onClick={() => aplicar(p, false)}
                disabled={!cubre}
                title={
                  cubre
                    ? `Poner ${totalAlimentos(p)} alimentos en ${cubre} comidas de ${dayType.nombre}`
                    : 'Esta plantilla no cubre ninguna de las comidas de este día'
                }
                className="px-2.5 py-1.5 text-slate-700 hover:text-brand-700 disabled:text-slate-300"
              >
                {p.nombre}
                <span className="tnum ml-1.5 text-slate-400">{cubre} comidas</span>
              </button>
              <button
                onClick={() => aplicar(p, true)}
                disabled={!cubre}
                title="Añadir a lo que ya hay, sin borrar"
                className="border-l border-slate-100 px-2 py-1.5 text-slate-400 hover:text-brand-700 disabled:text-slate-200"
              >
                +
              </button>
              <button
                onClick={() => {
                  if (!window.confirm(`¿Borrar la plantilla "${p.nombre}"?`)) return;
                  setPlantillas(borrarPlantillaDia(plantillas, p.id));
                }}
                aria-label={`Borrar la plantilla ${p.nombre}`}
                className="border-l border-slate-100 px-2 py-1.5 text-slate-300 hover:text-red-600"
              >
                ×
              </button>
            </span>
          );
        })}

        {!plantillas.length && (
          <span className="text-[11px] text-slate-500">
            Ninguna todavía. Monta el día y guárdalo para reutilizarlo.
          </span>
        )}

        {guardando ? (
          <span className="ml-auto flex items-center gap-1.5">
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                setPlantillas(guardarPlantillaDia(plantillas, nombre, propio));
                setNombre('');
                setGuardando(false);
              }}
              placeholder="Día de entreno"
              className="w-40 rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400"
            />
            <Button
              onClick={() => {
                setPlantillas(guardarPlantillaDia(plantillas, nombre, propio));
                setNombre('');
                setGuardando(false);
              }}
            >
              Guardar
            </Button>
            <button
              onClick={() => setGuardando(false)}
              className="text-[11px] text-slate-400 hover:underline"
            >
              Cancelar
            </button>
          </span>
        ) : (
          <span className="ml-auto flex items-center gap-3">
            <Link to="/plantillas" className="text-[11px] text-brand-600 hover:underline">
              Gestionar plantillas
            </Link>
            <button
              onClick={() => setGuardando(true)}
              disabled={!tieneAlgo}
              title={tieneAlgo ? undefined : 'Añade alimentos a alguna comida primero'}
              className="text-[11px] text-brand-600 hover:underline disabled:text-slate-300 disabled:no-underline"
            >
              + Guardar este día como plantilla
            </button>
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[11px] text-slate-500">
        La plantilla es el punto de partida: sustituye lo que haya, y con <strong>+</strong> se suma
        a lo que ya hay. Después ajustas comida a comida.
      </p>
    </div>
  );
}
