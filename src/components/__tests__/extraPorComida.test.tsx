// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MealExtras } from '../client/MealExtras';
import { ExtrasPanel } from '../client/ExtrasPanel';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import { extrasDeComida, extrasSinComida, veredictoExtras, balanceDelDia } from '../../utils/diary';
import type { Extra, RegistroDia } from '../../types/diary';
import type { DayType } from '../../types/plan';

afterEach(cleanup);

const extra = (id: string, nombre: string, kcal: number, momento?: string): Extra => ({
  id,
  nombre,
  macros: { proteina: 0, hc: 0, grasa: 0 },
  kcal,
  momento,
});

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 2 },
  ],
  grid: {
    desayuno: { proteicos_magros: 2, almidones: 3, grasas: 1 },
    cena: { proteicos_magros: 4, almidones: 2, grasas: 2 },
  },
  notas: {},
};

describe('El extra sabe en qué comida se tomó', () => {
  const todos = [
    extra('a', 'Cerveza', 150, 'cena'),
    extra('b', 'Galleta', 80, 'desayuno'),
    extra('c', 'Café con leche', 60),
  ];

  it('reparte los extras por comida', () => {
    expect(extrasDeComida(todos, 'cena').map((e) => e.nombre)).toEqual(['Cerveza']);
    expect(extrasDeComida(todos, 'desayuno').map((e) => e.nombre)).toEqual(['Galleta']);
  });

  it('los que no son de ninguna comida quedan como picoteo del día', () => {
    expect(extrasSinComida(todos, ['desayuno', 'cena']).map((e) => e.nombre)).toEqual([
      'Café con leche',
    ]);
  });

  it('un extra de una comida borrada no se pierde: pasa a suelto', () => {
    expect(extrasSinComida(todos, ['desayuno']).map((e) => e.nombre)).toEqual([
      'Cerveza',
      'Café con leche',
    ]);
  });

  it('todos suman al día, estén en la comida que estén', () => {
    const registro = { extras: todos } as RegistroDia;
    const balance = balanceDelDia(DIA, registro, FOOD_CATALOG, { asumirPlanCumplido: true });
    // 150 + 80 + 60 = 290 kcal por encima de lo pautado.
    expect(Math.round(balance.kcalTotal - balance.kcalPautado)).toBe(290);
  });
});

describe('El margen: hasta 10 % en línea, hasta 25 % moderado', () => {
  it('un desvío pequeño no alarma', () => {
    expect(veredictoExtras(9.9).tono).toBe('ok');
  });
  it('a partir del 10 % avisa', () => {
    expect(veredictoExtras(10).tono).toBe('aviso');
    expect(veredictoExtras(24.9).tono).toBe('aviso');
  });
  it('a partir del 25 % lo dice claro', () => {
    expect(veredictoExtras(25).tono).toBe('alto');
  });
});

describe('Añadir extra en una comida', () => {
  it('apunta el alimento con el momento de esa comida', () => {
    const onAnadir = vi.fn();
    render(
      <MealExtras
        mealId="cena"
        mealNombre="Cena"
        extras={[]}
        foods={FOOD_CATALOG}
        onAnadir={onAnadir}
        onQuitar={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('+ Añadir extra'));
    const caja = screen.getByPlaceholderText(/Lo que te hayas tomado de más/);
    fireEvent.change(caja, { target: { value: 'Chocolate negro' } });
    fireEvent.change(screen.getByDisplayValue('100'), { target: { value: '20' } });
    fireEvent.click(screen.getByText('Añadir'));

    expect(onAnadir).toHaveBeenCalledTimes(1);
    const nuevo = onAnadir.mock.calls[0][0] as Extra;
    expect(nuevo.momento).toBe('cena');
    expect(nuevo.nombre).toBe('Chocolate negro');
  });

  it('enseña las kcal ya apuntadas en esa comida', () => {
    render(
      <MealExtras
        mealId="cena"
        mealNombre="Cena"
        extras={[extra('a', 'Cerveza', 150, 'cena')]}
        foods={FOOD_CATALOG}
        onAnadir={() => {}}
        onQuitar={() => {}}
      />,
    );
    expect(screen.getByText(/150 kcal de extra en cena/)).toBeTruthy();
  });

  it('sin extras y en sólo lectura no pinta nada', () => {
    const { container } = render(
      <MealExtras
        mealId="cena"
        mealNombre="Cena"
        extras={[]}
        foods={FOOD_CATALOG}
        onAnadir={() => {}}
        onQuitar={() => {}}
        soloLectura
      />,
    );
    expect(container.textContent).toBe('');
  });
});

describe('El resumen del día enseña dónde cayó cada extra', () => {
  it('pone el nombre de la comida junto al extra', () => {
    const todos = [extra('a', 'Cerveza', 150, 'cena')];
    const balance = balanceDelDia(DIA, { extras: todos } as RegistroDia, FOOD_CATALOG, {
      asumirPlanCumplido: true,
    });
    render(
      <ExtrasPanel
        extras={todos}
        foods={FOOD_CATALOG}
        balance={balance}
        nombreMomento={(m) => DIA.meals.find((x) => x.id === m)?.nombre}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Cena')).toBeTruthy();
    expect(screen.getByText('Cerveza')).toBeTruthy();
  });
});
