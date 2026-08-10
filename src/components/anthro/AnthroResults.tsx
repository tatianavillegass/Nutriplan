import type { Composicion, FormulaGrasaId } from '../../types/anthropometry';
import { FORMULA_GRASA_LABELS } from '../../types/anthropometry';
import { fmt } from '../common/ui';

interface Props {
  composicion: Composicion;
  formula: FormulaGrasaId;
  onFormula: (f: FormulaGrasaId) => void;
}

function Metric({
  label,
  value,
  unidad,
  nota,
  destacado,
}: {
  label: string;
  value?: number | string;
  unidad?: string;
  nota?: string;
  destacado?: boolean;
}) {
  const vacio = value == null || value === '';
  return (
    <div className={`rounded-lg p-3 ${destacado ? 'bg-brand-50' : 'bg-slate-50'}`}>
      <p className="text-[11px] leading-tight text-slate-500">{label}</p>
      <p
        className={`tnum mt-0.5 text-lg leading-tight font-medium ${
          vacio ? 'text-slate-300' : destacado ? 'text-brand-900' : 'text-slate-800'
        }`}
      >
        {vacio ? '—' : value}
        {!vacio && unidad && <span className="ml-0.5 text-xs text-slate-500">{unidad}</span>}
      </p>
      {nota && <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{nota}</p>}
    </div>
  );
}

/** Somatocarta: sitúa el somatotipo en el triángulo de Heath-Carter. */
function Somatocarta({ x, y }: { x: number; y: number }) {
  const w = 200;
  const h = 170;
  const cx = w / 2 + x * 11;
  const cy = h / 2 - y * 11;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[170px] w-full" role="img" aria-label="Somatocarta">
      <polygon
        points={`${w / 2},14 ${w - 14},${h - 16} 14,${h - 16}`}
        fill="none"
        stroke="#dfece4"
        strokeWidth="1.5"
      />
      <line x1="14" y1={h - 16} x2={w - 14} y2={h - 16} stroke="#dfece4" />
      <text x={w / 2} y="10" textAnchor="middle" fontSize="8" fill="#94a3b8">
        Mesomorfia
      </text>
      <text x="12" y={h - 5} fontSize="8" fill="#94a3b8">
        Endomorfia
      </text>
      <text x={w - 12} y={h - 5} textAnchor="end" fontSize="8" fill="#94a3b8">
        Ectomorfia
      </text>
      <circle
        cx={Math.max(10, Math.min(w - 10, cx))}
        cy={Math.max(10, Math.min(h - 10, cy))}
        r="5"
        fill="#34674e"
      />
    </svg>
  );
}

export function AnthroResults({ composicion: c, formula, onFormula }: Props) {
  const disponibles = Object.keys(c.grasaPct) as FormulaGrasaId[];
  const activa = disponibles.includes(formula) ? formula : disponibles[0];
  const grasaPct = activa ? c.grasaPct[activa] : undefined;
  const grasaKg = activa ? c.grasaKg[activa] : undefined;
  const magraKg = activa ? c.masaMagraKg[activa] : undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label="IMC"
          value={c.imc != null ? fmt(c.imc, 1) : undefined}
          nota={c.categoriaImc}
        />
        <Metric
          label="Cintura / cadera"
          value={c.ratioCinturaCadera != null ? fmt(c.ratioCinturaCadera, 2) : undefined}
          nota={c.riesgoIcc}
        />
        <Metric label="Σ 6 pliegues" value={c.suma6 != null ? fmt(c.suma6, 1) : undefined} unidad="mm" />
        <Metric label="Σ 8 pliegues" value={c.suma8 != null ? fmt(c.suma8, 1) : undefined} unidad="mm" />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h4 className="text-[11px] font-semibold tracking-wide text-brand-800 uppercase">
            Composición corporal
          </h4>
          {disponibles.length > 0 && (
            <div className="flex gap-1">
              {disponibles.map((f) => (
                <button
                  key={f}
                  onClick={() => onFormula(f)}
                  title={FORMULA_GRASA_LABELS[f]}
                  className={`rounded px-2 py-0.5 text-[10px] transition ${
                    f === activa
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {FORMULA_GRASA_LABELS[f].split(' (')[0]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric
            label="Grasa corporal"
            value={grasaPct != null ? fmt(grasaPct, 1) : undefined}
            unidad="%"
            destacado
          />
          <Metric label="Masa grasa" value={grasaKg != null ? fmt(grasaKg, 1) : undefined} unidad="kg" />
          <Metric label="Masa magra" value={magraKg != null ? fmt(magraKg, 1) : undefined} unidad="kg" />
          <Metric
            label="Masa muscular"
            value={c.masaMuscularKg != null ? fmt(c.masaMuscularKg, 1) : undefined}
            unidad="kg"
            nota={c.masaMuscularPct != null ? `${fmt(c.masaMuscularPct, 1)} % del peso` : undefined}
          />
        </div>

        {disponibles.length > 1 && (
          <p className="tnum mt-2 text-[11px] text-slate-500">
            Otras fórmulas:{' '}
            {disponibles
              .filter((f) => f !== activa)
              .map((f) => `${FORMULA_GRASA_LABELS[f].split(' (')[0]} ${fmt(c.grasaPct[f] as number, 1)} %`)
              .join(' · ')}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <div>
          <h4 className="mb-2 text-[11px] font-semibold tracking-wide text-brand-800 uppercase">
            Perímetros corregidos y masa ósea
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric
              label="Brazo"
              value={c.perimetroCorregidoBrazo != null ? fmt(c.perimetroCorregidoBrazo, 1) : undefined}
              unidad="cm"
            />
            <Metric
              label="Muslo"
              value={c.perimetroCorregidoMuslo != null ? fmt(c.perimetroCorregidoMuslo, 1) : undefined}
              unidad="cm"
            />
            <Metric
              label="Pierna"
              value={c.perimetroCorregidoPierna != null ? fmt(c.perimetroCorregidoPierna, 1) : undefined}
              unidad="cm"
            />
            <Metric
              label="Masa ósea"
              value={c.masaOseaKg != null ? fmt(c.masaOseaKg, 1) : undefined}
              unidad="kg"
            />
          </div>

          {c.somatotipo && (
            <p className="tnum mt-3 text-sm text-slate-700">
              Somatotipo{' '}
              <strong className="font-medium text-brand-800">
                {fmt(c.somatotipo.endomorfia, 1)} – {fmt(c.somatotipo.mesomorfia, 1)} –{' '}
                {fmt(c.somatotipo.ectomorfia, 1)}
              </strong>
              <span className="ml-1.5 text-slate-500">{c.somatotipo.categoria}</span>
            </p>
          )}
        </div>

        {c.somatotipo && (
          <div className="rounded-lg border border-brand-100 p-2">
            <Somatocarta x={c.somatotipo.x} y={c.somatotipo.y} />
          </div>
        )}
      </div>

      {c.faltan.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
          Faltan medidas para completar el perfil: {c.faltan.join(' · ')}.
        </p>
      )}
    </div>
  );
}
