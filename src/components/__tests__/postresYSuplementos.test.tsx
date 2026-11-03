// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LoFijoDeLaComida } from '../client/LoFijoDeLaComida';
import { LoQueVaSiempre } from '../planning/LoQueVaSiempre';
import type { Alimento } from '../../types/food';
import type { DayType, Fijo } from '../../types/plan';

afterEach(cleanup);

/**
 * POSTRES, SUPLEMENTOS Y ACOMPAÑAMIENTOS
 *
 * Sus palabras: «en lo que incluye cada día debo también poder poner postres,
 * suplementos o acompañamientos — el yogur Alpro con frutos rojos de postre
 * todas las noches, o un flan de proteína de postre».
 *
 * Todos se pautan igual y gastan igual de lo pautado; lo único que cambia es
 * cómo se lee. Hacía falta porque un flan de proteína leído en la línea de
 * «con esta comida» parecía un ingrediente del plato.
 */

const YOGUR: Alimento = {
  id: 'a-yogur',
  nombre: 'Yogur Alpro',
  grupo: 'lacteos_proteicos',
  medida_casera: '150 g',
  gramos: 150,
  intercambios: 1,
  nutrientes: { kcal: 60, hc: 4.7, proteina: 5.8, grasa: 2 },
  comidas_sugeridas: [],
  alergenos: [],
  apto: [],
};

const ROJOS: Alimento = {
  ...YOGUR,
  id: 'a-rojos',
  nombre: 'Frutos rojos',
  grupo: 'fruta',
  gramos: 125,
};

const fijo = (id: string, nombre: string, tipo: Fijo['tipo'], foodId?: string): Fijo => ({
  id,
  nombre,
  gramos: 100,
  unidad: 'g',
  tipo,
  foodId,
});

describe('Cómo lo lee la clienta', () => {
  /* El caso que ella puso: el postre de todas las noches, de dos cosas. */
  it('el yogur con frutos rojos sale junto, de postre', () => {
    render(
      <LoFijoDeLaComida
        fijos={[
          fijo('f1', 'Yogur Alpro', 'postre', YOGUR.id),
          fijo('f2', 'Frutos rojos', 'postre', ROJOS.id),
        ]}
        mealNombre="Cena"
      />,
    );
    expect(screen.getByText('De postre')).toBeTruthy();
    expect(screen.getByText('Yogur Alpro')).toBeTruthy();
    expect(screen.getByText('Frutos rojos')).toBeTruthy();
    expect(screen.queryByText('Con esta comida')).toBeNull();
  });

  it('cada tipo tiene su bloque', () => {
    render(
      <LoFijoDeLaComida
        fijos={[
          fijo('f1', 'Café con leche', 'con'),
          fijo('f2', 'Ensalada', 'acompanamiento'),
          fijo('f3', 'Flan de proteína', 'postre'),
          fijo('f4', 'Creatina', 'suplemento'),
        ]}
        mealNombre="Comida"
      />,
    );
    for (const t of ['Con esta comida', 'De acompañamiento', 'De postre', 'Suplemento'])
      expect(screen.getByText(t)).toBeTruthy();
  });

  /* Los de antes no tenían tipo: van con la comida, que es como nacieron. */
  it('lo de antes sigue leyéndose igual', () => {
    render(
      <LoFijoDeLaComida fijos={[fijo('f1', 'Café con leche', undefined)]} mealNombre="Desayuno" />,
    );
    expect(screen.getByText('Con esta comida')).toBeTruthy();
  });
});

/* ──────────────────────── Y donde ella lo pone ──────────────────────────── */

const DIA: DayType = {
  id: 'dt',
  nombre: 'Base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [{ id: 'cena', nombre: 'Cena', slot: 'cena', orden: 5 }],
  grid: { cena: { lacteos_proteicos: 1, fruta: 1 } },
  notas: {},
  fijos: { cena: [fijo('f1', 'Yogur Alpro', 'con', YOGUR.id)] },
} as DayType;

describe('Al pautarlo', () => {
  const pintar = () => {
    const onChange = vi.fn();
    render(<LoQueVaSiempre dayType={DIA} foods={[YOGUR, ROJOS]} onChange={onChange} />);
    return onChange;
  };

  it('se puede decir de qué es', () => {
    const onChange = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Postre' }));
    expect(onChange).toHaveBeenCalledWith({
      cena: [expect.objectContaining({ tipo: 'postre' })],
    });
  });

  it('los cuatro tipos están', () => {
    pintar();
    for (const t of ['Con la comida', 'Acompañamiento', 'Postre', 'Suplemento'])
      expect(screen.getByRole('button', { name: t })).toBeTruthy();
  });

  /*
   * La creatina no está en el catálogo de alimentos y no tiene por qué estar:
   * no se come y no descuenta nada.
   */
  it('y se puede escribir algo que no esté en el catálogo', () => {
    const onChange = pintar();
    fireEvent.change(screen.getByLabelText(/no está en el catálogo a cena/i), {
      target: { value: 'Creatina' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(onChange).toHaveBeenCalledWith({
      cena: [
        expect.objectContaining({ nombre: 'Yogur Alpro' }),
        expect.objectContaining({ nombre: 'Creatina', tipo: 'suplemento', gramos: 0 }),
      ],
    });
  });

  /* Sin alimento detrás no gasta: se dice, para que no parezca un olvido. */
  it('y se dice que eso no gasta nada', () => {
    render(
      <LoQueVaSiempre
        dayType={{ ...DIA, fijos: { cena: [fijo('f9', 'Creatina', 'suplemento')] } } as DayType}
        foods={[YOGUR]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/no gasta nada/)).toBeTruthy();
  });
});
