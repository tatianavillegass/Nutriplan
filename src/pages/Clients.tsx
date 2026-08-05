import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { OBJETIVO_LABELS, type Client } from '../types/client';
import { useEnergy } from '../hooks/useEnergy';
import { getActivityFactor } from '../data/activityFactors';
import { Button, Card, EmptyState, Field, Input, Select, fmt } from '../components/common/ui';

const NUEVO: Omit<Client, 'id' | 'createdAt' | 'updatedAt'> = {
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
};

function ClientRow({ client }: { client: Client }) {
  const navigate = useNavigate();
  const calc = useEnergy(client);
  return (
    <tr
      onClick={() => navigate(`/clientes/${client.id}`)}
      className="cursor-pointer border-t border-slate-100 transition hover:bg-brand-50/50"
    >
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-slate-800">{client.nombre || 'Sin nombre'}</div>
        <div className="text-[11px] text-slate-400">{OBJETIVO_LABELS[client.objetivo]}</div>
      </td>
      <td className="tnum px-4 py-3 text-sm text-slate-600">{client.edad}</td>
      <td className="tnum px-4 py-3 text-sm text-slate-600">{client.peso} kg</td>
      <td className="tnum px-4 py-3 text-sm text-slate-600">{client.altura} cm</td>
      <td className="tnum px-4 py-3 text-sm text-slate-600">
        ×{getActivityFactor(client.activityFactorId).toFixed(2)}
      </td>
      <td className="tnum px-4 py-3 text-right text-sm font-semibold text-brand-800">
        {fmt(calc?.energy.caloriasObjetivo ?? 0)} kcal
      </td>
    </tr>
  );
}

export function Clients() {
  const clients = useAppStore((s) => s.clients);
  const addClient = useAppStore((s) => s.addClient);
  const ensurePlan = useAppStore((s) => s.ensurePlan);
  const navigate = useNavigate();

  const [form, setForm] = useState(NUEVO);
  const [abierto, setAbierto] = useState(false);

  const crear = () => {
    const c = addClient(form);
    ensurePlan(c.id);
    setForm(NUEVO);
    setAbierto(false);
    navigate(`/clientes/${c.id}`);
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
        <Button onClick={() => setAbierto((v) => !v)}>{abierto ? 'Cancelar' : '+ Nuevo cliente'}</Button>
      </div>

      {abierto && (
        <Card title="Nuevo cliente">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nombre" className="sm:col-span-3">
              <Input
                value={form.nombre}
                autoFocus
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre y apellidos"
              />
            </Field>
            <Field label="Edad">
              <Input type="number" value={form.edad} onChange={(e) => setForm({ ...form, edad: +e.target.value })} />
            </Field>
            <Field label="Peso (kg)">
              <Input type="number" step="0.1" value={form.peso} onChange={(e) => setForm({ ...form, peso: +e.target.value })} />
            </Field>
            <Field label="Altura (cm)">
              <Input type="number" value={form.altura} onChange={(e) => setForm({ ...form, altura: +e.target.value })} />
            </Field>
            <Field label="Sexo">
              <Select value={form.sexo} onChange={(e) => setForm({ ...form, sexo: e.target.value as Client['sexo'] })}>
                <option value="mujer">Mujer</option>
                <option value="hombre">Hombre</option>
              </Select>
            </Field>
            <Field label="Objetivo" className="sm:col-span-2">
              <Select
                value={form.objetivo}
                onChange={(e) => setForm({ ...form, objetivo: e.target.value as Client['objetivo'] })}
              >
                {Object.entries(OBJETIVO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={crear} disabled={!form.nombre.trim()}>
              Crear y calcular GET
            </Button>
          </div>
        </Card>
      )}

      {clients.length === 0 ? (
        <EmptyState title="Todavía no hay clientes">
          Crea el primero para calcular su GET y armar su plan.
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brand-100 bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/70 text-[11px] tracking-wide text-slate-400 uppercase">
                <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
                <th className="px-4 py-2.5 text-left font-medium">Edad</th>
                <th className="px-4 py-2.5 text-left font-medium">Peso</th>
                <th className="px-4 py-2.5 text-left font-medium">Altura</th>
                <th className="px-4 py-2.5 text-left font-medium">Actividad</th>
                <th className="px-4 py-2.5 text-right font-medium">Objetivo kcal</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <ClientRow key={c.id} client={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
