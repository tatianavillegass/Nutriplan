import type {
  DiametroId,
  Medicion,
  PerimetroId,
  PliegueId,
} from "../../types/anthropometry";
import {
  DIAMETRO_LABELS,
  PERIMETRO_LABELS,
  PLIEGUE_LABELS,
} from "../../types/anthropometry";
import { Input } from "../common/ui";

interface Props {
  medicion: Medicion;
  onChange: (patch: Partial<Medicion>) => void;
}

const PLIEGUES = Object.keys(PLIEGUE_LABELS) as PliegueId[];
const PERIMETROS = Object.keys(PERIMETRO_LABELS) as PerimetroId[];
const DIAMETROS = Object.keys(DIAMETRO_LABELS) as DiametroId[];

function Campo({
  label,
  value,
  unidad,
  step = "0.1",
  onChange,
}: {
  label: string;
  value?: number;
  unidad: string;
  step?: string;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] leading-tight text-slate-500">
        {label}
      </span>
      <div className="relative">
        <Input
          type="number"
          step={step}
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? undefined : Number(e.target.value))
          }
          className="w-full pr-7 text-sm"
        />
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-slate-400">
          {unidad}
        </span>
      </div>
    </label>
  );
}

function Bloque({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <h4 className="text-[11px] font-semibold tracking-wide text-brand-800 uppercase">
          {titulo}
        </h4>
        {nota && <span className="text-[10px] text-slate-400">{nota}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>
    </div>
  );
}

/** Formulario del perfil ISAK. Lo que no se mide se deja en blanco. */
export function AnthroForm({ medicion, onChange }: Props) {
  const setPliegue = (id: PliegueId, v?: number) =>
    onChange({ pliegues: { ...medicion.pliegues, [id]: v } });
  const setPerimetro = (id: PerimetroId, v?: number) =>
    onChange({ perimetros: { ...medicion.perimetros, [id]: v } });
  const setDiametro = (id: DiametroId, v?: number) =>
    onChange({ diametros: { ...medicion.diametros, [id]: v } });
  const setBio = (
    id: keyof NonNullable<Medicion["bioimpedancia"]>,
    v?: number,
  ) => onChange({ bioimpedancia: { ...medicion.bioimpedancia, [id]: v } });

  return (
    <div className="space-y-5">
      <Bloque titulo="Básicos">
        <label className="block">
          <span className="mb-0.5 block text-[11px] leading-tight text-slate-500">
            Fecha
          </span>
          <Input
            type="date"
            value={medicion.fecha.slice(0, 10)}
            onChange={(e) => onChange({ fecha: e.target.value })}
            className="w-full text-sm"
          />
        </label>
        <Campo
          label="Peso"
          unidad="kg"
          value={medicion.peso}
          onChange={(v) => onChange({ peso: v })}
        />
        <Campo
          label="Talla"
          unidad="cm"
          value={medicion.talla}
          onChange={(v) => onChange({ talla: v })}
        />
        <Campo
          label="Envergadura"
          unidad="cm"
          value={medicion.envergadura}
          onChange={(v) => onChange({ envergadura: v })}
        />
      </Bloque>

      <Bloque titulo="Pliegues" nota="milímetros">
        {PLIEGUES.map((p) => (
          <Campo
            key={p}
            label={PLIEGUE_LABELS[p]}
            unidad="mm"
            value={medicion.pliegues[p]}
            onChange={(v) => setPliegue(p, v)}
          />
        ))}
      </Bloque>

      <Bloque titulo="Perímetros" nota="centímetros">
        {PERIMETROS.map((p) => (
          <Campo
            key={p}
            label={PERIMETRO_LABELS[p]}
            unidad="cm"
            value={medicion.perimetros[p]}
            onChange={(v) => setPerimetro(p, v)}
          />
        ))}
      </Bloque>

      <Bloque
        titulo="Diámetros óseos"
        nota="centímetros · necesarios para el somatotipo"
      >
        {DIAMETROS.map((d) => (
          <Campo
            key={d}
            label={DIAMETRO_LABELS[d]}
            unidad="cm"
            value={medicion.diametros[d]}
            onChange={(v) => setDiametro(d, v)}
          />
        ))}
      </Bloque>

      {/*
        BIOIMPEDANCIA
        ==============================================================
        Se copia tal cual lo que marca el aparato. No se mezcla con el % de
        grasa de los pliegues: cada báscula usa su fórmula y juntarlos daría un
        número que no es de nadie. Cada uno se compara consigo mismo.
      */}
      <Bloque titulo="Bioimpedancia" nota="lo que marque la báscula, tal cual">
        <Campo
          label="Grasa"
          unidad="%"
          value={medicion.bioimpedancia?.grasaPct}
          onChange={(v) => setBio("grasaPct", v)}
        />
        <Campo
          label="Músculo"
          unidad="%"
          value={medicion.bioimpedancia?.musculoPct}
          onChange={(v) => setBio("musculoPct", v)}
        />
        <Campo
          label="Agua"
          unidad="%"
          value={medicion.bioimpedancia?.aguaPct}
          onChange={(v) => setBio("aguaPct", v)}
        />
        <Campo
          label="Grasa visceral"
          unidad="índice"
          step="1"
          value={medicion.bioimpedancia?.visceral}
          onChange={(v) => setBio("visceral", v)}
        />
      </Bloque>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          Notas de la sesión
        </span>
        <textarea
          value={medicion.notas ?? ""}
          onChange={(e) => onChange({ notas: e.target.value })}
          rows={2}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          placeholder="Hidratación, hora de la medición, incidencias…"
        />
      </label>
    </div>
  );
}
