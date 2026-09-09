import { useState } from 'react';
import type { RegistroDia } from '../../types/diary';
import {
  CAMPOS,
  CAMPOS_BIO,
  evolucionDe,
  fotosDe,
  medidasDe,
  semanasDePeso,
  tendenciaDePeso,
  ultimasMedidas,
} from '../../utils/misMedidas';
import { fmt } from '../common/ui';

interface Props {
  registros: RegistroDia[];
}

const ANGULOS = [
  { id: 'frente', nombre: 'frente' },
  { id: 'perfil', nombre: 'perfil' },
  { id: 'espalda', nombre: 'espalda' },
] as const;

const fechaCorta = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

/**
 * LO QUE SE HA MEDIDO ELLA
 *
 * Es la planilla que le mandabas por correo, ya rellena y sin tener que pedirla.
 * Vive en Seguimiento y no en Antropometría a propósito: **son dos cosas que no
 * se comparan**. Tus pliegues los tomas tú con el mismo plicómetro y la misma
 * mano; su cinta métrica en el baño de su casa es otra medida, útil para ver
 * hacia dónde va pero no para mezclar con la tuya.
 *
 * SE ENSEÑA LO ÚLTIMO, EL CAMBIO Y EL DÍA UNO
 * ===========================================
 * Es la columna «Diferencia» de su planilla, que es lo que de verdad se mira.
 * El número suelto no dice nada, y las dos referencias cuentan cosas distintas:
 * «esta semana ha subido medio kilo» y «desde que empezamos van cuatro menos».
 * Un mal día se ve en la primera y no toca la segunda.
 *
 * Y DEL PESO, LA MEDIA DE LA SEMANA
 * =================================
 * El peso de un día son dos kilos de agua y de lo que quedó de la cena. La
 * tendencia no se dice hasta que hay dos semanas.
 */
export function MedidasDeLaClienta({ registros }: Props) {
  const [historico, setHistorico] = useState(false);

  const medidas = medidasDe(registros);
  if (!medidas.length) return null;

  const evolucion = evolucionDe(medidas);
  const ultimas = ultimasMedidas(medidas);
  const semanas = semanasDePeso(medidas);
  const tendencia = tendenciaDePeso(medidas);
  const conFoto = fotosDe(medidas);
  const ultima = medidas[medidas.length - 1];
  const bio = CAMPOS_BIO.filter((c) => ultimas.bioimpedancia?.[c.id] != null);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">Lo que se ha medido ella</h3>
        <span className="text-[11px] text-slate-400">
          Última: {fechaCorta(ultima.fecha)} · {medidas.length}{' '}
          {medidas.length === 1 ? 'toma' : 'tomas'}
        </span>
      </div>

      {ultima.nota && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-snug text-amber-900">
          «{ultima.nota}»
        </p>
      )}

      <table className="mt-3 w-full text-left text-sm">
        <thead>
          <tr className="text-[10px] tracking-wide text-slate-400 uppercase">
            <th className="py-1 pr-2 font-medium">Medida</th>
            <th className="py-1 pr-2 text-right font-medium">Ahora</th>
            <th className="py-1 pr-2 text-right font-medium">Desde la anterior</th>
            <th className="py-1 text-right font-medium">Desde el día 1</th>
          </tr>
        </thead>
        <tbody>
          {evolucion.map((e) => {
            const dec = e.campo.unidad === 'kg' ? 1 : 0;
            return (
              <tr key={e.campo.id} className="border-t border-slate-100">
                <td className="py-1 pr-2 text-slate-700">{e.campo.nombre}</td>
                <td className="tnum py-1 pr-2 text-right font-medium text-slate-800">
                  {fmt(e.ahora, dec)} {e.campo.unidad}
                </td>
                <td className="tnum py-1 pr-2 text-right text-xs text-slate-600">
                  {e.antes != null ? diferencia(e.ahora, e.antes, dec) : '—'}
                </td>
                <td className="tnum py-1 text-right text-xs text-slate-500">
                  {e.primero != null ? diferencia(e.ahora, e.primero, dec) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {semanas.length > 0 && (
        <p className="tnum mt-2 text-xs text-slate-600">
          Media de peso de la última semana: {fmt(semanas[semanas.length - 1].media, 1)} kg (
          {semanas[semanas.length - 1].dias}{' '}
          {semanas[semanas.length - 1].dias === 1 ? 'día' : 'días'})
          {tendencia && (
            <>
              {' · '}
              <strong className={tendencia.porSemana < 0 ? 'text-emerald-700' : 'text-slate-700'}>
                {tendencia.porSemana > 0 ? '+' : '−'}
                {fmt(Math.abs(tendencia.porSemana), 1)} kg/semana
              </strong>
            </>
          )}
        </p>
      )}

      {/*
        La báscula va aparte y sin comparar con nada: cada aparato usa su
        fórmula. Es la misma regla que ya rige en la antropometría.
      */}
      {bio.length > 0 && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Su báscula de bioimpedancia
          </p>
          <p className="tnum mt-0.5 text-sm text-slate-700">
            {bio
              .map((c) => `${c.nombre} ${fmt(ultimas.bioimpedancia![c.id]!, 1)}${c.unidad}`)
              .join(' · ')}
          </p>
          <p className="mt-1 text-[10px] leading-snug text-slate-500">
            Copiado tal cual de su aparato. No se compara con tus pliegues ni con otra báscula.
          </p>
        </div>
      )}

      {conFoto.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Sus fotos
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {conFoto.flatMap((m) =>
              ANGULOS.filter((a) => m.fotos?.[a.id]).map((a) => (
                <figure key={`${m.fecha}-${a.id}`} className="w-24 shrink-0">
                  <img
                    src={m.fotos![a.id]!}
                    alt={`${fechaCorta(m.fecha)} de ${a.nombre}`}
                    className="h-32 w-24 rounded-lg border border-slate-200 object-cover"
                  />
                  <figcaption className="mt-0.5 text-[9px] text-slate-500">
                    {fechaCorta(m.fecha)} · {a.nombre}
                  </figcaption>
                </figure>
              )),
            )}
          </div>
        </div>
      )}

      {medidas.length > 1 && (
        <>
          <button
            onClick={() => setHistorico((v) => !v)}
            className="mt-3 text-[11px] text-brand-700 hover:underline"
          >
            {historico ? 'Ocultar el histórico' : `Ver las ${medidas.length} tomas`}
          </button>
          {historico && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400">
                    <th className="py-1 pr-2 font-medium">Fecha</th>
                    {CAMPOS.map((c) => (
                      <th key={c.id} className="py-1 pr-2 font-medium">
                        {c.nombre.replace(/ \(.*\)/, '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...medidas].reverse().map((m) => (
                    <tr key={m.fecha} className="border-t border-slate-100">
                      <td className="py-1 pr-2 text-slate-600">{fechaCorta(m.fecha)}</td>
                      {CAMPOS.map((c) => (
                        <td key={c.id} className="tnum py-1 pr-2 text-slate-700">
                          {m[c.id] != null ? fmt(m[c.id]!, c.unidad === 'kg' ? 1 : 0) : '·'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

const diferencia = (ahora: number, antes: number, dec = 0) => {
  const d = ahora - antes;
  const minimo = dec ? 0.05 : 0.5;
  if (Math.abs(d) < minimo) return 'igual';
  return `${d > 0 ? '+' : '−'}${fmt(Math.abs(d), dec)}`;
};
