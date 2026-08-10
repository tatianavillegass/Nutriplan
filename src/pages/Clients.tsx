import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { OBJETIVO_LABELS, edadDe, estadoAcceso, type Client } from '../types/client';
import { useEnergy } from '../hooks/useEnergy';
import { getActivityFactor } from '../data/activityFactors';
import { ClientForm, CLIENTE_NUEVO, type DatosCliente } from '../components/client/ClientForm';
import { Button, EmptyState, fmt } from '../components/common/ui';

const fechaCorta = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

function Acceso({ client }: { client: Client }) {
  const { estado, diasRestantes } = estadoAcceso(client);
  const estilo = {
    activo: 'bg-emerald-50 text-emerald-700',
    termina_pronto: 'bg-amber-50 text-amber-800',
    caducado: 'bg-slate-100 text-slate-500',
  }[estado];
  const texto = {
    activo: 'Activo',
    termina_pronto: diasRestantes === 0 ? 'Último día' : `Quedan ${diasRestantes} d`,
    caducado: 'Sin acceso',
  }[estado];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${estilo}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          estado === 'caducado' ? 'bg-slate-400' : estado === 'activo' ? 'bg-emerald-500' : 'bg-amber-500'
        }`}
        aria-hidden
      />
      {texto}
    </span>
  );
}

function ClientRow({
  client,
  onEditar,
  onBorrar,
}: {
  client: Client;
  onEditar: () => void;
  onBorrar: () => void;
}) {
  const navigate = useNavigate();
  const calc = useEnergy(client);
  return (
    <tr
      onClick={() => navigate(`/clientes/${client.id}`)}
      className="cursor-pointer border-t border-slate-100 transition hover:bg-brand-50/50"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div>
            <div className="text-sm font-medium text-slate-800">{client.nombre || 'Sin nombre'}</div>
            <div className="text-[11px] text-slate-400">
              {client.email ?? OBJETIVO_LABELS[client.objetivo]}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditar();
            }}
            aria-label={`Editar ${client.nombre}`}
            title="Editar datos del cliente"
            className="rounded p-1 text-slate-300 transition hover:bg-slate-100 hover:text-brand-600"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 20h4L19 9a2.1 2.1 0 10-3-3L5 17v3z" />
              <path d="M14.5 6.5l3 3" />
            </svg>
          </button>
        </div>
      </td>
      <td className="px-4 py-3">
        <Acceso client={client} />
      </td>
      <td className="tnum px-4 py-3 text-sm text-slate-600">{edadDe(client)}</td>
      <td className="tnum px-4 py-3 text-sm text-slate-600">{client.peso} kg</td>
      <td className="tnum px-4 py-3 text-sm text-slate-500">{fechaCorta(client.fechaAlta)}</td>
      <td className="tnum px-4 py-3 text-sm text-slate-500">
        {client.accesoHasta ? fechaCorta(client.accesoHasta) : 'Abierto'}
      </td>
      <td className="tnum px-4 py-3 text-sm text-slate-600">
        ×{getActivityFactor(client.activityFactorId).toFixed(2)}
      </td>
      <td className="tnum px-4 py-3 text-right text-sm font-semibold text-brand-800">
        {fmt(calc?.energy.caloriasObjetivo ?? 0)} kcal
      </td>
      <td className="px-2 py-3 text-right">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBorrar();
          }}
          aria-label={`Borrar ${client.nombre}`}
          title="Borrar cliente"
          className="rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
          </svg>
        </button>
      </td>
    </tr>
  );
}

export function Clients() {
  const clients = useAppStore((s) => s.clients);
  const addClient = useAppStore((s) => s.addClient);
  const updateClient = useAppStore((s) => s.updateClient);
  const deleteClient = useAppStore((s) => s.deleteClient);
  const quitarCuenta = useAuthStore((s) => s.quitarCuentaDeCliente);
  const ensurePlan = useAppStore((s) => s.ensurePlan);
  const navigate = useNavigate();

  /** null = cerrado · 'nuevo' = alta · id = editando ese cliente. */
  const [editando, setEditando] = useState<string | null>(null);
  const enEdicion = clients.find((c) => c.id === editando);

  /** Borrar arrastra planes, mediciones y registros: por eso se avisa. */
  const borrar = (c: Client) => {
    if (
      !window.confirm(
        `¿Borrar a ${c.nombre}? Se pierden sus planificaciones, sus mediciones y su seguimiento. No se puede deshacer.`,
      )
    )
      return;
    deleteClient(c.id);
    quitarCuenta(c.id);
    if (editando === c.id) setEditando(null);
  };

  const guardar = (datos: DatosCliente) => {
    if (editando === 'nuevo') {
      const c = addClient(datos);
      ensurePlan(c.id);
      setEditando(null);
      navigate(`/clientes/${c.id}`);
      return;
    }
    if (editando) updateClient(editando, datos);
    setEditando(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-900">Clientes</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {clients.length} {clients.length === 1 ? 'cliente' : 'clientes'}
          </p>
        </div>
        <Button onClick={() => setEditando(editando ? null : 'nuevo')}>
          {editando ? 'Cancelar' : '+ Nuevo cliente'}
        </Button>
      </div>

      {editando && (
        <ClientForm
          key={editando}
          inicial={
            enEdicion
              ? (({ id, createdAt, updatedAt, ...resto }) => {
                  void id;
                  void createdAt;
                  void updatedAt;
                  return resto;
                })(enEdicion)
              : CLIENTE_NUEVO
          }
          titulo={enEdicion ? `Editar ${enEdicion.nombre}` : 'Nuevo cliente'}
          textoBoton={enEdicion ? 'Guardar cambios' : 'Crear y calcular GET'}
          onGuardar={guardar}
          onCancelar={() => setEditando(null)}
        />
      )}

      {clients.length === 0 ? (
        <EmptyState title="Todavía no hay clientes">
          Crea el primero para calcular su GET y armar su plan.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-100 bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/70 text-[11px] tracking-wide text-slate-400 uppercase">
                <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
                <th className="px-4 py-2.5 text-left font-medium">Acceso</th>
                <th className="px-4 py-2.5 text-left font-medium">Edad</th>
                <th className="px-4 py-2.5 text-left font-medium">Peso</th>
                <th className="px-4 py-2.5 text-left font-medium">Alta</th>
                <th className="px-4 py-2.5 text-left font-medium">Hasta</th>
                <th className="px-4 py-2.5 text-left font-medium">Actividad</th>
                <th className="px-4 py-2.5 text-right font-medium">Objetivo kcal</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <ClientRow
                  key={c.id}
                  client={c}
                  onEditar={() => setEditando(c.id)}
                  onBorrar={() => borrar(c)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
