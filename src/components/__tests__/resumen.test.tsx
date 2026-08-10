// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PlanHistory } from '../client/PlanHistory';
import { FollowUpPanel } from '../client/FollowUpPanel';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Client } from '../../types/client';
import type { DayType, Meal, Plan } from '../../types/plan';
import type { RegistroDia } from '../../types/diary';
import type { Medicion } from '../../types/anthropometry';

afterEach(cleanup);

const MEALS: Meal[] = [
  { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
  { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 2 },
];

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: MEALS,
  grid: {
    desayuno: { proteicos_magros: 2, almidones: 2, grasas: 1 },
    comida: { proteicos_magros: 4, almidones: 3, grasas: 2 },
  },
  despensa: { desayuno: { seleccion: ['a-huevo', 'a-avena-copos'] } },
  notas: {},
};

const plan = (id: string, nombre: string, fecha: string, archivado = false): Plan => ({
  id,
  clientId: 'c1',
  nombre,
  fase: 2,
  dayTypes: [DIA],
  fecha,
  archivado,
  createdAt: fecha,
  updatedAt: fecha,
});

const PLANES = [
  plan('p3', 'Planificación 3', '2026-04-28T00:00:00.000Z'),
  plan('p2', 'Planificación 2', '2026-03-25T00:00:00.000Z', true),
  plan('p1', 'Planificación 1', '2026-02-27T00:00:00.000Z', true),
];

const CLIENTE: Client = {
  id: 'c1',
  nombre: 'Marines',
  edad: 35,
  peso: 68,
  altura: 170,
  sexo: 'mujer',
  activityFactorId: 'moderado',
  objetivo: 'mantenimiento',
  goalMultiplier: 1,
  bmrFormula: 'media',
  alergias: [],
  preferencias: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const noop = () => {};

describe('Historial de planificaciones', () => {
  it('lista las tres con su fecha y sus kcal', () => {
    render(
      <PlanHistory
        planes={PLANES}
        activoId="p3"
        kcalObjetivo={1665}
        onNueva={noop}
        onVer={noop}
        onReactivar={noop}
        onBorrar={noop}
      />,
    );
    expect(screen.getByText('Planificación 3')).toBeTruthy();
    expect(screen.getByText('Planificación 1')).toBeTruthy();
    expect(screen.getByText('28/04/2026')).toBeTruthy();
    expect(screen.getAllByText('kcal').length).toBe(3);
  });

  it('marca cuál está en uso y sólo esa', () => {
    render(
      <PlanHistory
        planes={PLANES}
        activoId="p3"
        kcalObjetivo={1665}
        onNueva={noop}
        onVer={noop}
        onReactivar={noop}
        onBorrar={noop}
      />,
    );
    expect(screen.getAllByText('en uso')).toHaveLength(1);
    // Las archivadas se pueden reactivar; la que está en uso, no.
    expect(screen.getAllByText('Reactivar')).toHaveLength(2);
    expect(screen.getByText('Editar')).toBeTruthy();
  });

  it('pulsar la tarjeta abre el cálculo de esa planificación', () => {
    const onVer = vi.fn();
    render(
      <PlanHistory
        planes={PLANES}
        activoId="p3"
        kcalObjetivo={1665}
        onNueva={noop}
        onVer={onVer}
        onReactivar={noop}
        onBorrar={noop}
      />,
    );
    fireEvent.click(screen.getByText('Planificación 1'));
    expect(onVer).toHaveBeenCalledWith('p1');
  });

  it('enseña los tipos de día que lleva cada una', () => {
    render(
      <PlanHistory
        planes={PLANES}
        activoId="p3"
        kcalObjetivo={1665}
        onNueva={noop}
        onVer={noop}
        onReactivar={noop}
        onBorrar={noop}
      />,
    );
    expect(screen.getAllByText('Día base').length).toBe(3);
  });

  it('borrar pide confirmación y no dispara nada si dices que no', () => {
    const onBorrar = vi.fn();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <PlanHistory
        planes={PLANES}
        activoId="p3"
        kcalObjetivo={1665}
        onNueva={noop}
        onVer={noop}
        onReactivar={noop}
        onBorrar={onBorrar}
      />,
    );
    fireEvent.click(screen.getAllByText('Borrar')[0]);
    expect(confirmar).toHaveBeenCalled();
    expect(onBorrar).not.toHaveBeenCalled();
    confirmar.mockRestore();
  });

  it('el botón abre una planificación nueva', () => {
    const onNueva = vi.fn();
    render(
      <PlanHistory
        planes={PLANES}
        activoId="p3"
        kcalObjetivo={1665}
        onNueva={onNueva}
        onVer={noop}
        onReactivar={noop}
        onBorrar={noop}
      />,
    );
    fireEvent.click(screen.getByText('+ Nueva planificación'));
    expect(onNueva).toHaveBeenCalled();
  });

  it('sin planificaciones lo dice en vez de dejarlo en blanco', () => {
    render(
      <PlanHistory
        planes={[]}
        kcalObjetivo={0}
        onNueva={noop}
        onVer={noop}
        onReactivar={noop}
        onBorrar={noop}
      />,
    );
    expect(screen.getByText(/Sin planificaciones/)).toBeTruthy();
  });
});

describe('Panel de seguimiento', () => {
  const hoy = new Date().toISOString().slice(0, 10);
  const registro: RegistroDia = {
    id: 'r1',
    clientId: 'c1',
    fecha: hoy,
    dayTypeId: 'dt',
    recetaElegida: {},
    cumplidas: ['desayuno', 'comida'],
    porciones: { desayuno: { 'a-huevo': 2 } },
    sustituciones: {},
    extras: [],
  };

  const medicion: Medicion = {
    id: 'm1',
    clientId: 'c1',
    fecha: '2026-06-01',
    peso: 68,
    talla: 170,
    pliegues: { triceps: 14, subscapular: 12, biceps: 5, cresta_iliaca: 14, supraespinal: 9, abdominal: 16, muslo: 12, medial_pierna: 8 },
    perimetros: { brazo_relajado: 28, brazo_contraido: 30, cintura: 74, cadera: 96, muslo_medio: 52, pierna_maximo: 34 },
    diametros: { humero: 6.5, biestiloideo: 5.2, femur: 9, tobillo: 6.5 },
  };

  it('con datos enseña la media de cumplimiento', () => {
    render(
      <FollowUpPanel
        client={CLIENTE}
        plan={PLANES[0]}
        registros={[registro]}
        mediciones={[medicion]}
        foods={FOOD_CATALOG}
      />,
    );
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByText(/1\/30 días apuntados/)).toBeTruthy();
  });

  it('enseña el peso y la grasa de la última medición', () => {
    render(
      <FollowUpPanel
        client={CLIENTE}
        plan={PLANES[0]}
        registros={[registro]}
        mediciones={[medicion]}
        foods={FOOD_CATALOG}
      />,
    );
    expect(screen.getByText('Peso')).toBeTruthy();
    expect(screen.getByText('Masa muscular')).toBeTruthy();
    expect(screen.getByText('Grasa')).toBeTruthy();
    expect(document.body.textContent).toMatch(/68[.,]0\s*kg/);
  });

  it('avisa de lo que le ofrece y el cliente no toca', () => {
    render(
      <FollowUpPanel
        client={CLIENTE}
        plan={PLANES[0]}
        registros={[registro]}
        mediciones={[medicion]}
        foods={FOOD_CATALOG}
      />,
    );
    expect(screen.getByText(/Lo que más repite/)).toBeTruthy();
    expect(screen.getByText('Avena copos')).toBeTruthy();
  });

  it('sin nada registrado invita a empezar en vez de mostrar ceros', () => {
    render(
      <FollowUpPanel
        client={CLIENTE}
        plan={PLANES[0]}
        registros={[]}
        mediciones={[]}
        foods={FOOD_CATALOG}
      />,
    );
    expect(screen.getByText(/Aún no hay días registrados/)).toBeTruthy();
    expect(screen.getByText(/Aún no hay mediciones/)).toBeTruthy();
    expect(screen.queryByText('0%')).toBeNull();
  });
});
