import { useMemo, useState } from 'react';
import type { Alimento, Alergeno, Apto, MealSlot, Nutrientes100 } from '../../types/food';
import { ALERGENO_LABELS } from '../../types/food';
import {
  EXCHANGE_GROUPS,
  EXCHANGE_GROUP_LIST,
  type ExchangeGroupId,
  type MacroBucket,
} from '../../data/exchangeGroups';
import { calcularPorcion, sugerirSubgrupo, subgruposDeBucket } from '../../utils/portions';
import { Button, Field, Input, Select, fmt } from '../common/ui';

const BUCKETS: [MacroBucket, string][] = [
  ['carbohidrato', 'Carbohidrato'],
  ['proteina', 'Proteína'],
  ['grasa', 'Grasa'],
];

const SLOTS: [MealSlot, string][] = [
  ['desayuno', 'Desayuno'],
  ['almuerzo', 'Almuerzo'],
  ['comida', 'Comida'],
  ['merienda', 'Merienda'],
  ['cena', 'Cena'],
  ['extra', 'Extra'],
];

const APTOS: [Apto, string][] = [
  ['vegetariano', 'Vegetariano'],
  ['vegano', 'Vegano'],
  ['sin_gluten', 'Sin gluten'],
  ['sin_lactosa', 'Sin lactosa'],
];

const NUTRIENTES_VACIOS: Nutrientes100 = { hc: 0, proteina: 0, grasa: 0 };

export interface FoodFormValue {
  nombre: string;
  grupo: ExchangeGroupId;
  nutrientes: Nutrientes100;
  medida_casera: string;
  gramos?: number;
  equivalencia_cocido?: number;
  comidas_sugeridas: MealSlot[];
  alergenos: Alergeno[];
  apto: Apto[];
  notas?: string;
}

interface Props {
  inicial?: Alimento;
  onGuardar: (v: FoodFormValue) => void;
  onCancelar?: () => void;
}

/**
 * Alta de alimentos. Se introducen los datos por 100 g y la app deduce
 * cuántos gramos son una porción del subgrupo elegido.
 */
export function FoodForm({ inicial, onGuardar, onCancelar }: Props) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [n, setN] = useState<Nutrientes100>(inicial?.nutrientes ?? NUTRIENTES_VACIOS);
  const [grupoManual, setGrupoManual] = useState<ExchangeGroupId | ''>(inicial?.grupo ?? '');
  const [medida, setMedida] = useState(inicial?.medida_casera ?? '');
  /** Gramos de la porción. Se rellena solo con el cálculo, pero se puede ajustar. */
  const [gramosManual, setGramosManual] = useState<number | undefined>(inicial?.gramos);
  const [cocido, setCocido] = useState<number | undefined>(inicial?.equivalencia_cocido);
  const [slots, setSlots] = useState<MealSlot[]>(inicial?.comidas_sugeridas ?? ['comida', 'cena']);
  const [alergenos, setAlergenos] = useState<Alergeno[]>(inicial?.alergenos ?? []);
  const [apto, setApto] = useState<Apto[]>(inicial?.apto ?? []);
  const [notas, setNotas] = useState(inicial?.notas ?? '');

  const sugerido = useMemo(() => sugerirSubgrupo(n), [n]);
  const grupo = (grupoManual || sugerido) as ExchangeGroupId | undefined;
  const bucket = grupo ? EXCHANGE_GROUPS[grupo].bucket : undefined;

  const porcion = useMemo(() => (grupo ? calcularPorcion(n, grupo) : undefined), [n, grupo]);
  const gramosFinales = gramosManual ?? porcion?.gramos;
  const ajustado =
    gramosManual != null && porcion != null && Math.abs(gramosManual - porcion.gramos) > 0.5;

  const setNut = (k: keyof Nutrientes100, v: string) =>
    setN((prev) => ({ ...prev, [k]: v === '' ? undefined : Number(v) } as Nutrientes100));

  const kcalCalculadas = n.hc * 4 + n.proteina * 4 + n.grasa * 9;
  const kcalDeclaradas = n.kcal;
  const desajusteKcal =
    kcalDeclaradas != null && kcalDeclaradas > 0
      ? Math.abs(kcalDeclaradas - kcalCalculadas) / kcalDeclaradas
      : 0;

  const toggle = <T,>(arr: T[], v: T, set: (x: T[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const puedeGuardar = nombre.trim().length > 1 && !!grupo && !!porcion;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field label="Nombre del alimento">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Avena en copos"
            className="w-full"
          />
        </Field>
        <Field label="Medida casera" hint="Cómo se la describes al cliente">
          <Input
            value={medida}
            onChange={(e) => setMedida(e.target.value)}
            placeholder="1/4 taza"
            className="w-full"
          />
        </Field>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-600">Datos nutricionales por 100 g</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {(
            [
              ['kcal', 'Kcal'],
              ['hc', 'Carbohidr.'],
              ['proteina', 'Proteína'],
              ['grasa', 'Grasa'],
              ['fibra', 'Fibra'],
              ['azucar', 'Azúcares'],
            ] as [keyof Nutrientes100, string][]
          ).map(([k, label]) => (
            <label key={k} className="block">
              <span className="mb-0.5 block text-[10px] text-slate-500">{label}</span>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={n[k] ?? ''}
                onChange={(e) => setNut(k, e.target.value)}
                className="w-full text-sm"
              />
            </label>
          ))}
        </div>
        {desajusteKcal > 0.1 && (
          <p className="mt-1.5 text-[11px] text-amber-700">
            Las kcal de la etiqueta ({fmt(kcalDeclaradas as number)}) no cuadran con los macros
            ({fmt(kcalCalculadas)} kcal). Revisa algún dato.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Grupo">
          <Select
            value={bucket ?? ''}
            onChange={(e) => {
              const b = e.target.value as MacroBucket;
              const opciones = subgruposDeBucket(b);
              setGrupoManual(opciones[0] ?? '');
            }}
            className="w-full"
          >
            <option value="">Elegir…</option>
            {BUCKETS.map(([b, label]) => (
              <option key={b} value={b}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Subgrupo de intercambio"
          hint={
            sugerido && grupoManual !== sugerido
              ? `Por los nutrientes parece ${EXCHANGE_GROUPS[sugerido].nombre.toLowerCase()}`
              : sugerido
                ? 'Sugerido a partir de los nutrientes'
                : undefined
          }
        >
          <Select
            value={grupo ?? ''}
            onChange={(e) => setGrupoManual(e.target.value as ExchangeGroupId)}
            className="w-full"
          >
            <option value="">Elegir…</option>
            {(bucket ? subgruposDeBucket(bucket) : EXCHANGE_GROUP_LIST.map((g) => g.id)).map((g) => (
              <option key={g} value={g}>
                {EXCHANGE_GROUPS[g].nombre}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* ── Porción calculada ─────────────────────────── */}
      {grupo && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
          {porcion ? (
            <>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs text-slate-600">1 intercambio de</span>
                <span className="text-xs font-medium text-brand-800">
                  {EXCHANGE_GROUPS[grupo].nombre.toLowerCase()}
                </span>
                <span className="text-xs text-slate-600">equivale a</span>
                <span className="tnum text-2xl leading-none font-medium text-brand-900">
                  {porcion.gramos} g
                </span>
                {medida && <span className="text-xs text-slate-500">· {medida}</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="mb-0.5 block text-[10px] text-slate-500">
                    Porción que quieres usar
                  </span>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={gramosFinales ?? ''}
                    onChange={(e) =>
                      setGramosManual(e.target.value === '' ? undefined : Number(e.target.value))
                    }
                    className="w-28 text-sm"
                  />
                </label>
                {ajustado && (
                  <button
                    onClick={() => setGramosManual(undefined)}
                    className="pb-2 text-[11px] text-brand-600 underline"
                  >
                    Volver a los {porcion.gramos} g calculados
                  </button>
                )}
              </div>
              <p className="tnum mt-1.5 text-[11px] text-slate-500">
                Cálculo: 100 g × {EXCHANGE_GROUPS[grupo][porcion.ancla]} g de{' '}
                {porcion.ancla === 'hc' ? 'carbohidrato' : porcion.ancla === 'proteina' ? 'proteína' : 'grasa'} ÷{' '}
                {n[porcion.ancla]} g por 100 g = {fmt(porcion.gramosExactos, 1)} g → {porcion.gramos} g
              </p>

              <table className="tnum mt-3 w-full max-w-md text-[11px]">
                <thead>
                  <tr className="text-slate-400">
                    <th className="text-left font-normal"> </th>
                    <th className="text-right font-normal">Esta porción</th>
                    <th className="text-right font-normal">Subgrupo</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['Carbohidrato', 'hc', 'g'],
                      ['Proteína', 'proteina', 'g'],
                      ['Grasa', 'grasa', 'g'],
                      ['Calorías', 'kcal', 'kcal'],
                    ] as [string, keyof typeof porcion.aporta, string][]
                  ).map(([label, k, u]) => (
                    <tr key={k} className="border-t border-brand-100">
                      <td className="py-0.5 text-slate-600">{label}</td>
                      <td className="py-0.5 text-right font-medium text-slate-800">
                        {fmt(porcion.aporta[k], k === 'kcal' ? 0 : 1)} {u}
                      </td>
                      <td className="py-0.5 text-right text-slate-400">
                        {fmt(porcion.nominal[k], k === 'kcal' ? 0 : 1)} {u}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {porcion.avisos.map((a) => (
                <p key={a} className="mt-2 text-[11px] leading-snug text-amber-700">
                  {a}
                </p>
              ))}
            </>
          ) : (
            <p className="text-[11px] text-amber-700">
              Falta el{' '}
              {EXCHANGE_GROUPS[grupo].ancla === 'hc'
                ? 'carbohidrato'
                : EXCHANGE_GROUPS[grupo].ancla === 'proteina'
                  ? 'la proteína'
                  : 'la grasa'}{' '}
              por 100 g: es lo que define el tamaño de la porción en este subgrupo.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Equivalencia en cocido" hint="Sólo si el gramaje de arriba es en crudo">
          <Input
            type="number"
            step="1"
            min="0"
            value={cocido ?? ''}
            onChange={(e) => setCocido(e.target.value === '' ? undefined : Number(e.target.value))}
            placeholder="45"
            className="w-full"
          />
        </Field>
        <Field label="Notas">
          <Input value={notas} onChange={(e) => setNotas(e.target.value)} className="w-full" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">Comidas sugeridas</p>
          <div className="flex flex-wrap gap-1">
            {SLOTS.map(([s, label]) => (
              <button
                key={s}
                onClick={() => toggle(slots, s, setSlots)}
                className={`rounded border px-2 py-0.5 text-[11px] transition ${
                  slots.includes(s)
                    ? 'border-brand-400 bg-brand-100 text-brand-800'
                    : 'border-slate-200 text-slate-500 hover:border-brand-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">Alérgenos</p>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(ALERGENO_LABELS) as Alergeno[]).map((a) => (
              <button
                key={a}
                onClick={() => toggle(alergenos, a, setAlergenos)}
                className={`rounded border px-2 py-0.5 text-[11px] transition ${
                  alergenos.includes(a)
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-slate-200 text-slate-500 hover:border-red-300'
                }`}
              >
                {ALERGENO_LABELS[a]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">Apto para</p>
          <div className="flex flex-wrap gap-1">
            {APTOS.map(([a, label]) => (
              <button
                key={a}
                onClick={() => toggle(apto, a, setApto)}
                className={`rounded border px-2 py-0.5 text-[11px] transition ${
                  apto.includes(a)
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-500 hover:border-emerald-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        {onCancelar && (
          <Button variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
        )}
        <Button
          onClick={() =>
            puedeGuardar &&
            onGuardar({
              nombre: nombre.trim(),
              grupo: grupo as ExchangeGroupId,
              nutrientes: n,
              medida_casera: medida.trim() || `${gramosFinales} g`,
              gramos: gramosFinales,
              equivalencia_cocido: cocido,
              comidas_sugeridas: slots,
              alergenos,
              apto,
              notas: notas.trim() || undefined,
            })
          }
        >
          {inicial ? 'Guardar cambios' : 'Añadir a la base de datos'}
        </Button>
      </div>
      {!puedeGuardar && (
        <p className="text-right text-[11px] text-slate-400">
          Hacen falta el nombre, el subgrupo y el macro que define la porción.
        </p>
      )}
    </div>
  );
}
