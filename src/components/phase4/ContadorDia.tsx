import { useEffect, useMemo, useRef, useState } from 'react';
import type { Alimento, Nutrientes100 } from '../../types/food';
import type { Bocado } from '../../types/diary';
import type { DayType } from '../../types/plan';
import {
  bocadosPorComida,
  comoVaElDia,
  estadoDeConteo,
  macrosDeCantidad,
  objetivoDelDia,
  totalContado,
  type EstadoConteo,
} from '../../utils/conteo';
import { kcalFromMacros } from '../../utils/macros';
import { hcNeto } from '../../utils/portions';
import { uid } from '../../utils/storage';
import { FoodPicker } from '../food/FoodPicker';
import { Button, Input, fmt } from '../common/ui';

interface Props {
  dayType: DayType;
  bocados: Bocado[];
  foods: Alimento[];
  onAnadir: (bocado: Bocado, alimentoNuevo?: Alimento) => void;
  onQuitar: (id: string) => void;
  /**
   * Los atajos de cada comida —repetir lo de siempre, sus comidas guardadas—.
   * Se pinta desde fuera porque quien sabe de sus otros días es la pantalla,
   * no el contador.
   */
  atajosDe?: (mealId: string) => React.ReactNode;
  /** En la pantalla de la nutricionista sólo se mira. */
  soloLectura?: boolean;
}

const COLOR: Record<EstadoConteo, string> = {
  falta: 'text-amber-700',
  enPunto: 'text-emerald-700',
  pasado: 'text-rose-700',
};

const BARRA: Record<EstadoConteo, string> = {
  falta: 'bg-amber-500',
  enPunto: 'bg-emerald-500',
  pasado: 'bg-rose-500',
};

/** Una cifra del día: lo que llevas, de lo que te has pautado. */
function Cifra({
  titulo,
  llevas,
  objetivo,
  unidad,
  grande = false,
}: {
  titulo: string;
  llevas: number;
  objetivo: number;
  unidad: string;
  grande?: boolean;
}) {
  const estado = estadoDeConteo(llevas, objetivo);
  const pct = objetivo > 0 ? Math.min(100, (llevas / objetivo) * 100) : 0;

  return (
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">{titulo}</p>
      <p className={`tnum ${grande ? 'text-2xl' : 'text-lg'} font-bold ${COLOR[estado]}`}>
        {fmt(llevas)}
        <span className="text-sm font-normal text-slate-400">
          {' '}
          / {fmt(objetivo)} {unidad}
        </span>
      </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${BARRA[estado]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * EL CONTADOR DEL DÍA (FASE 4)
 *
 * La última fase: los mismos macros de siempre, en gramos. Arriba lo que
 * llevas del día y debajo lo que has apuntado, sin comidas de por medio —
 * quien llega aquí ya sabe repartirlas.
 *
 * Lo que se enseña es **lo que llevas**, nunca lo que te queda. Un número que
 * baja hasta cero y se pone en rojo convierte cenar en un descubierto, y esa
 * es justamente la parte de contar macros que hace daño a quien tiene mala
 * relación con la comida.
 */
export function ContadorDia({
  dayType,
  bocados,
  foods,
  onAnadir,
  onQuitar,
  atajosDe,
  soloLectura = false,
}: Props) {
  const objetivo = useMemo(() => objetivoDelDia(dayType), [dayType]);
  const total = useMemo(() => totalContado(bocados), [bocados]);
  const hayAlgo = bocados.length > 0;

  /** Qué comida tiene el formulario abierto. Sólo una a la vez. */
  const [anadiendo, setAnadiendo] = useState<string | null>(null);

  /**
   * EL BUSCADOR SE QUEDA ABIERTO Y SE CIERRA TOCANDO FUERA
   *
   * Un desayuno son cuatro o cinco cosas. Cerrando el formulario tras cada una
   * había que volver a pulsar «añadir» cinco veces para apuntar una tostada.
   * Ahora se queda listo para lo siguiente y se cierra al tocar en cualquier
   * otro sitio, que es lo que hace la mano sola cuando ha terminado.
   *
   * La caja escuchada es la comida entera, no sólo el formulario: si fuera
   * sólo el formulario, su propio botón de «Cerrar» contaría como tocar fuera
   * y se volvería a abrir en el mismo gesto.
   */
  const cajaAbierta = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anadiendo) return;
    const tocarFuera = (e: MouseEvent | TouchEvent) => {
      if (!cajaAbierta.current?.contains(e.target as Node)) setAnadiendo(null);
    };
    document.addEventListener('mousedown', tocarFuera);
    document.addEventListener('touchstart', tocarFuera);
    return () => {
      document.removeEventListener('mousedown', tocarFuera);
      document.removeEventListener('touchstart', tocarFuera);
    };
  }, [anadiendo]);

  const porComida = useMemo(
    () => bocadosPorComida(dayType.meals, bocados),
    [dayType.meals, bocados],
  );

  return (
    <section className="rounded-2xl border border-brand-200 bg-white p-4 no-print sm:p-5">
      <h2 className="text-sm font-bold tracking-wide text-brand-800 uppercase">Lo que llevas hoy</h2>

      <div className="mt-3 flex flex-wrap gap-4">
        <Cifra titulo="Calorías" llevas={total.kcal} objetivo={objetivo.kcal} unidad="kcal" grande />
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        <Cifra titulo="Proteína" llevas={total.proteina} objetivo={objetivo.proteina} unidad="g" />
        <Cifra titulo="Carbohidrato" llevas={total.hc} objetivo={objetivo.hc} unidad="g" />
        <Cifra titulo="Grasa" llevas={total.grasa} objetivo={objetivo.grasa} unidad="g" />
      </div>

      <p className="mt-3 text-xs leading-snug text-slate-600">
        {comoVaElDia(total, objetivo, hayAlgo)}
      </p>

      {/*
        LO APUNTADO, POR COMIDAS
        ==============================================================
        El día se juzga entero —lo que manda es el total de arriba— pero la
        lista va por comidas: en una lista corrida hay que acordarse de qué has
        metido ya, y por comidas se ve de un vistazo que falta la cena.

        Cada comida tiene su propio «añadir», así que no hay que decir en un
        desplegable dónde va lo que acabas de comer: se apunta donde se mira.
      */}
      <div className="mt-4 space-y-1">
        {porComida.map(({ meal, bocados: suyos, total: suTotal }) => (
          <div
            key={meal.id}
            ref={anadiendo === meal.id ? cajaAbierta : undefined}
            className="border-t border-slate-100 pt-2"
          >
            <div className="flex items-baseline gap-2">
              <span className="flex-1 text-xs font-semibold text-brand-800">{meal.nombre}</span>
              <span className="tnum text-[11px] text-slate-500">
                {suyos.length ? `${fmt(suTotal.kcal)} kcal` : ''}
              </span>
              {!soloLectura && (
                <button
                  onClick={() => setAnadiendo(anadiendo === meal.id ? null : meal.id)}
                  aria-expanded={anadiendo === meal.id}
                  className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                    anadiendo === meal.id
                      ? 'border-brand-400 bg-brand-50 text-brand-900'
                      : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700'
                  }`}
                >
                  {anadiendo === meal.id ? 'Cerrar' : `Añadir a ${meal.nombre.toLowerCase()}`}
                </button>
              )}
            </div>

            {!soloLectura && atajosDe?.(meal.id)}

            {suyos.length > 0 && (
              <ul className="mt-0.5 divide-y divide-slate-50">
                {suyos.map((b) => (
                  <li key={b.id} className="flex items-baseline gap-2 py-1 text-xs">
                    <span className="min-w-0 flex-1 text-slate-700">
                      {b.nombre}
                      <span className="tnum ml-1 text-slate-400">
                        {fmt(b.cantidad)} {b.unidad ?? 'g'}
                      </span>
                    </span>
                    <span className="tnum hidden shrink-0 text-slate-500 sm:inline">
                      P {fmt(b.macros.proteina)} · HC {fmt(b.macros.hc)} · G {fmt(b.macros.grasa)}
                    </span>
                    <span className="tnum w-16 shrink-0 text-right text-slate-700">
                      {fmt(b.kcal)} kcal
                    </span>
                    {!soloLectura && (
                      <button
                        onClick={() => onQuitar(b.id)}
                        className="text-slate-300 transition hover:text-rose-600"
                        aria-label={`Quitar ${b.nombre}`}
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {anadiendo === meal.id && (
              <AnadirBocado foods={foods} momento={meal.id} onAnadir={onAnadir} />
            )}
          </div>
        ))}
      </div>

      {!hayAlgo && (
        <p className="mt-3 text-xs text-slate-400">
          {soloLectura ? 'No ha apuntado nada todavía.' : 'Lo que vayas apuntando sale aquí.'}
        </p>
      )}
    </section>
  );
}

/**
 * AÑADIR LO QUE HAS COMIDO
 *
 * Se busca el alimento y se ponen los gramos: los macros salen de tu catálogo,
 * que es el mismo con el que se hizo el plan, así que las cuentas siguen
 * cuadrando con lo pautado.
 *
 * Si no está en la lista, se copia la etiqueta una vez y queda guardado para
 * el resto del día. Sin esta salida, un yogur de una marca concreta obligaba a
 * dejar el día a medias.
 */
function AnadirBocado({
  foods,
  momento,
  onAnadir,
}: {
  foods: Alimento[];
  /** La comida desde la que se ha abierto: se apunta ahí sin preguntar. */
  momento: string;
  onAnadir: (bocado: Bocado, alimentoNuevo?: Alimento) => void;
}) {
  const [foodId, setFoodId] = useState<string | undefined>();
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState(100);
  const [porEtiqueta, setPorEtiqueta] = useState(false);
  const [n, setN] = useState<Nutrientes100>({ hc: 0, proteina: 0, grasa: 0 });
  /**
   * Cambiar esto vuelve a montar el buscador, y con ello vuelve el foco a la
   * caja de búsqueda: tras apuntar la avena se puede escribir «plátano» sin
   * tocar nada.
   */
  const [vuelta, setVuelta] = useState(0);

  const food = foodId ? foods.find((f) => f.id === foodId) : undefined;

  /** Del catálogo o de la etiqueta que acaba de copiar: se calcula igual. */
  const deEtiqueta = useMemo(() => {
    const f = cantidad / 100;
    const macros = {
      proteina: (n.proteina || 0) * f,
      hc: hcNeto(n) * f,
      grasa: (n.grasa || 0) * f,
    };
    return { macros, kcal: kcalFromMacros(macros) };
  }, [n, cantidad]);

  const calculado = porEtiqueta ? deEtiqueta : macrosDeCantidad(cantidad, food);
  const listo = cantidad > 0 && (porEtiqueta ? !!nombre.trim() && calculado.kcal > 0 : !!food);

  const limpiar = () => {
    setFoodId(undefined);
    setNombre('');
    setCantidad(100);
    setPorEtiqueta(false);
    setN({ hc: 0, proteina: 0, grasa: 0 });
    setVuelta((v) => v + 1);
  };

  const anadir = () => {
    if (!listo) return;
    const etiqueta = (food?.nombre ?? nombre).trim();

    /** El alimento nuevo se guarda para poder volver a usarlo hoy mismo. */
    const nuevo: Alimento | undefined = porEtiqueta
      ? ({
          id: uid('mio_'),
          nombre: etiqueta,
          medida_casera: '100 g',
          gramos: 100,
          intercambios: 1,
          nutrientes: n,
          comidas_sugeridas: [],
          alergenos: [],
          apto: [],
          custom: true,
        } as unknown as Alimento)
      : undefined;

    onAnadir(
      {
        id: uid('bo_'),
        nombre: etiqueta,
        foodId: nuevo?.id ?? foodId,
        cantidad,
        unidad: food?.unidad ?? 'g',
        macros: calculado.macros,
        kcal: calculado.kcal,
        momento,
        hora: new Date().toISOString().slice(11, 16),
      },
      nuevo,
    );
    limpiar();
  };

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      {!porEtiqueta ? (
        <FoodPicker
          key={vuelta}
          foods={foods}
          value={foodId}
          nombreLibre={nombre}
          placeholder="Qué has comido: pollo, avena, yogur…"
          autoFocus
          onSelect={(f) => {
            setFoodId(f.id);
            setNombre(f.nombre);
            setCantidad(f.gramos || 100);
          }}
          onLibre={(t) => {
            setNombre(t);
            setFoodId(undefined);
          }}
        />
      ) : (
        <>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Qué es: yogur de tal marca, barrita…"
            className="w-full text-sm"
          />
          <p className="mt-2 mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Por 100 g, según la etiqueta
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ['proteina', 'Proteína'],
                ['hc', 'Carbohidr.'],
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
                  onChange={(e) =>
                    setN(
                      (p) =>
                        ({
                          ...p,
                          [k]: e.target.value === '' ? undefined : Number(e.target.value),
                        }) as Nutrientes100,
                    )
                  }
                  className="w-full text-sm"
                />
              </label>
            ))}
          </div>
        </>
      )}

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-0.5 block text-[10px] text-slate-500">Cuánto</span>
          <Input
            type="number"
            min="1"
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value) || 0)}
            className="w-24 text-sm"
          />
        </label>
        <span className="pb-2 text-xs text-slate-400">{food?.unidad ?? 'g'}</span>

        <p className="tnum min-w-0 flex-1 pb-2 text-[11px] text-slate-600">
          {listo ? (
            <>
              {fmt(calculado.kcal)} kcal · P {fmt(calculado.macros.proteina)} · HC{' '}
              {fmt(calculado.macros.hc)} · G {fmt(calculado.macros.grasa)} g
            </>
          ) : (
            'Busca el alimento y pon los gramos.'
          )}
        </p>

        <Button onClick={anadir} disabled={!listo}>
          Añadir
        </Button>
      </div>

      <button
        onClick={() => {
          setPorEtiqueta((v) => !v);
          setFoodId(undefined);
        }}
        className="mt-1 text-[11px] text-brand-700 underline hover:text-brand-900"
      >
        {porEtiqueta ? 'Buscarlo en la lista' : '¿No está en la lista? Copia su etiqueta'}
      </button>
    </div>
  );
}
