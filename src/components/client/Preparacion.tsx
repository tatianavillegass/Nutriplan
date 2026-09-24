import { useRef, useState } from 'react';
import {
  PASOS_DE_PREPARACION,
  preparacionCompleta,
  type PasoId,
  type Preparacion as Datos,
} from '../../utils/preparacion';
import { ErrorImagen, prepararFoto } from '../../utils/imagen';
import { Button } from '../common/ui';
import { NumeroConComa, aNumero } from '../common/NumeroConComa';

interface Props {
  nombreReto: string;
  /** Cuántos días faltan para empezar. 0 = empieza hoy. */
  faltan: number;
  datos: Datos;
  onGuardar: (patch: Partial<Datos>) => void;
}

/**
 * PREPÁRATE PARA EMPEZAR
 *
 * Entre apuntarse y arrancar pasan días, y ese hueco es donde se pierde la
 * gente. Tres cosas que hacer convierten la espera en algo que se termina, y
 * dejan tomado el punto de partida: sin cintura ni foto del primer día, el día
 * 30 sólo queda el peso, que es lo que peor cuenta lo que ha pasado.
 *
 * El anillo con «1 de 3» es el mismo truco que usan los bancos al abrirte la
 * cuenta, y funciona por lo mismo: una lista corta que se puede terminar hoy.
 * Aquí para justo en tres pasos, que es donde deja de ser un empujón y empieza
 * a ser una tarea.
 */
export function Preparacion({ nombreReto, faltan, datos, onGuardar }: Props) {
  const [abierto, setAbierto] = useState<PasoId | null>(null);
  const hechos = new Set(datos.hechos);
  const completa = preparacionCompleta(datos);

  const marcar = (id: PasoId, extra: Partial<Datos> = {}) => {
    onGuardar({ hechos: [...datos.hechos.filter((x) => x !== id), id], ...extra });
    setAbierto(null);
  };

  const total = PASOS_DE_PREPARACION.length;
  const hechas = PASOS_DE_PREPARACION.filter((p) => hechos.has(p.id)).length;
  const r = 26;
  const circunferencia = 2 * Math.PI * r;

  return (
    <section className="rounded-2xl border border-brand-200 bg-white p-4 no-print sm:p-5">
      <div className="flex items-center gap-4">
        <div className="relative inline-flex shrink-0 items-center justify-center">
          <svg viewBox="0 0 60 60" className="h-16 w-16" aria-hidden>
            <circle cx="30" cy="30" r={r} fill="none" className="stroke-slate-100" strokeWidth="5" />
            <circle
              cx="30"
              cy="30"
              r={r}
              fill="none"
              className={completa ? 'stroke-emerald-500' : 'stroke-brand-500'}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${(circunferencia * hechas) / total} ${circunferencia}`}
              transform="rotate(-90 30 30)"
            />
          </svg>
          <span className="tnum absolute text-sm font-bold text-brand-900">
            {hechas}/{total}
          </span>
        </div>

        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-wide text-brand-800 uppercase">
            {completa ? 'Ya está todo listo' : 'Prepárate para empezar'}
          </h2>
          <p className="mt-0.5 text-xs leading-snug text-slate-600">
            {completa
              ? `Nos vemos ${faltan <= 0 ? 'hoy' : faltan === 1 ? 'mañana' : `en ${faltan} días`} en ${nombreReto}.`
              : faltan <= 0
                ? `${nombreReto} empieza hoy. Esto se hace una vez y es con lo que vas a comparar.`
                : `Faltan ${faltan} ${faltan === 1 ? 'día' : 'días'}. Esto se hace una vez y es con lo que vas a comparar.`}
          </p>
        </div>
      </div>

      <ul className="mt-3 divide-y divide-slate-100">
        {PASOS_DE_PREPARACION.map((paso) => {
          const hecho = hechos.has(paso.id);
          return (
            <li key={paso.id} className="py-2">
              <button
                onClick={() => setAbierto(abierto === paso.id ? null : paso.id)}
                aria-expanded={abierto === paso.id}
                className="flex w-full items-start gap-3 text-left"
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                    hecho ? 'bg-emerald-500 text-white' : 'border border-slate-300 text-transparent'
                  }`}
                  aria-hidden
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm ${hecho ? 'text-slate-400 line-through' : 'font-medium text-slate-800'}`}
                  >
                    {paso.titulo}
                  </span>
                  {!hecho && (
                    <span className="block text-[11px] leading-snug text-slate-500">
                      {paso.detalle}
                    </span>
                  )}
                </span>
                <span aria-hidden className="shrink-0 text-slate-300">
                  {abierto === paso.id ? '⌃' : '›'}
                </span>
              </button>

              {abierto === paso.id && (
                <div className="mt-2 rounded-lg bg-slate-50 p-3">
                  {paso.id === 'medidas' && (
                    <MedidasDelPrimerDia datos={datos} onListo={(m) => marcar('medidas', m)} />
                  )}
                  {paso.id === 'foto' && <FotoDelPrimerDia onListo={(f) => marcar('foto', f)} />}
                  {paso.id === 'guia' && (
                    <>
                      <p className="text-xs leading-snug text-slate-600">
                        Está en la pestaña «Recursos», con las raciones y lo que te haya dejado tu
                        nutricionista.
                      </p>
                      <div className="mt-2 flex justify-end">
                        <Button onClick={() => marcar('guia')}>Ya la he leído</Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Cintura y cadera: las dos que puede tomarse sola con una cinta. */
function MedidasDelPrimerDia({
  datos,
  onListo,
}: {
  datos: Datos;
  onListo: (m: { cintura?: number; cadera?: number }) => void;
}) {
  const [cintura, setCintura] = useState(datos.cintura ? String(datos.cintura) : '');
  const [cadera, setCadera] = useState(datos.cadera ? String(datos.cadera) : '');
  const hay = !!aNumero(cintura) || !!aNumero(cadera);

  return (
    <>
      <p className="mb-2 text-xs leading-snug text-slate-600">
        La cintura, por encima del ombligo y sin meter tripa. La cadera, por la parte más ancha.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-0.5 block text-[10px] text-slate-500">Cintura (cm)</span>
          <NumeroConComa
            value={cintura}
            onChange={setCintura}
            className="w-24 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[10px] text-slate-500">Cadera (cm)</span>
          <NumeroConComa
            value={cadera}
            onChange={setCadera}
            className="w-24 text-sm"
          />
        </label>
        <Button
          disabled={!hay}
          onClick={() =>
            onListo({ cintura: aNumero(cintura), cadera: aNumero(cadera) })
          }
        >
          Guardar
        </Button>
      </div>
    </>
  );
}

/**
 * La foto es suya. Puede subirla —la ve su nutricionista y la tiene para
 * comparar— o quedársela en el móvil y marcar el paso: lo que hace falta es
 * que exista una foto del primer día, no que esté aquí.
 */
function FotoDelPrimerDia({ onListo }: { onListo: (f: { foto?: string }) => void }) {
  const archivo = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  /**
   * QUE SE VEA POR QUÉ NO HA SUBIDO
   *
   * Esto no existía: si la foto fallaba —un HEIC de iPhone, un archivo enorme—
   * el botón volvía de «Subiendo…» a «Subir la foto» y no pasaba nada más. Lo
   * que llega es «no me deja subir la foto», sin más pista.
   */
  const [error, setError] = useState<string | null>(null);

  const elegir = async (file: File) => {
    setError(null);
    setSubiendo(true);
    try {
      onListo({ foto: await prepararFoto(file) });
    } catch (e) {
      setError(e instanceof ErrorImagen ? e.message : 'No se pudo subir la foto. Prueba con otra.');
    } finally {
      setSubiendo(false);
      /* Sin esto, volver a elegir la MISMA foto no dispara nada. */
      if (archivo.current) archivo.current.value = '';
    }
  };

  return (
    <>
      <p className="mb-2 text-xs leading-snug text-slate-600">
        De frente y de lado, con la misma ropa y la misma luz que vayas a usar el último día. Es
        tuya: súbela si quieres que la vea tu nutricionista, o guárdatela y marca el paso.
      </p>
      <input
        ref={archivo}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void elegir(f);
        }}
      />
      {error && (
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => onListo({})}>
          Ya me la he hecho
        </Button>
        <Button disabled={subiendo} onClick={() => archivo.current?.click()}>
          {subiendo ? 'Subiendo…' : 'Subir la foto'}
        </Button>
      </div>
    </>
  );
}
