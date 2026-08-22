import { useState } from 'react';
import { OBJETIVO_LABELS, edadDe, estadoAcceso, type Client } from '../../types/client';
import { Button, Field, Input, Select } from '../common/ui';

export type DatosCliente = Omit<Client, 'id' | 'createdAt' | 'updatedAt'>;

export const CLIENTE_NUEVO: DatosCliente = {
  nombre: '',
  edad: 30,
  peso: 70,
  altura: 170,
  sexo: 'mujer',
  activityFactorId: 'moderado',
  objetivo: 'mantenimiento',
  goalMultiplier: 1,
  bmrFormula: 'media',
  alergias: [],
  preferencias: [],
  fechaAlta: new Date().toISOString().slice(0, 10),
};

interface Props {
  inicial?: DatosCliente;
  titulo: string;
  textoBoton: string;
  onGuardar: (datos: DatosCliente) => void;
  onCancelar: () => void;
}

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * FICHA DEL CLIENTE
 *
 * Misma pantalla para dar de alta y para editar. La edad no se escribe: sale
 * de la fecha de nacimiento y sube sola cada cumpleaños, que es lo que pasa
 * con un cliente que lleva años contigo.
 */
export function ClientForm({ inicial, titulo, textoBoton, onGuardar, onCancelar }: Props) {
  const [form, setForm] = useState<DatosCliente>(inicial ?? CLIENTE_NUEVO);
  const set = <K extends keyof DatosCliente>(k: K, v: DatosCliente[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const edad = edadDe(form);
  const acceso = estadoAcceso(form);

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <p className="mb-3 text-sm font-semibold text-brand-900">{titulo}</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Nombre" className="sm:col-span-2">
          <Input
            value={form.nombre}
            autoFocus
            onChange={(e) => set('nombre', e.target.value)}
            placeholder="Nombre y apellidos"
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={form.email ?? ''}
            onChange={(e) => set('email', e.target.value || undefined)}
            placeholder="nombre@correo.com"
          />
        </Field>

        <Field label="Fecha de nacimiento">
          <Input
            type="date"
            value={form.fechaNacimiento ?? ''}
            max={hoy()}
            onChange={(e) => set('fechaNacimiento', e.target.value || undefined)}
          />
        </Field>
        <Field label={form.fechaNacimiento ? 'Edad (se calcula sola)' : 'Edad'}>
          <Input
            type="number"
            value={edad}
            disabled={!!form.fechaNacimiento}
            onChange={(e) => set('edad', +e.target.value)}
          />
        </Field>
        <Field label="Teléfono">
          <Input
            value={form.telefono ?? ''}
            onChange={(e) => set('telefono', e.target.value || undefined)}
            placeholder="Opcional"
          />
        </Field>

        <Field label="Peso (kg)">
          <Input
            type="number"
            step="0.1"
            value={form.peso}
            onChange={(e) => set('peso', +e.target.value)}
          />
        </Field>
        <Field label="Altura (cm)">
          <Input type="number" value={form.altura} onChange={(e) => set('altura', +e.target.value)} />
        </Field>
        <Field label="Sexo">
          <Select value={form.sexo} onChange={(e) => set('sexo', e.target.value as Client['sexo'])}>
            <option value="mujer">Mujer</option>
            <option value="hombre">Hombre</option>
          </Select>
        </Field>

        <Field label="Objetivo" className="sm:col-span-3">
          <Select
            value={form.objetivo}
            onChange={(e) => set('objetivo', e.target.value as Client['objetivo'])}
          >
            {Object.entries(OBJETIVO_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* Periodo de acceso */}
      <div className="mt-3 grid gap-3 border-t border-brand-200 pt-3 sm:grid-cols-3">
        <Field label="Fecha de alta">
          <Input
            type="date"
            value={form.fechaAlta ?? ''}
            onChange={(e) => set('fechaAlta', e.target.value || undefined)}
          />
        </Field>
        <Field label="Acceso hasta">
          <Input
            type="date"
            value={form.accesoHasta ?? ''}
            onChange={(e) => set('accesoHasta', e.target.value || undefined)}
          />
        </Field>
        <div className="flex items-end gap-2">
          {form.accesoHasta ? (
            <Button variant="outline" onClick={() => set('accesoHasta', undefined)}>
              Dejar abierto
            </Button>
          ) : (
            <p className="pb-2 text-[11px] text-slate-500">
              Sin fecha de fin, el acceso queda abierto hasta que pongas una.
            </p>
          )}
          {acceso.estado === 'caducado' && (
            <Button
              onClick={() => {
                const d = new Date();
                d.setMonth(d.getMonth() + 1);
                set('accesoHasta', d.toISOString().slice(0, 10));
              }}
            >
              Reactivar 1 mes
            </Button>
          )}
        </div>
      </div>

      {/*
        UN RETO CONSIGO MISMA
        =====================
        RESET 90 es consulta individual, pero con principio y final. De estos
        tres datos salen el chip de la lista y el contador de su app.
      */}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Programa" hint="RESET 90, por ejemplo. Vacío si es consulta normal">
          <Input
            value={form.programa?.nombre ?? ''}
            onChange={(e) =>
              set(
                'programa',
                e.target.value
                  ? {
                      nombre: e.target.value,
                      inicio: form.programa?.inicio ?? new Date().toISOString().slice(0, 10),
                      dias: form.programa?.dias ?? 90,
                    }
                  : undefined,
              )
            }
            placeholder="RESET 90"
          />
        </Field>
        {form.programa && (
          <>
            <Field label="Empieza">
              <Input
                type="date"
                value={form.programa.inicio}
                onChange={(e) =>
                  set('programa', { ...form.programa!, inicio: e.target.value })
                }
              />
            </Field>
            <Field label="Días que dura">
              <Input
                type="number"
                min="1"
                value={form.programa.dias}
                onChange={(e) =>
                  set('programa', {
                    ...form.programa!,
                    dias: Number(e.target.value) || 90,
                  })
                }
              />
            </Field>
          </>
        )}
      </div>

      <Field label="Notas" className="mt-3">
        <Input
          value={form.notas ?? ''}
          onChange={(e) => set('notas', e.target.value || undefined)}
          placeholder="Cualquier cosa que quieras recordar de este cliente"
        />
      </Field>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button onClick={() => onGuardar(form)} disabled={!form.nombre.trim()}>
          {textoBoton}
        </Button>
      </div>
    </div>
  );
}
