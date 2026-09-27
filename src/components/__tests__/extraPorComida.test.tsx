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

    // El botón lleva el nombre de la comida: está al final del bloque, pegado
    // a la comida siguiente, y sin decirlo no se sabe a cuál apunta.
    fireEvent.click(screen.getByText('+ Añadir extra en cena'));
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

/**
 * EL FIN DE SEMANA DE NORMA
 *
 * No come por comidas: pica, come con amigas. Lo apunta aquí y lo que quiere
 * saber no es cuánto se ha desviado, sino si ha llegado a su proteína. Por eso
 * puede decir «esto era mi comida», igual que ya se podía con los postres.
 */
describe('Decir si lo apuntado era su comida o fue de más', () => {
  const pintar = (onAnadir = vi.fn()) => {
    render(
      <MealExtras
        mealId="cena"
        mealNombre="Cena"
        extras={[]}
        foods={FOOD_CATALOG}
        onAnadir={onAnadir}
        onQuitar={() => {}}
        puedeContarEnElPlan
      />,
    );
    fireEvent.click(screen.getByText('+ Añadir extra en cena'));
    return onAnadir;
  };

  it('con un alimento del catálogo elegido, salen los dos botones', () => {
    pintar();
    fireEvent.change(screen.getByPlaceholderText(/Lo que te hayas tomado de más/), {
      target: { value: 'Pechuga de pollo' },
    });
    fireEvent.click(screen.getAllByText(/Pechuga de pollo/)[0]);
    expect(screen.getByText('Cuéntamelo en el plan')).toBeTruthy();
    expect(screen.getByText('Fue de más')).toBeTruthy();
  });

  it('y «cuéntamelo en el plan» lo deja marcado para gastar porciones', () => {
    const onAnadir = pintar();
    fireEvent.change(screen.getByPlaceholderText(/Lo que te hayas tomado de más/), {
      target: { value: 'Pechuga de pollo' },
    });
    fireEvent.click(screen.getAllByText(/Pechuga de pollo/)[0]);
    fireEvent.click(screen.getByText('Cuéntamelo en el plan'));
    expect((onAnadir.mock.calls[0][0] as Extra).enElPlan).toBe(true);
  });

  /* Unas calorías escritas a ojo no dicen de qué grupo son: no hay porciones
     que calcular, así que no se ofrece la elección. */
  it('apuntado a ojo no se puede contar, y sigue el botón de siempre', () => {
    pintar();
    fireEvent.change(screen.getByPlaceholderText(/Lo que te hayas tomado de más/), {
      target: { value: 'Tarta de la abuela' },
    });
    expect(screen.getByText('Añadir')).toBeTruthy();
    expect(screen.queryByText('Cuéntamelo en el plan')).toBeNull();
  });

  it('en las demás fases no se pregunta', () => {
    render(
      <MealExtras
        mealId="cena"
        mealNombre="Cena"
        extras={[]}
        foods={FOOD_CATALOG}
        onAnadir={() => {}}
        onQuitar={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('+ Añadir extra en cena'));
    fireEvent.change(screen.getByPlaceholderText(/Lo que te hayas tomado de más/), {
      target: { value: 'Pechuga de pollo' },
    });
    fireEvent.click(screen.getAllByText(/Pechuga de pollo/)[0]);
    expect(screen.queryByText('Cuéntamelo en el plan')).toBeNull();
  });

  /* Se apunta el postre pensando que va encima y luego se decide dejarse la
     fruta de la merienda: un botón que sólo se pulsa una vez no se pulsa. */
  it('se puede cambiar de idea después', () => {
    const onCambiar = vi.fn();
    render(
      <MealExtras
        mealId="cena"
        mealNombre="Cena"
        extras={[extra('a', 'Cerveza', 150, 'cena')]}
        foods={FOOD_CATALOG}
        onAnadir={() => {}}
        onQuitar={() => {}}
        onCambiarDestino={onCambiar}
        puedeContarEnElPlan
      />,
    );
    fireEvent.click(screen.getByText('de más'));
    expect(onCambiar).toHaveBeenCalledWith('a', true);
  });

  /* Lo que cuenta en el plan ya está dentro de sus porciones: contarlo aquí
     además sería decir dos veces lo mismo. */
  it('lo que cuenta en el plan no suma en las kcal de extra de la comida', () => {
    render(
      <MealExtras
        mealId="cena"
        mealNombre="Cena"
        extras={[{ ...extra('a', 'Pollo', 150, 'cena'), enElPlan: true }]}
        foods={FOOD_CATALOG}
        onAnadir={() => {}}
        onQuitar={() => {}}
        puedeContarEnElPlan
      />,
    );
    expect(screen.queryByText(/kcal de extra en cena/)).toBeNull();
    expect(screen.getByText('en el plan')).toBeTruthy();
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
