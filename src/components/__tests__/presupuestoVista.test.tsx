// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PresupuestoDia, estadoDelMacro } from '../phase3/PresupuestoDia';
import type { DayType } from '../../types/plan';

afterEach(cleanup);

/** El número del anillo va partido en dos nodos por la barra. */
const fraccion = (texto: string) =>
  screen.getAllByText((_, el) => el?.textContent === texto).length > 0;

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

/**
 * EL PRESUPUESTO EN TRES ANILLOS
 *
 * Dentro del anillo va «2/6», la misma fracción que en los anillos de cada
 * comida. Poniendo sólo lo que queda no se sabía si el número era lo comido o
 * lo pendiente, así que lo que queda se dice debajo con palabras.
 *
 * El desglose por subgrupo empieza plegado: hace falta al ir a elegir, no todo
 * el rato, y en un móvil eso son varias pantallas menos.
 */
describe('Lo que lee la clienta de un vistazo', () => {
  it('cada macro tiene su anillo con lo que lleva del total', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{ desayuno: { almidones: 2 } }} />);
    expect(screen.getByText('Proteína')).toBeTruthy();
    expect(screen.getByText('Carbohidrato')).toBeTruthy();
    expect(screen.getByText('Grasa')).toBeTruthy();
    // 5 almidones + 1 fruta pautados en el día; lleva 2.
    expect(fraccion('2/6')).toBeTruthy();
  });

  it('debajo, lo que queda en palabras', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{ desayuno: { almidones: 2 } }} />);
    // Carbohidrato: 6 pautados, 2 puestos → quedan 4.
    expect(screen.getAllByText('te quedan 4').length).toBeGreaterThan(0);
  });

  it('cuando está completo lo dice, no hace contar', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{ comida: { grasas: 1 } }} />);
    // La comida reserva 1 grasa para el aceite: con 1 elegida ya está.
    expect(screen.getByText('completo ✓')).toBeTruthy();
  });

  it('y si se pasa, cuánto se ha pasado', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{ comida: { grasas: 2 } }} />);
    expect(screen.getByText('1 de más')).toBeTruthy();
  });

  it('las medias porciones se leen como medias', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{ comida: { grasas: 0.5 } }} />);
    expect(fraccion('½/1')).toBeTruthy();
    expect(screen.getByText('te quedan ½')).toBeTruthy();
  });
});

/**
 * ROJO SÓLO SI SE HA PASADO
 *
 * Un color, una cosa: ámbar es «te queda», verde es «ya está» y rojo es «te has
 * pasado». Antes cada macro llevaba su color y el de la grasa era rosa, así que
 * un día a medias se veía igual de alarmante que uno pasado.
 *
 * Y el margen es media porción: nadie come un cuarto de porción, así que los
 * decimales que salen de la calculadora de etiquetas no pueden pintar de rojo
 * un día bien comido.
 */
describe('De qué color va cada anillo', () => {
  it('mientras falta, ámbar', () => {
    expect(estadoDelMacro(4)).toBe('falta');
    expect(estadoDelMacro(0.5)).toBe('falta');
  });

  it('en la cuenta, verde', () => {
    expect(estadoDelMacro(0)).toBe('completo');
  });

  it('pasarse una décima no es pasarse', () => {
    expect(estadoDelMacro(-0.1)).toBe('completo');
    expect(estadoDelMacro(0.4)).toBe('completo');
  });

  it('media porción de más ya sí', () => {
    expect(estadoDelMacro(-0.5)).toBe('pasado');
    expect(estadoDelMacro(-2)).toBe('pasado');
  });

  it('y el anillo de un día a medias no se pinta de rojo', () => {
    const { container } = render(<PresupuestoDia dayType={DIA} seleccion={{}} />);
    expect(container.querySelectorAll('.stroke-rose-500')).toHaveLength(0);
    expect(container.querySelectorAll('.stroke-amber-500').length).toBeGreaterThan(0);
  });
});

describe('El desglose se despliega, no ocupa siempre', () => {
  it('de entrada no se ven los subgrupos', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{}} />);
    expect(screen.queryByText('Almidones')).toBeNull();
    expect(screen.getByText(/Ver de qué te queda/i)).toBeTruthy();
  });

  it('al abrirlo salen, con lo que queda de cada uno', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{ desayuno: { almidones: 2 } }} />);
    fireEvent.click(screen.getByText(/Ver de qué te queda/i));
    expect(screen.getByText('Almidones')).toBeTruthy();
    expect(screen.getByText('Fruta')).toBeTruthy();
    expect(screen.getByText('Proteicos magros')).toBeTruthy();
    // 2 de los 5 almidones del día.
    expect(screen.getByText('2 de 5')).toBeTruthy();
  });

  it('y se vuelve a plegar', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{}} />);
    fireEvent.click(screen.getByText(/Ver de qué te queda/i));
    fireEvent.click(screen.getByText(/Ocultar el desglose/i));
    expect(screen.queryByText('Almidones')).toBeNull();
  });
});

describe('Lo que se explica siempre', () => {
  it('que el total manda y el reparto es una intención', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{}} />);
    expect(screen.getByText(/lo repartes como te venga mejor/i)).toBeTruthy();
    expect(screen.getByText(/pensado con una intención/i)).toBeTruthy();
  });

  it('que la verdura va aparte', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{}} />);
    expect(screen.getByText(/verdura va aparte/i)).toBeTruthy();
    expect(screen.queryByText('Verduras y hortalizas')).toBeNull();
  });

  it('que el aceite de cocinar ya está contado', () => {
    render(<PresupuestoDia dayType={DIA} seleccion={{}} />);
    expect(screen.getByText(/aceite de cocinar/i)).toBeTruthy();
    expect(screen.getByText(/no tienes que elegir/i)).toBeTruthy();
  });
});
