import { useMemo, useState } from 'react';
import type { Alimento, Nutrientes100 } from '../../types/food';
import type { Bocado } from '../../types/diary';
import { hcNeto } from '../../utils/portions';
import { macrosDeCantidad } from '../../utils/conteo';
import { suyoConEseNombre } from '../../utils/sinRepetidos';
import { kcalFromMacros } from '../../utils/macros';
import { uid } from '../../utils/storage';
import { FoodPicker } from '../food/FoodPicker';
import { NumeroConComa, aNumero } from '../common/NumeroConComa';
import { Button, Input, fmt } from '../common/ui';

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
export function AnadirBocado({
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
  const [cantidad, setCantidad] = useState('100');
  const [porEtiqueta, setPorEtiqueta] = useState(false);
  const [n, setN] = useState<Nutrientes100>({ hc: 0, proteina: 0, grasa: 0 });
  /**
   * Cambiar esto vuelve a montar el buscador, y con ello vuelve el foco a la
   * caja de búsqueda: tras apuntar la avena se puede escribir «plátano» sin
   * tocar nada.
   */
  const [vuelta, setVuelta] = useState(0);

  const food = foodId ? foods.find((f) => f.id === foodId) : undefined;

  /**
   * Del catálogo o de la etiqueta que acaba de copiar: se calcula igual.
   *
   * LAS KCAL SE DEDUCEN, SALVO QUE LAS COPIE
   * ========================================
   * Salen de los macros (4/4/9), así que no hay que teclearlas. Pero la
   * etiqueta trae su propio número y casi nunca es el mismo: los fabricantes
   * redondean, descuentan la fibra a su manera y usan los factores de Atwater
   * por alimento. Si lo escribe, manda el suyo — está copiando un bote, no
   * resolviendo una cuenta.
   */
  const deEtiqueta = useMemo(() => {
    const f = (aNumero(cantidad) ?? 0) / 100;
    const macros = {
      proteina: (n.proteina || 0) * f,
      hc: hcNeto(n) * f,
      grasa: (n.grasa || 0) * f,
    };
    return { macros, kcal: n.kcal ? n.kcal * f : kcalFromMacros(macros) };
  }, [n, cantidad]);

  /** Lo que saldría de los macros, para avisar si no cuadra con la etiqueta. */
  const kcalDeLosMacros = kcalFromMacros({
    proteina: n.proteina || 0,
    hc: hcNeto(n),
    grasa: n.grasa || 0,
  });
  const kcalNoCuadran =
    !!n.kcal && kcalDeLosMacros > 0 && Math.abs(n.kcal - kcalDeLosMacros) > kcalDeLosMacros * 0.15;

  const gramos = aNumero(cantidad) ?? 0;
  const calculado = porEtiqueta ? deEtiqueta : macrosDeCantidad(gramos, food);
  const listo = gramos > 0 && (porEtiqueta ? !!nombre.trim() && calculado.kcal > 0 : !!food);

  const limpiar = () => {
    setFoodId(undefined);
    setNombre('');
    setCantidad('100');
    setPorEtiqueta(false);
    setN({ hc: 0, proteina: 0, grasa: 0 });
    setVuelta((v) => v + 1);
  };

  const anadir = () => {
    if (!listo) return;
    const etiqueta = (food?.nombre ?? nombre).trim();

    /*
     * SI YA SE CALCULÓ ESTE MISMO, SE REESCRIBE EL SUYO
     *
     * Cada vez que se usaba la etiqueta nacía un alimento con id nuevo, así que
     * calcular «yogur griego de mi marca» el lunes y el jueves le dejaba dos
     * iguales en el buscador para siempre. Se reutiliza el **suyo** —nunca uno
     * del catálogo, que ése lleva los macros que puso la nutricionista— y se
     * conserva su id, para que lo que marcó con él hace un mes siga en pie.
     */
    /** El alimento nuevo se guarda para poder volver a usarlo hoy mismo. */
    const nuevo: Alimento | undefined = porEtiqueta
      ? ({
          id: suyoConEseNombre(foods, etiqueta)?.id ?? uid('mio_'),
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
        cantidad: gramos,
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
            setCantidad(String(f.gramos || 100));
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
          <p className="mb-1 text-[10px] text-slate-400">
            Las calorías salen solas de los macros. Cópialas si quieres las del bote.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(
              [
                ['kcal', 'Calorías'],
                ['proteina', 'Proteína'],
                ['hc', 'Carbohidr.'],
                ['grasa', 'Grasa'],
                ['fibra', 'Fibra'],
              ] as [keyof Nutrientes100, string][]
            ).map(([k, label]) => (
              <label key={k} className="block">
                <span className="mb-0.5 block text-[10px] text-slate-500">{label}</span>
                <NumeroConComa
                  numero={n[k]}
                  onNumero={(v) => setN((p) => ({ ...p, [k]: v }) as Nutrientes100)}
                  cero
                  className="w-full text-sm"
                  aria-label={label}
                />
              </label>
            ))}
          </div>
          {kcalNoCuadran && (
            <p className="mt-1.5 text-[11px] text-amber-700">
              La etiqueta pone {fmt(n.kcal as number)} kcal y de los macros salen{' '}
              {fmt(kcalDeLosMacros)}. Se usan las de la etiqueta; si no era eso, revisa algún dato.
            </p>
          )}
        </>
      )}

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-0.5 block text-[10px] text-slate-500">Cuánto</span>
          <NumeroConComa
            value={cantidad}
            onChange={setCantidad}
            className="w-24 text-sm"
            aria-label="Cuánto has comido"
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
