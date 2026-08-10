import { useRef, useState } from 'react';
import { prepararFoto, pesoDataUrl, pesoLegible, ErrorImagen } from '../../utils/imagen';

interface Props {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  label?: string;
}

/**
 * Zona para soltar o elegir la foto de la receta.
 * La imagen se reduce antes de guardarla, así que da igual subirla del móvil.
 */
export function PhotoUpload({ value, onChange, label = 'Foto de la receta' }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const procesar = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setCargando(true);
    try {
      onChange(await prepararFoto(file));
    } catch (e) {
      setError(e instanceof ErrorImagen ? e.message : 'No se pudo procesar la imagen.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate-600">{label}</p>

      {value ? (
        <div className="group relative overflow-hidden rounded-xl border border-brand-100">
          <img src={value} alt="Foto de la receta" className="h-44 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-slate-900/70 px-3 py-2 text-[11px] text-white">
            <span className="tnum">{pesoLegible(pesoDataUrl(value))}</span>
            <span className="flex gap-3">
              <button type="button" onClick={() => input.current?.click()} className="hover:underline">
                Cambiar
              </button>
              <button type="button" onClick={() => onChange(undefined)} className="text-red-300 hover:underline">
                Quitar
              </button>
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setEncima(true);
          }}
          onDragLeave={() => setEncima(false)}
          onDrop={(e) => {
            e.preventDefault();
            setEncima(false);
            void procesar(e.dataTransfer.files?.[0]);
          }}
          className={`flex h-44 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed transition ${
            encima ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-slate-50 hover:border-brand-300'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8.5" cy="10" r="1.5" />
            <path d="M21 16l-5-5-4.5 4.5L9 13l-6 6" />
          </svg>
          <span className="text-xs font-medium text-slate-600">
            {cargando ? 'Procesando…' : 'Arrastra la foto o haz clic para elegirla'}
          </span>
          <span className="text-[11px] text-slate-400">JPG, PNG o WEBP · se reduce sola</span>
        </button>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void procesar(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
