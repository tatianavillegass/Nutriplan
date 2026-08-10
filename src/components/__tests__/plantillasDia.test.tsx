// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DayTemplateBar } from '../planning/DayTemplateBar';
import { guardarPlantillasDia, leerPlantillasDia } from '../../utils/plantillas';
import type { DayType, DespensaComida, Meal } from '../../types/plan';

afterEach(cleanup);

const DESAYUNO: Meal = { id: 'm1', nombre: 'Desayuno', slot: 'desayuno', orden: 1 };
const CENA: Meal = { id: 'm2', nombre: 'Cena', slot: 'cena', orden: 2 };

const dia = (despensa?: DayType['despensa']): DayType => ({
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [DESAYUNO, CENA],
  grid: { m1: { proteicos_magros: 2, almidones: 2 } },
  despensa,
  notas: {},
});

const pintar = (dt: DayType, onDespensa: (d: Record<string, DespensaComida>) => void = () => {}) =>
  render(
    <MemoryRouter>
      <DayTemplateBar dayType={dt} onDespensa={onDespensa} />
    </MemoryRouter>,
  );

describe('Partir de una plantilla de día', () => {
  beforeEach(() => {
    localStorage.clear();
    guardarPlantillasDia([
      {
        id: 'pd1',
        nombre: 'Día de siempre',
        comidas: { desayuno: ['a-huevo', 'a-avena-copos'], cena: ['a-merluza-cruda'] },
        createdAt: '2026-01-01',
      },
    ]);
  });

  it('enseña las plantillas y cuántas comidas cubren', () => {
    pintar(dia());
    expect(screen.getByText('Día de siempre')).toBeTruthy();
    expect(screen.getByText('2 comidas')).toBeTruthy();
  });

  it('un clic deja el día montado', () => {
    const onDespensa = vi.fn();
    pintar(dia(), onDespensa);
    fireEvent.click(screen.getByText('Día de siempre'));
    const d = onDespensa.mock.calls[0][0];
    expect(d.m1.seleccion).toEqual(['a-huevo', 'a-avena-copos']);
    expect(d.m2.seleccion).toEqual(['a-merluza-cruda']);
  });

  it('el "+" suma a lo que ya había en vez de sustituirlo', () => {
    const onDespensa = vi.fn();
    pintar(dia({ m1: { seleccion: ['a-platano'] } }), onDespensa);
    fireEvent.click(screen.getByTitle(/Añadir a lo que ya hay/));
    expect(onDespensa.mock.calls[0][0].m1.seleccion).toEqual([
      'a-platano',
      'a-huevo',
      'a-avena-copos',
    ]);
  });

  it('el día montado se guarda como plantilla nueva', () => {
    pintar(dia({ m1: { seleccion: ['a-huevo'] } }));
    fireEvent.click(screen.getByText(/Guardar este día como plantilla/));
    fireEvent.change(screen.getByPlaceholderText('Día de entreno'), {
      target: { value: 'Día alto en HC' },
    });
    fireEvent.click(screen.getByText('Guardar'));
    expect(leerPlantillasDia().map((p) => p.nombre)).toContain('Día alto en HC');
  });

  it('sin nada montado no deja guardar', () => {
    pintar(dia());
    const boton = screen.getByText(/Guardar este día como plantilla/) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
  });

  it('borrar pide confirmación', () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    pintar(dia());
    fireEvent.click(screen.getByLabelText(/Borrar la plantilla Día de siempre/));
    expect(confirmar).toHaveBeenCalled();
    expect(leerPlantillasDia()).toHaveLength(1);
    confirmar.mockRestore();
  });

  it('una plantilla que no cubre ninguna comida del día no se puede aplicar', () => {
    guardarPlantillasDia([
      {
        id: 'pd2',
        nombre: 'Sólo meriendas',
        comidas: { merienda: ['a-nueces'] },
        createdAt: '2026-01-01',
      },
    ]);
    pintar(dia());
    const boton = screen.getByText('Sólo meriendas').closest('button') as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
  });
});
