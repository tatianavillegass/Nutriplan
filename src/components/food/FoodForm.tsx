import { useMemo, useState } from 'react';
import type { Alimento, Alergeno, Apto, MealSlot, Nutrientes100 } from '../../types/food';
import { ALERGENO_LABELS } from '../../types/food';
import {
  EXCHANGE_GROUPS,
  EXCHANGE_GROUP_LIST,
  type ExchangeGroupId,
  type MacroBucket,
} from '../../data/exchangeGroups';
import { calcularPorcion, sugerirSubgrupo, subgruposDeBucket, hcNeto } from '../../utils/portions';
import { exchangesToMacros } from '../../utils/exchanges';
import { kcalFromMacros } from '../../utils/macros';
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
  /** Sin subgrupo el alimento es libre: canela, vinagre, café, especias. */
  grupo?: ExchangeGroupId;
  nutrientes: Nutrientes100;
  medida_casera: string;
  gramos?: number;
  equivalencia_cocido?: number;
  comidas_sugeridas: MealSlot[];
  alergenos: Alergeno[];
  apto: Apto[];
  notas?: string;
  /** Reparto de intercambios cuando el alimento no cabe en un solo grupo. */
  equivale?: Partial<Record<ExchangeGroupId, number>>;
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
  /**
   * Alimentos que gastan dos cosas: una medida de mezcla de tortitas son
   * 2 almidones Y 2 proteicos. Se declara a mano porque repartir los macros
   * entre grupos automáticamente daría siempre más de una respuesta válida.
   */
  const [equivale, setEquivale] = useState<Partial<Record<ExchangeGroupId, number>>>(
    inicial?.equivale ?? {},
  );
  const compuesto = Object.values(equivale).some((v) => (v ?? 0) > 0);

  const sugerido = useMemo(() => sugerirSubgrupo(n), [n]);
  const grupo = (grupoManual || sugerido) as ExchangeGroupId | undefined;
  const bucket = grupo ? EXCHANGE_GROUPS[grupo].bucket : undefined;

  /** El cálculo puro, para poder ofrecer «volver a los X g calculados». */
  const calculada = useMemo(() => (grupo ? calcularPorcion(n, grupo) : undefined), [n, grupo]);
  const gramosFinales = gramosManual ?? calculada?.gramos;
  /** Lo que se enseña: los avisos hablan de la porción que se va a usar. */
  const porcion = useMemo(
    () => (grupo ? calcularPorcion(n, grupo, gramosFinales) : undefined),
    [n, grupo, gramosFinales],
  );
  const ajustado =
    gramosManual != null && calculada != null && Math.abs(gramosManual - calculada.gramos) > 0.5;

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

  /**
   * LOS CONDIMENTOS NO TIENEN PORCIÓN
   *
   * La canela, el vinagre, las especias o el café no pertenecen a ningún
   * subgrupo y no gastan intercambios: pedirles un macro que defina la porción
   * era pedirles algo que no existe, y por eso no se podían guardar. Sin
   * subgrupo, el alimento es libre — que es justo lo que son.
   */
  const esLibre = !grupo;
  const puedeGuardar = nombre.trim().length > 1 && (esLibre || !!porcion);

  /**
   * Comprobación del reparto: lo que dicen los intercambios declarados frente
   * a lo que dice la etiqueta para esos gramos. Si no cuadran, uno de los dos
   * está mal y más vale verlo aquí que descubrirlo en el plato.
   */
  const macrosDeclarados = useMemo(() => exchangesToMacros(equivale), [equivale]);
  const macrosReales = useMemo(() => {
    const f = (gramosFinales ?? 0) / 100;
    return { proteina: n.proteina * f, hc: hcNeto(n) * f, grasa: n.grasa * f };
  }, [n, gramosFinales]);

  /**
   * Lo que aporta la porción que hay escrita en la caja. La tabla usaba lo que
   * calculó la app y no lo que Tats escribía encima: ponía 35 g y seguía
   * enseñando los números de los 25 g calculados.
   */
  const aportaDeLaPorcion = useMemo(() => {
    const f = (gramosFinales ?? 0) / 100;
    const hc = hcNeto(n) * f;
    const proteina = n.proteina * f;
    const grasa = n.grasa * f;
    return { hc, proteina, grasa, kcal: kcalFromMacros({ hc, proteina, grasa }) };
  }, [n, gramosFinales]);
  /**
   * Se juzga por calorías, no macro a macro. Cada grupo arrastra sus macros de
   * regalo —un almidón trae 2 g de proteína— así que el reparto declarado
   * siempre sale algo por encima en proteína. Lo que tiene que cuadrar es la
   * energía; los gramos sueltos son ruido de la tabla.
   */
  const kcalDeclaradas_ = kcalFromMacros(macrosDeclarados);
  const kcalReales = kcalFromMacros(macrosReales);
  const cuadra =
    kcalReales > 0 &&
    Math.abs(kcalDeclaradas_ - kcalReales) / kcalReales <= 0.12 &&
    Math.abs(macrosDeclarados.proteina - macrosReales.proteina) <= 4 &&
    Math.abs(macrosDeclarados.hc - macrosReales.hc) <= 4;

  const fmtN = (v: number) => v.toFixed(1);

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
                    Volver a los {calculada?.gramos} g calculados
                  </button>
                )}
              </div>
              <p className="tnum mt-1.5 text-[11px] text-slate-500">
                Cálculo: 100 g × {EXCHANGE_GROUPS[grupo][porcion.ancla]} g de{' '}
                {porcion.ancla === 'hc' ? 'carbohidrato' : porcion.ancla === 'proteina' ? 'proteína' : 'grasa'} ÷{' '}
                {n[porcion.ancla]} g por 100 g = {fmt(porcion.gramosExactos, 1)} g → {calculada?.gramos} g
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
                        {fmt(aportaDeLaPorcion[k], k === 'kcal' ? 0 : 1)} {u}
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

        {/* ── Alimentos que gastan más de un intercambio ───── */}
        <div className="sm:col-span-2">
          <p className="mb-1 text-xs font-medium text-slate-600">
            ¿Gasta más de un intercambio?
          </p>
          <p className="mb-2 text-[11px] leading-snug text-slate-500">
            Para productos que no caben en un grupo: una medida de mezcla de tortitas proteicas son
            2 almidones <em>y</em> 2 proteicos magros. Déjalo vacío si el alimento es de un solo
            grupo. Regla: si el segundo macro no llega a media porción, no hace falta.
          </p>

          <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
            {/*
              La fila se queda hasta que se pulse la ×. Antes se pintaban sólo
              las mayores que cero, así que al borrar el 1 para escribir 0,5 la
              fila desaparecía a mitad de escribir y no había manera de poner
              medio intercambio.
            */}
            {(Object.entries(equivale) as [ExchangeGroupId, number][]).map(([g, v]) => (
              <div key={g} className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={v}
                  onChange={(e) =>
                    setEquivale((prev) => ({
                      ...prev,
                      [g]: e.target.value === '' ? 0 : Number(e.target.value),
                    }))
                  }
                  className="w-20 text-sm"
                />
                <span className="flex-1 text-xs text-slate-600">{EXCHANGE_GROUPS[g].nombre}</span>
                <button
                  onClick={() =>
                    setEquivale((prev) => {
                      const { [g]: _quitado, ...resto } = prev;
                      return resto;
                    })
                  }
                  className="text-slate-300 transition hover:text-red-600"
                  aria-label={`Quitar ${EXCHANGE_GROUPS[g].nombre}`}
                >
                  ×
                </button>
              </div>
            ))}

            <select
              value=""
              onChange={(e) => {
                const g = e.target.value as ExchangeGroupId;
                if (g) setEquivale((prev) => ({ ...prev, [g]: prev[g] || 1 }));
              }}
              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 outline-none focus:border-brand-400"
            >
              <option value="">+ Añadir un grupo…</option>
              {EXCHANGE_GROUP_LIST.filter((g) => !g.ilimitado && equivale[g.id] == null).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </select>

            {compuesto && (
              <div className="tnum mt-1 rounded border border-brand-200 bg-white px-2 py-1.5 text-[10px] leading-snug">
                <p className="font-medium text-brand-800">Comprobación</p>
                <p className="mt-0.5 text-slate-600">
                  Lo declarado: {fmt(kcalDeclaradas_)} kcal · P{' '}
                  {fmtN(macrosDeclarados.proteina)} · HC {fmtN(macrosDeclarados.hc)} · G{' '}
                  {fmtN(macrosDeclarados.grasa)} g
                </p>
                <p className="text-slate-600">
                  La etiqueta, para {gramosFinales ?? 0} g: {fmt(kcalReales)} kcal · P{' '}
                  {fmtN(macrosReales.proteina)} · HC {fmtN(macrosReales.hc)} · G{' '}
                  {fmtN(macrosReales.grasa)} g
                </p>
                <p className={`mt-0.5 ${cuadra ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {cuadra
                    ? 'Cuadra: el reparto refleja lo que trae el producto.'
                    : 'No cuadra del todo. Ajusta las porciones o los gramos de la medida.'}
                </p>
              </div>
            )}
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
              grupo: grupo as ExchangeGroupId | undefined,
              nutrientes: n,
              medida_casera: medida.trim() || `${gramosFinales} g`,
              gramos: gramosFinales,
              equivalencia_cocido: cocido,
              comidas_sugeridas: slots,
              alergenos,
              apto,
              notas: notas.trim() || undefined,
              equivale: compuesto
                ? (Object.fromEntries(
                    Object.entries(equivale).filter(([, v]) => (v ?? 0) > 0),
                  ) as Partial<Record<ExchangeGroupId, number>>)
                : undefined,
            })
          }
        >
          {inicial ? 'Guardar cambios' : 'Añadir a la base de datos'}
        </Button>
      </div>
      {!puedeGuardar ? (
        <p className="text-right text-[11px] text-slate-400">
          Hacen falta el nombre y, si lleva subgrupo, el macro que define la porción.
        </p>
      ) : (
        esLibre && (
          <p className="text-right text-[11px] text-slate-500">
            Sin subgrupo se guarda como alimento libre: no gasta intercambios y en las recetas
            saldrá «al gusto». Es lo que son la canela, el vinagre o el café.
          </p>
        )
      )}
    </div>
  );
}
