import { useState } from 'react';
import type { Bioimpedancia, Medicion, Perimetros } from '../../types/anthropometry';
import { medicionVacia } from '../../types/anthropometry';
import { A_PERIMETRO, CAMPOS, CAMPOS_BIO } from '../../utils/misMedidas';
import { prepararFoto } from '../../utils/imagen';
import { Button, Input } from '../common/ui';
import { NumeroConComa, aNumero } from '../common/NumeroConComa';

const ANGULOS = [
  { id: 'frente', nombre: 'De frente' },
  { id: 'perfil', nombre: 'De perfil' },
  { id: 'espalda', nombre: 'De espalda' },
] as const;

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * APUNTAR UNA TOMA POR ELLA
 *
 * Las primeras medidas no las mete la clienta: se las manda por correo antes de
 * la primera consulta, con sus fotos. Sin esto, esa primera toma —la única
 * contra la que se compara todo lo demás— se quedaba fuera de la app y el
 * «desde el día 1» empezaba a contar desde la segunda.
 *
 * Y SIRVE PARA CUALQUIER FECHA, NO SÓLO PARA LA PRIMERA
 * =====================================================
 * Hay quien manda las medidas por mensaje en vez de meterlas. Si sólo se
 * pudiera apuntar la primera, esas tomas se perderían o habría que pedirle a
 * ella que las copiara, que es trabajo de nadie.
 *
 * SE GUARDA COMO UNA MEDICIÓN SUYA
 * ================================
 * El registro del día es de la clienta y sólo lo escribe ella —esa regla no se
 * toca— así que esto va donde escribe la nutricionista: en `mediciones`. Es la
 * misma tabla de la antropometría, pero rellenando sólo lo que se puede medir
 * en casa con una cinta. Los pliegues se quedan vacíos, que es la verdad.
 *
 * LA FECHA SE ESCRIBE
 * ===================
 * Se apunta cuando llega el correo, que puede ser una semana después de que se
 * midiera. Poner la de hoy convertiría la medición de agosto en una de
 * septiembre, igual que pasaba con las consultas y los pagos.
 */
export function ApuntarUnaToma({
  clientId,
  onGuardar,
}: {
  clientId: string;
  onGuardar: (m: Omit<Medicion, 'id'> & { id?: string }) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(hoy());
  const [valores, setValores] = useState<Record<string, string>>({});
  const [bio, setBio] = useState<Record<string, string>>({});
  const [fotos, setFotos] = useState<Record<string, string | undefined>>({});
  const [nota, setNota] = useState('');
  const [subiendo, setSubiendo] = useState<string | undefined>();

  const limpiar = () => {
    setValores({});
    setBio({});
    setFotos({});
    setNota('');
    setFecha(hoy());
  };

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
    const perimetros: Perimetros = {};
    for (const c of CAMPOS) {
      const destino = A_PERIMETRO[c.id];
      const n = aNumero(valores[c.id] ?? '');
      if (destino && n != null) perimetros[destino] = n;
    }
    const bioLimpia: Bioimpedancia = {};
    for (const c of CAMPOS_BIO) {
      const n = aNumero(bio[c.id] ?? '');
      if (n != null) bioLimpia[c.id] = n;
    }
    const conFoto = ANGULOS.some((a) => fotos[a.id]);

    onGuardar({
      ...medicionVacia(clientId, '', fecha),
      peso: aNumero(valores.peso ?? ''),
      talla: aNumero(valores.altura ?? ''),
      perimetros,
      ...(Object.keys(bioLimpia).length ? { bioimpedancia: bioLimpia } : {}),
      ...(conFoto ? { fotos } : {}),
      ...(nota.trim() ? { notas: nota.trim() } : {}),
    });
    limpiar();
    setAbierto(false);
  };

  if (!abierto)
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-lg border border-brand-200 px-2.5 py-1 text-[11px] font-medium text-brand-800 transition hover:bg-brand-50"
      >
        Apuntar una toma
      </button>
    );

  return (
    <section className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label className="block">
          <span className="mb-0.5 block text-[10px] text-slate-500">
            Fecha en que se midió
          </span>
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-40 text-sm"
          />
        </label>
        <button
          onClick={() => {
            limpiar();
            setAbierto(false);
          }}
          className="text-xs text-slate-500 hover:underline"
        >
          Cancelar
        </button>
      </div>

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

      <details className="rounded-lg border border-slate-200 bg-white p-2">
        <summary className="cursor-pointer text-xs font-medium text-slate-700">
          Bioimpedancia, si te la ha mandado
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
      </details>

      <details className="rounded-lg border border-slate-200 bg-white p-2" open>
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
                  onChange={(e) => void ponerFoto(a.id, e.target.files?.[0])}
                  className="w-full text-[10px] text-slate-500"
                />
              )}
              {subiendo === a.id && <span className="text-[10px] text-slate-400">Preparando…</span>}
            </label>
          ))}
        </div>
      </details>

      <label className="block">
        <span className="mb-0.5 block text-[10px] text-slate-500">Nota (opcional)</span>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
      </label>

      <Button onClick={guardar}>Guardar la toma</Button>
      <p className="text-[10px] leading-snug text-slate-500">
        Le aparecerá en su «Resumen» como punto de partida, y a partir de ahí las siguientes las
        apunta ella.
      </p>
    </section>
  );
}
