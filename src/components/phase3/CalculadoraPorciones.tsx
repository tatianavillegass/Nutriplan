import { useMemo, useState } from 'react';
import type { Alimento, Nutrientes100 } from '../../types/food';
import type { ExchangeGroupId } from '../../data/exchangeGroups';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import { hcNeto } from '../../utils/portions';
import { snapHalf } from '../../utils/macros';
import { uid } from '../../utils/storage';
import { Button, Input, fmt } from '../common/ui';

interface Props {
  /** Comidas del día, para poder decir en cuál se lo comió. */
  comidas: { id: string; nombre: string }[];
  onAnadir: (alimento: Alimento, mealId: string) => void;
}

/** Gramos del macro que hacen una porción. */
const POR_PORCION = { carbohidrato: 14, proteina: 7, grasa: 5 } as const;

/** El grupo con el que se representa cada macro al contarlo. */
const REPRESENTA: Record<keyof typeof POR_PORCION, ExchangeGroupId> = {
  carbohidrato: 'almidones',
  proteina: 'proteicos_magros',
  grasa: 'grasas',
};

const porciones = (n: number): string => {
  const entero = Math.floor(n + 0.001);
  const media = n - entero >= 0.4;
  if (!media) return String(entero);
  return entero === 0 ? '½' : `${entero}½`;
};

/**
 * ¿A CUÁNTO EQUIVALE ESTO?
 *
 * Para lo que no está en la despensa: la granola del armario, unas galletas,
 * un bote que trae etiqueta. Se copian los datos por 100 g, se dice cuánto se
 * ha comido, y sale traducido a porciones del plan.
 *
 * No es para comer fuera —ahí no hay etiqueta que leer y el número sería
 * inventado— sino para lo envasado, donde el dato es real. De paso enseña el
 * sistema: «tus 40 g de granola son 1½ almidón y 1 grasa».
 */
export function CalculadoraPorciones({ comidas, onAnadir }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [n, setN] = useState<Nutrientes100>({ hc: 0, proteina: 0, grasa: 0 });
  const [gramos, setGramos] = useState(100);
  const [mealId, setMealId] = useState(comidas[0]?.id ?? '');

  /** Lo que aporta de verdad esa cantidad, ya con la fibra descontada. */
  const aporta = useMemo(() => {
    const f = gramos / 100;
    return {
      carbohidrato: hcNeto(n) * f,
      proteina: (n.proteina || 0) * f,
      grasa: (n.grasa || 0) * f,
    };
  }, [n, gramos]);

  /**
   * En porciones, redondeadas a medias. Por debajo de un cuarto no se cuenta:
   * los 2 g de proteína de una galleta no son media porción de nada.
   */
  const enPorciones = useMemo(() => {
    const out: Partial<Record<ExchangeGroupId, number>> = {};
    for (const macro of ['carbohidrato', 'proteina', 'grasa'] as const) {
      const p = snapHalf(aporta[macro] / POR_PORCION[macro]);
      if (p >= 0.5) out[REPRESENTA[macro]] = p;
    }
    return out;
  }, [aporta]);

  const kcal = aporta.carbohidrato * 4 + aporta.proteina * 4 + aporta.grasa * 9;
  const hayAlgo = Object.keys(enPorciones).length > 0;
  const setNut = (k: keyof Nutrientes100, v: string) =>
    setN((p) => ({ ...p, [k]: v === '' ? undefined : Number(v) }) as Nutrientes100);

  const anadir = () => {
    const alimento: Alimento = {
      id: uid('mio_'),
      nombre: nombre.trim() || 'Alimento calculado',
      grupo: (Object.keys(enPorciones)[0] as ExchangeGroupId) ?? 'almidones',
      bucket: 'carbohidrato',
      medida_casera: `${gramos} g`,
      gramos,
      intercambios: 1,
      equivale: enPorciones,
      nutrientes: n,
      comidas_sugeridas: [],
      alergenos: [],
      apto: [],
      custom: true,
    } as unknown as Alimento;

    onAnadir(alimento, mealId);
    setAbierto(false);
    setNombre('');
    setN({ hc: 0, proteina: 0, grasa: 0 });
    setGramos(100);
  };

  /*
    CERRADA, PERO QUE SE VEA
    ================================================================
    Era un botón fino y gris al final de la pantalla y no lo encontraba nadie.
    Sigue en el mismo sitio —es una consulta puntual, no parte del día— pero
    ahora ocupa el ancho, dice para qué sirve y da un ejemplo. Quien no lo
    necesite lo salta igual: no pide nada ni ocupa más de tres líneas.
  */
  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 text-left transition hover:border-brand-300 hover:bg-brand-50 no-print"
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm text-brand-700"
          >
            ⚖️
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-brand-800">
              ¿A cuánto equivale un alimento?
            </span>
            <span className="block text-[11px] leading-snug text-slate-600">
              Copia la etiqueta de lo que sea —granola, unas galletas, un bote del armario— y te
              digo cuántas porciones de tu plan son.
            </span>
          </span>
        </span>
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-brand-200 bg-white p-4 no-print">
      <h3 className="text-sm font-bold tracking-wide text-brand-800 uppercase">
        ¿A cuánto equivale?
      </h3>
      <p className="mt-1 mb-3 text-xs leading-snug text-slate-600">
        Copia los datos de la etiqueta y di cuánto has comido. Te lo traduce a porciones de tu
        plan.
      </p>

      <Input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Qué es: granola, galletas…"
        className="mb-2 w-full text-sm"
      />

      <p className="mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
        Por 100 g, según la etiqueta
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ['hc', 'Carbohidr.'],
            ['proteina', 'Proteína'],
            ['grasa', 'Grasa'],
            ['fibra', 'Fibra'],
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

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-0.5 block text-[10px] text-slate-500">Cuánto has comido</span>
          <Input
            type="number"
            min="1"
            value={gramos}
            onChange={(e) => setGramos(Number(e.target.value) || 0)}
            className="w-24 text-sm"
          />
        </label>
        <span className="pb-2 text-xs text-slate-400">g</span>

        {comidas.length > 1 && (
          <label className="block">
            <span className="mb-0.5 block text-[10px] text-slate-500">En qué comida</span>
            <select
              value={mealId}
              onChange={(e) => setMealId(e.target.value)}
              className="rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-400"
            >
              {comidas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* ── El resultado ──────────────────────────────────── */}
      <div className="mt-3 rounded-lg bg-slate-50 p-3">
        <p className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
          Tus {gramos} g aportan
        </p>
        {hayAlgo ? (
          <>
            <p className="tnum mt-1 text-sm text-slate-800">
              {(Object.entries(enPorciones) as [ExchangeGroupId, number][])
                .map(([g, p]) => `${porciones(p)} ${EXCHANGE_GROUPS[g].nombre.toLowerCase()}`)
                .join(' + ')}
            </p>
            <p className="tnum mt-0.5 text-[11px] text-slate-500">
              {fmt(kcal)} kcal · HC {fmt(aporta.carbohidrato, 1)} · P{' '}
              {fmt(aporta.proteina, 1)} · G {fmt(aporta.grasa, 1)} g
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs text-slate-500">
            Con esos datos no llega a media porción de nada. Rellena la etiqueta y los gramos.
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => setAbierto(false)}>
          Cerrar
        </Button>
        <Button onClick={anadir} disabled={!hayAlgo || !mealId}>
          Añadirlo a mi día
        </Button>
      </div>
    </section>
  );
}
