// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PresupuestoDia } from '../phase3/PresupuestoDia';
import type { DayType } from '../../types/plan';

afterEach(cleanup);

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 2 },
  ],
  grid: {
    desayuno: { almidones: 2, fruta: 1 },
    comida: { proteicos_magros: 4, almidones: 3, grasas: 2, verduras: 2 },
  },
  notas: {},
};

describe('Lo que lee la clienta en el presupuesto', () => {
  it('dice el total del día y lo que le queda', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{ desayuno: { almidones: 2 } }} />);
    // Carbohidrato: 5 almidones + 1 fruta pautados en todo el día, lleva 2.
    const carbo = screen.getByText('2 de 6').closest('div')!.parentElement!;
    expect(carbo.textContent).toContain('te quedan 4');
    // Y el desglose dice de cuál: 2 de los 5 almidones.
    expect(carbo.textContent).toContain('2/5');
  });

  it('desglosa los subgrupos, que es lo que escoge de verdad', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{}} />);
    expect(screen.getByText('Almidones')).toBeTruthy();
    expect(screen.getByText('Fruta')).toBeTruthy();
    expect(screen.getByText('Proteicos magros')).toBeTruthy();
  });

  it('avisa cuando ya está completo', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{ comida: { grasas: 2 } }} />);
    expect(screen.getByText('completo')).toBeTruthy();
  });

  it('y cuando se ha pasado', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{ comida: { grasas: 3 } }} />);
    expect(screen.getByText('te has pasado 1')).toBeTruthy();
  });

  it('las medias porciones se leen como medias', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{ comida: { grasas: 0.5 } }} />);
    expect(screen.getByText('½ de 2')).toBeTruthy();
  });

  it('explica que el total manda y el reparto es una intención', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{}} />);
    expect(screen.getByText(/lo repartes como te venga mejor/i)).toBeTruthy();
    expect(screen.getByText(/pensado con una intención/i)).toBeTruthy();
  });

  it('recuerda que la verdura va aparte', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{}} />);
    expect(screen.getByText(/verdura va aparte/i)).toBeTruthy();
    expect(screen.queryByText('Verduras y hortalizas')).toBeNull();
  });
});
