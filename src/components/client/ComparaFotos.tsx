import { useState } from 'react';
import { tomasConFoto, type Medida } from '../../utils/misMedidas';
import { Select } from '../common/ui';

const ANGULOS = [
  { id: 'frente', nombre: 'De frente' },
  { id: 'perfil', nombre: 'De perfil' },
  { id: 'espalda', nombre: 'De espalda' },
] as const;

const fechaLegible = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * ANTES Y AHORA
 *
 * Dos fotos juntas, con su fecha debajo. Es la comparación que de verdad se
 * mira, y la que cuenta lo que la báscula se calla: el mismo peso con otra
 * forma es el mes en que todo el mundo cree que no ha pasado nada.
 *
 * SE ELIGEN LAS DOS FECHAS
 * ========================
 * Empieza en la primera contra la última, que es lo que se quiere ver casi
 * siempre. Pero con seis meses apuntados también hace falta poder mirar el mes
 * 3 contra el 5 — un estancamiento se ve ahí y no en el total.
 *
 * UN ÁNGULO CADA VEZ
 * ==================
 * Seis fotos en la pantalla de un móvil son seis sellos. Se enseña el ángulo
 * elegido a tamaño que se vea, y se cambia con un toque.
 *
 * Y NO SE DICE NADA DE ELLAS
 * ==========================
 * Sin porcentajes, sin flechas, sin «vas muy bien». Son sus fotos; lo que
 * significan se habla en consulta.
 */
export function ComparaFotos({ medidas }: { medidas: Medida[] }) {
  const tomas = tomasConFoto(medidas);
  const [angulo, setAngulo] = useState<(typeof ANGULOS)[number]['id']>('frente');
  const [antes, setAntes] = useState<string | undefined>();
  const [ahora, setAhora] = useState<string | undefined>();

  if (!tomas.length) return null;

  /* Por defecto, la primera contra la última. */
  const izq = tomas.find((t) => t.fecha === antes) ?? tomas[0];
  const der = tomas.find((t) => t.fecha === ahora) ?? tomas[tomas.length - 1];

  /* Sólo se ofrecen los ángulos de los que hay alguna foto. */
  const hay = ANGULOS.filter((a) => tomas.some((t) => t.fotos?.[a.id]));
  const activo = hay.some((a) => a.id === angulo) ? angulo : hay[0]?.id;
  if (!activo) return null;

  return (
    <div>
      {hay.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {hay.map((a) => (
            <button
              key={a.id}
              onClick={() => setAngulo(a.id)}
              aria-pressed={a.id === activo}
              className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                a.id === activo
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {a.nombre}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Lado toma={izq} angulo={activo} />
        <Lado toma={der} angulo={activo} />
      </div>

      {tomas.length > 2 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Elegir
            etiqueta="Antes"
            tomas={tomas}
            valor={izq.fecha}
            onChange={setAntes}
          />
          <Elegir
            etiqueta="Después"
            tomas={tomas}
            valor={der.fecha}
            onChange={setAhora}
          />
        </div>
      )}
    </div>
  );
}

function Lado({ toma, angulo }: { toma: Medida; angulo: string }) {
  const src = toma.fotos?.[angulo as 'frente'];
  return (
    <figure>
      {src ? (
        <img
          src={src}
          alt={`${fechaLegible(toma.fecha)}`}
          className="aspect-[3/4] w-full rounded-lg border border-slate-200 object-cover"
        />
      ) : (
        /*
         * Un hueco en vez de saltarse la fecha: si ese día no se hizo la foto
         * de espalda, esconderlo haría creer que la comparación es de otra
         * fecha.
         */
        <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2 text-center text-[10px] leading-snug text-slate-400">
          Sin foto de este ángulo
        </div>
      )}
      <figcaption className="mt-1 text-center text-[11px] text-slate-600">
        {fechaLegible(toma.fecha)}
      </figcaption>
    </figure>
  );
}

function Elegir({
  etiqueta,
  tomas,
  valor,
  onChange,
}: {
  etiqueta: string;
  tomas: Medida[];
  valor: string;
  onChange: (f: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] text-slate-500">{etiqueta}</span>
      <Select value={valor} onChange={(e) => onChange(e.target.value)} className="text-xs">
        {tomas.map((t) => (
          <option key={t.fecha} value={t.fecha}>
            {fechaLegible(t.fecha)}
          </option>
        ))}
      </Select>
    </label>
  );
}
