import { useState } from 'react';
import type { MedidasDelDia, RegistroDia } from '../../types/diary';
import type { Bioimpedancia, Medicion } from '../../types/anthropometry';
import type { Preparacion } from '../../utils/preparacion';
import {
  CAMPOS,
  CAMPOS_BIO,
  evolucionDe,
  historialDeMedidas,
  semanasDePeso,
  tendenciaDePeso,
  tieneAlgo,
  tomasConFoto,
  type Evolucion,
} from '../../utils/misMedidas';
import { EvolucionDeMedidas } from './EvolucionDeMedidas';
import { ComparaFotos } from './ComparaFotos';
import { prepararFoto } from '../../utils/imagen';
import { Button, fmt } from '../common/ui';
import { NumeroConComa, aNumero } from '../common/NumeroConComa';

interface Props {
  registros: RegistroDia[];
  /**
   * Lo que ha apuntado su nutricionista: las primeras medidas, que se las
   * manda ella antes de la primera consulta, y cualquier otra toma que le
   * llegue por mensaje. Entran en la misma línea del tiempo.
   */
  mediciones?: Medicion[];
  /** Lo que se midió y la foto que subió antes de empezar. */
  preparacion: Preparacion;
  /** Lo de hoy, para poder corregirlo el mismo día. */
  deHoy?: MedidasDelDia;
  onGuardar: (medidas: MedidasDelDia) => void;
}

const ANGULOS = [
  { id: 'frente', nombre: 'De frente' },
  { id: 'perfil', nombre: 'De perfil' },
  { id: 'espalda', nombre: 'De espalda' },
] as const;

/**
 * TUS MEDIDAS
 *
 * A las presenciales las mide ella con el plicómetro. A las online se les
 * mandaba una planilla por correo, que se rellena una vez y se deja de
 * rellenar: hay que abrir el correo, buscar el archivo, encontrar la columna
 * del mes y acordarse de volver a mandarlo. Esto son los mismos campos de esa
 * planilla, pero en la app donde ya entra todos los días.
 *
 * LAS REFERENCIAS VAN ESCRITAS EN EL NOMBRE
 * =========================================
 * «Cintura (mínimo)», «Abdominal (máximo)». Una cinta puesta dos centímetros
 * más arriba inventa una bajada de un centímetro, que es justo la información
 * que esto viene a recoger. Si se mide cada semana, se lee cada semana.
 *
 * LO QUE SE ENSEÑA DEL PESO ES LA MEDIA DE LA SEMANA
 * ==================================================
 * El peso de un día son dos kilos de agua, sal y lo que quedó de la cena.
 * Enseñarlo tal cual convierte cualquier martes en un fracaso o en una
 * celebración, las dos igual de falsas. Y hasta que no hay dos semanas no se
 * dice nada de la tendencia.
 *
 * TODO ES OPCIONAL, Y ESO ES PARTE DEL DISEÑO
 * ===========================================
 * No se pide, no se recuerda y no rompe ninguna racha. Pesarse a diario le va
 * bien a quien no le da importancia y le hace daño a quien se la da.
 */
export function MisMedidas({
  registros,
  mediciones = [],
  preparacion,
  deHoy,
  onGuardar,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      CAMPOS.map((c) => [c.id, deHoy?.[c.id] != null ? String(deHoy[c.id]) : '']),
    ),
  );
  const [bio, setBio] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      CAMPOS_BIO.map((c) => [
        c.id,
        deHoy?.bioimpedancia?.[c.id] != null ? String(deHoy.bioimpedancia![c.id]) : '',
      ]),
    ),
  );
  const [fotos, setFotos] = useState(deHoy?.fotos ?? {});
  const [nota, setNota] = useState(deHoy?.nota ?? '');
  const [subiendo, setSubiendo] = useState<string | undefined>();

  const medidas = historialDeMedidas(mediciones as Medicion[], registros);
  const evolucion = evolucionDe(medidas);
  const semanas = semanasDePeso(medidas);
  const tendencia = tendenciaDePeso(medidas);
  const estaSemana = semanas[semanas.length - 1];
  const conFoto = tomasConFoto(medidas);

  /**
   * El punto de partida de antes de la app: lo que se midió en la cuenta atrás
   * de un reto, o la primera medición que le hiciera la nutricionista. Sólo se
   * usa mientras no haya apuntado nada ella.
   */
  const primera = [...mediciones].sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  const fotoDePartida = preparacion.foto ?? mediciones.find((m) => m.foto)?.foto;

  const ponerFoto = async (id: string, file: File | undefined) => {
    if (!file) return;
    setSubiendo(id);
    try {
      const lista = await prepararFoto(file);
      setFotos((f) => ({ ...f, [id]: lista }));
    } finally {
      setSubiendo(undefined);
    }
  };

  const guardar = () => {
    const bioLimpia: Bioimpedancia = {};
    for (const c of CAMPOS_BIO) {
      const n = aNumero(bio[c.id]);
      if (n != null) bioLimpia[c.id] = n;
    }
    const medidasDeHoy: MedidasDelDia = {
      ...Object.fromEntries(CAMPOS.map((c) => [c.id, aNumero(valores[c.id])])),
      ...(Object.keys(bioLimpia).length ? { bioimpedancia: bioLimpia } : {}),
      ...(fotos.frente || fotos.perfil || fotos.espalda ? { fotos } : {}),
      ...(nota.trim() ? { nota: nota.trim() } : {}),
    };
    onGuardar(medidasDeHoy);
    setAbierto(false);
  };

  return (
    <section className="rounded-2xl border border-brand-200 bg-white p-4 no-print sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold tracking-wide text-brand-800 uppercase">Tus medidas</h2>
        <button
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="rounded-lg border border-brand-200 px-2.5 py-1 text-[11px] font-medium text-brand-800 transition hover:bg-brand-50"
        >
          {abierto ? 'Cerrar' : 'Apuntar'}
        </button>
      </div>

      <p className="mt-1 text-xs leading-snug text-slate-600">
        Todo es opcional. Mídete siempre igual —al levantarte, después del baño y en ayunas— y
        mira la media de la semana, no el número de hoy.
      </p>

      {abierto && (
        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {CAMPOS.map((c) => (
              <label key={c.id} className="block">
                <span className="mb-0.5 block text-[10px] text-slate-500">
                  {c.nombre} ({c.unidad})
                </span>
                <NumeroConComa
                  value={valores[c.id] ?? ''}
                  onChange={(v) => setValores((s) => ({ ...s, [c.id]: v }))}
                  className="w-full text-sm"
                />
              </label>
            ))}
          </div>

          {/*
            LA BÁSCULA, EN SU BLOQUE
            Cada aparato usa su fórmula, así que su % de grasa no se puede
            comparar con el de unos pliegues ni con el de otra báscula. Va
            aparte y se copia tal cual, igual que en la antropometría.
          */}
          <details className="rounded-lg border border-slate-200 bg-white p-2">
            <summary className="cursor-pointer text-xs font-medium text-slate-700">
              ¿Tienes báscula de bioimpedancia?
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {CAMPOS_BIO.map((c) => (
                <label key={c.id} className="block">
                  <span className="mb-0.5 block text-[10px] text-slate-500">
                    {c.nombre} {c.unidad && `(${c.unidad})`}
                  </span>
                  <NumeroConComa
                    value={bio[c.id] ?? ''}
                    onChange={(v) => setBio((s) => ({ ...s, [c.id]: v }))}
                    className="w-full text-sm"
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-slate-500">
              Cópialo tal cual lo marque. Estos números sólo se comparan con los de tu misma
              báscula: entre marcas no significan lo mismo.
            </p>
          </details>

          <details className="rounded-lg border border-slate-200 bg-white p-2">
            <summary className="cursor-pointer text-xs font-medium text-slate-700">Fotos</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {ANGULOS.map((a) => (
                <label key={a.id} className="block">
                  <span className="mb-0.5 block text-[10px] text-slate-500">{a.nombre}</span>
                  {fotos[a.id] ? (
                    <div className="relative">
                      <img
                        src={fotos[a.id]}
                        alt={a.nombre}
                        className="h-28 w-full rounded-lg border border-slate-200 object-cover"
                      />
                      <button
                        onClick={() => setFotos((f) => ({ ...f, [a.id]: undefined }))}
                        className="absolute top-1 right-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-slate-600"
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => ponerFoto(a.id, e.target.files?.[0])}
                      className="w-full text-[10px] text-slate-500"
                    />
                  )}
                  {subiendo === a.id && (
                    <span className="text-[10px] text-slate-400">Preparando…</span>
                  )}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-slate-500">
              Con la misma luz, la misma ropa y el mismo sitio, que si no la comparación no vale.
              Sólo las ve tu nutricionista.
            </p>
          </details>

          <label className="block">
            <span className="mb-0.5 block text-[10px] text-slate-500">
              ¿Algo que quieras apuntar? (opcional)
            </span>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </label>

          <Button onClick={guardar}>Guardar</Button>
        </div>
      )}

      {/* ── Cómo va ──────────────────────────────────── */}
      {evolucion.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {evolucion.map((e) => (
            <FilaDeEvolucion key={e.campo.id} e={e} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          Todavía no has apuntado nada. Con dos medidas ya se ve por dónde va.
        </p>
      )}

      {estaSemana && (
        <p className="tnum mt-3 text-sm text-slate-700">
          Media de peso de esta semana: <strong>{fmt(estaSemana.media, 1)} kg</strong>
          <span className="text-slate-400">
            {' '}
            ({estaSemana.dias} {estaSemana.dias === 1 ? 'día' : 'días'})
          </span>
        </p>
      )}

      {tendencia ? (
        <p className="mt-1 text-xs leading-snug text-slate-600">
          Comparado con la semana pasada,{' '}
          <strong className={tendencia.porSemana < 0 ? 'text-emerald-700' : 'text-slate-700'}>
            {tendencia.porSemana > 0 ? '+' : '−'}
            {fmt(Math.abs(tendencia.porSemana), 1)} kg por semana
          </strong>
          .
        </p>
      ) : (
        semanas.length === 1 && (
          <p className="mt-1 text-xs leading-snug text-slate-500">
            Con otra semana apuntada se podrá ver la tendencia. Un número sacado de unos días no
            dice nada todavía.
          </p>
        )
      )}

      {/*
        CÓMO VA
        La tabla dice los números de hoy; el gráfico dice el recorrido, que es
        lo que de verdad cuenta cuando la báscula lleva tres semanas quieta.
      */}
      {medidas.length > 1 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Cómo va
          </p>
          <EvolucionDeMedidas medidas={medidas} />
        </div>
      )}

      {(conFoto.length > 0 || fotoDePartida) && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Tus fotos
          </p>
          {conFoto.length > 0 ? (
            <ComparaFotos medidas={medidas} />
          ) : (
            fotoDePartida && <Miniatura src={fotoDePartida} pie="Día 1" />
          )}
        </div>
      )}

      {!tieneAlgo(deHoy) && primera?.perimetros?.cintura && !evolucion.length && (
        <p className="mt-2 text-[11px] text-slate-400">
          Tu punto de partida: {fmt(primera.perimetros.cintura, 0)} cm de cintura.
        </p>
      )}
    </section>
  );
}

/**
 * Cada medida contra lo anterior y contra el día uno: es la columna
 * «Diferencia» de su planilla. El número suelto no dice nada, y las dos
 * referencias cuentan cosas distintas — un mal día se ve en la primera y no
 * toca la segunda.
 */
function FilaDeEvolucion({ e }: { e: Evolucion }) {
  const dec = e.campo.unidad === 'kg' ? 1 : 0;
  return (
    <li className="flex items-baseline gap-2 rounded bg-slate-50 px-2 py-1.5 text-sm">
      <span className="min-w-0 flex-1 text-slate-700">{e.campo.nombre}</span>
      <span className="tnum font-medium text-slate-800">
        {fmt(e.ahora, dec)} {e.campo.unidad}
      </span>
      <span className="tnum w-20 text-right text-xs text-slate-500">
        {e.antes != null ? diferencia(e.ahora, e.antes, dec) : '—'}
      </span>
      <span className="tnum hidden w-24 text-right text-xs text-slate-400 sm:inline">
        {e.primero != null ? `${diferencia(e.ahora, e.primero, dec)} desde el día 1` : ''}
      </span>
    </li>
  );
}

function Miniatura({ src, pie }: { src: string; pie: string }) {
  return (
    <figure className="w-24 shrink-0">
      <img src={src} alt={pie} className="h-32 w-24 rounded-lg border border-slate-200 object-cover" />
      <figcaption className="mt-0.5 text-[9px] text-slate-500">{pie}</figcaption>
    </figure>
  );
}

const diferencia = (ahora: number, antes: number, dec = 0) => {
  const d = ahora - antes;
  const minimo = dec ? 0.05 : 0.5;
  if (Math.abs(d) < minimo) return 'igual';
  return `${d > 0 ? '+' : '−'}${fmt(Math.abs(d), dec)}`;
};
