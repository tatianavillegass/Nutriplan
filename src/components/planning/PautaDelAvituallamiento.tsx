import { useState } from 'react';
import type { Alimento } from '../../types/food';
import type { Avituallamiento, TomaPautada } from '../../types/plan';
import {
  gramosDeLaPauta,
  gramosDelAvituallamiento,
  hcDeUnaMedida,
  minutoLegible,
  minutosDeLaSesion,
  proponerPauta,
} from '../../utils/avituallamiento';
import { Button, Input, Select, fmt } from '../common/ui';

interface Props {
  avituallamiento: Avituallamiento;
  /** Las fuentes de la despensa de esa comida. */
  fuentes: Alimento[];
  onChange: (a: Avituallamiento) => void;
}

/**
 * EL RELOJ: QUÉ Y CUÁNDO
 *
 * En bici se elige sobre la marcha —lo que apetece, lo que se lleva en el
 * maillot— y por eso el avituallamiento normal es un objetivo en gramos y ya.
 * Corriendo no funciona: quien no lleva pautado el **cuándo** o se toma los
 * tres geles en la última media hora o no se toma ninguno.
 *
 * ES OPCIONAL, Y ESA ES LA GRACIA
 * ===============================
 * Sin pauta, la clienta sigue sumando lo que quiera hasta llegar a los gramos.
 * Con pauta, ve qué y cuándo. Una sola pantalla sirve para los dos deportes
 * porque es la misma regla de las combinaciones de fase 2: lo que se pauta
 * manda, y lo que no se pauta lo elige quien come.
 *
 * SE PROPONE Y SE RETOCA
 * ======================
 * Los gramos y la duración ya están escritos arriba, así que repartir las tomas
 * es una división — el paso que ella hacía con la calculadora. Se propone y
 * después se mueve lo que haga falta: en una cuesta no se come igual.
 */
export function PautaDelAvituallamiento({ avituallamiento, fuentes, onChange }: Props) {
  const pauta = avituallamiento.pauta ?? [];
  const [conQue, setConQue] = useState(fuentes[0]?.id ?? '');
  const [porToma, setPorToma] = useState('1');

  const minutos = minutosDeLaSesion(avituallamiento);
  const objetivo = gramosDelAvituallamiento(avituallamiento);
  const puesto = gramosDeLaPauta(pauta, fuentes);

  const guardar = (nueva: TomaPautada[]) =>
    onChange({
      ...avituallamiento,
      /* Vacía se borra: así «sin pauta» y «pauta de cero tomas» son lo mismo. */
      pauta: nueva.length ? [...nueva].sort((a, b) => a.minuto - b.minuto) : undefined,
    });

  const proponer = () => {
    const food = fuentes.find((f) => f.id === conQue);
    if (!food) return;
    guardar(proponerPauta(avituallamiento, food, Number(porToma) || 1));
  };

  if (!fuentes.length)
    return (
      <p className="mt-3 text-[11px] leading-snug text-amber-700">
        Para pautar las tomas hacen falta fuentes en la despensa de esta comida: añade abajo los
        geles, la isotónica o los dátiles que vaya a llevar.
      </p>
    );

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
      <p className="text-xs font-medium text-slate-700">Qué y cuándo (opcional)</p>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
        Déjalo vacío en bici: ahí elige ella sobre la marcha. Rellénalo corriendo, que es donde
        importa el reloj.
      </p>

      {!minutos && (
        <p className="mt-2 text-[11px] leading-snug text-amber-700">
          Pon antes la duración de la sesión: sin ella no hay dónde repartir las tomas.
        </p>
      )}

      {minutos && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-0.5 block text-[10px] text-slate-500">Con qué</span>
            <Select
              value={conQue}
              onChange={(e) => setConQue(e.target.value)}
              className="w-48 text-xs"
            >
              {fuentes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre} ({fmt(hcDeUnaMedida(f))} g)
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[10px] text-slate-500">Por toma</span>
            <Input
              value={porToma}
              onChange={(e) => setPorToma(e.target.value)}
              inputMode="numeric"
              className="w-16 text-xs"
            />
          </label>
          <Button onClick={proponer} className="text-xs">
            {pauta.length ? 'Rehacer' : 'Repartir'}
          </Button>
        </div>
      )}

      {pauta.length > 0 && (
        <>
          <ul className="mt-3 space-y-1.5">
            {pauta.map((t, i) => (
              <Fila
                key={`${t.minuto}-${t.foodId}-${i}`}
                toma={t}
                fuentes={fuentes}
                onChange={(nueva) =>
                  guardar(pauta.map((x, j) => (j === i ? nueva : x)))
                }
                onQuitar={() => guardar(pauta.filter((_, j) => j !== i))}
              />
            ))}
          </ul>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={() =>
                guardar([
                  ...pauta,
                  {
                    minuto: (pauta[pauta.length - 1]?.minuto ?? 0) + 20,
                    foodId: conQue || fuentes[0].id,
                    unidades: 1,
                  },
                ])
              }
              className="text-[11px] text-brand-700 hover:underline"
            >
              + Añadir una toma
            </button>

            {/*
              Lo pautado en el reloj tiene que cuadrar con los gramos de arriba.
              No se bloquea —redondear geles no da nunca el número exacto— pero
              si falta medio gel se dice, que si no se descubre en carrera.
            */}
            <span
              className={`tnum text-[11px] ${
                Math.abs(puesto - objetivo) <= 10 ? 'text-slate-500' : 'text-amber-700'
              }`}
            >
              {fmt(puesto)} g repartidos de {fmt(objetivo)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Fila({
  toma,
  fuentes,
  onChange,
  onQuitar,
}: {
  toma: TomaPautada;
  fuentes: Alimento[];
  onChange: (t: TomaPautada) => void;
  onQuitar: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      <Input
        value={String(toma.minuto)}
        onChange={(e) => onChange({ ...toma, minuto: Number(e.target.value) || 0 })}
        inputMode="numeric"
        className="w-16 text-xs"
        aria-label="Minuto"
      />
      <span className="w-10 text-[10px] text-slate-400">{minutoLegible(toma.minuto)}</span>
      <Input
        value={String(toma.unidades)}
        onChange={(e) => onChange({ ...toma, unidades: Number(e.target.value) || 1 })}
        inputMode="numeric"
        className="w-12 text-xs"
        aria-label="Unidades"
      />
      <Select
        value={toma.foodId}
        onChange={(e) => onChange({ ...toma, foodId: e.target.value })}
        className="min-w-0 flex-1 text-xs"
        aria-label="Qué toma"
      >
        {fuentes.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nombre}
          </option>
        ))}
      </Select>
      <button
        onClick={onQuitar}
        aria-label={`Quitar la toma del minuto ${toma.minuto}`}
        className="px-1 text-xs text-slate-400 hover:text-red-600"
      >
        ×
      </button>
    </li>
  );
}
