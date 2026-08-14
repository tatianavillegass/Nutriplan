// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ComidaLibre } from '../client/ComidaLibre';
import { CalculadoraPorciones } from '../phase3/CalculadoraPorciones';
import { DayProgressBar } from '../client/DayProgressBar';
import { esComidaLibre, contarLibres, registroVacio } from '../../types/diary';
import { aporteDeAlimento } from '../../utils/exchanges';
import type { RegistroDia } from '../../types/diary';
import type { DayType } from '../../types/plan';
import type { Alimento } from '../../types/food';

afterEach(cleanup);

/**
 * COMIDA LIBRE
 *
 * Comer fuera no se mide: poner un número a una hamburguesa que no has
 * cocinado tú no informa de nada. Lo que sirve es la frecuencia, y eso se
 * apunta con un botón. La nota es opcional y en blanco.
 */
describe('Marcar una comida como libre', () => {
  it('no pide ningún número', () => {
    render(
      <ComidaLibre mealNombre="Cena" onMarcar={() => {}} onQuitar={() => {}} />,
    );
    fireEvent.click(screen.getByText('Comida libre'));
    expect(screen.queryByText(/kcal/i)).toBeNull();
    expect(screen.queryByText(/gramos/i)).toBeNull();
    expect(screen.getByText(/No hace falta contar nada/i)).toBeTruthy();
  });

  it('se puede marcar sin escribir nada', () => {
    const onMarcar = vi.fn();
    render(<ComidaLibre mealNombre="Cena" onMarcar={onMarcar} onQuitar={() => {}} />);
    fireEvent.click(screen.getByText('Comida libre'));
    fireEvent.click(screen.getByText('Marcar como libre'));
    expect(onMarcar).toHaveBeenCalledWith(undefined);
  });

  it('y con una nota si le apetece contarlo', () => {
    const onMarcar = vi.fn();
    render(<ComidaLibre mealNombre="Cena" onMarcar={onMarcar} onQuitar={() => {}} />);
    fireEvent.click(screen.getByText('Comida libre'));
    fireEvent.change(screen.getByPlaceholderText(/lo que quieras contar/i), {
      target: { value: 'Cumpleaños de mi hermana, muy a gusto' },
    });
    fireEvent.click(screen.getByText('Marcar como libre'));
    expect(onMarcar).toHaveBeenCalledWith('Cumpleaños de mi hermana, muy a gusto');
  });

  it('ya marcada, enseña la nota y se puede deshacer', () => {
    const onQuitar = vi.fn();
    render(
      <ComidaLibre
        mealNombre="Cena"
        libre={{ nota: 'Pizza con amigos' }}
        onMarcar={() => {}}
        onQuitar={onQuitar}
      />,
    );
    expect(screen.getByText(/Cena libre · sin contar/)).toBeTruthy();
    expect(screen.getByText(/Pizza con amigos/)).toBeTruthy();
    fireEvent.click(screen.getByText('Deshacer'));
    expect(onQuitar).toHaveBeenCalled();
  });
});

describe('La frecuencia es lo que importa', () => {
  const dia = (fecha: string, libres: Record<string, { nota?: string }>): RegistroDia => ({
    ...registroVacio('cl1', fecha, `rg_${fecha}`),
    libres,
  });

  it('se sabe si una comida concreta fue libre', () => {
    const r = dia('2026-08-14', { cena: {} });
    expect(esComidaLibre(r, 'cena')).toBe(true);
    expect(esComidaLibre(r, 'comida')).toBe(false);
    expect(esComidaLibre(undefined, 'cena')).toBe(false);
  });

  it('se cuentan las de varios días, que es el dato de consulta', () => {
    expect(
      contarLibres([
        dia('2026-08-12', { cena: {} }),
        dia('2026-08-13', {}),
        dia('2026-08-14', { comida: {}, cena: { nota: 'boda' } }),
      ]),
    ).toBe(3);
  });
});

describe('Una comida libre no queda pendiente', () => {
  const DIA: DayType = {
    id: 'dt',
    nombre: 'Día base',
    proteinaGkg: 2,
    hcGkg: 3,
    meals: [
      { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 1 },
      { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 2 },
    ],
    grid: { comida: { proteicos_magros: 4 }, cena: { proteicos_magros: 3 } },
    notas: {},
  };

  it('sale como libre y cuenta como resuelta', () => {
    render(
      <DayProgressBar dayType={DIA} porciones={{}} cumplidas={['comida']} libres={{ cena: {} }} />,
    );
    expect(screen.getByText('libre')).toBeTruthy();
    // La hecha y la libre: el día está resuelto.
    expect(screen.getByText('2 de 2 comidas hechas')).toBeTruthy();
  });
});

/**
 * CALCULADORA DE PORCIONES
 *
 * Para lo envasado que no está en la despensa: ahí la etiqueta existe y el
 * número es real. Traduce a porciones del plan y enseña el sistema.
 */
describe('¿A cuánto equivale un alimento?', () => {
  const abrir = (onAnadir = vi.fn()) => {
    render(
      <CalculadoraPorciones comidas={[{ id: 'desayuno', nombre: 'Desayuno' }]} onAnadir={onAnadir} />,
    );
    fireEvent.click(screen.getByText(/A cuánto equivale un alimento/i));
    return onAnadir;
  };

  /** Granola: 60 g de hidrato, 10 de proteína, 20 de grasa por 100 g. */
  const rellenarGranola = (gramos: string) => {
    const cajas = screen.getAllByRole('spinbutton');
    fireEvent.change(cajas[0], { target: { value: '60' } }); // hc
    fireEvent.change(cajas[1], { target: { value: '10' } }); // proteína
    fireEvent.change(cajas[2], { target: { value: '20' } }); // grasa
    fireEvent.change(cajas[4], { target: { value: gramos } }); // cuánto ha comido
  };

  it('traduce los gramos a porciones del plan', () => {
    abrir();
    rellenarGranola('40');
    // 40 g → 24 g de hidrato (1½ almidón), 4 de proteína, 8 de grasa (1½).
    expect(screen.getByText(/almidones/i)).toBeTruthy();
    expect(screen.getByText(/grasas/i)).toBeTruthy();
  });

  it('lo que no llega a media porción no se cuenta', () => {
    abrir();
    rellenarGranola('40');
    // 4 g de proteína son 0,57 porciones: se redondea a ½ y sí sale.
    // Con 10 g comidos, 1 g de proteína no llega y desaparece.
    fireEvent.change(screen.getAllByRole('spinbutton')[4], { target: { value: '10' } });
    expect(screen.queryByText(/proteicos magros/i)).toBeNull();
  });

  it('sin datos no inventa nada', () => {
    abrir();
    expect(screen.getByText(/no llega a media porción de nada/i)).toBeTruthy();
  });

  it('al añadirlo crea un alimento con su equivalencia', () => {
    const onAnadir = abrir();
    fireEvent.change(screen.getByPlaceholderText(/granola/i), { target: { value: 'Granola' } });
    rellenarGranola('40');
    fireEvent.click(screen.getByText(/Añadirlo a mi día/i));

    expect(onAnadir).toHaveBeenCalledTimes(1);
    const [alimento, mealId] = onAnadir.mock.calls[0] as [Alimento, string];
    expect(alimento.nombre).toBe('Granola');
    expect(mealId).toBe('desayuno');
    expect(alimento.gramos).toBe(40);
    // Se apunta como compuesto: así cuenta en todos los macros a la vez.
    expect(alimento.equivale).toBeDefined();
    expect(alimento.equivale!.almidones).toBeGreaterThan(0);
  });

  it('el alimento que crea cuenta como cualquier otro', () => {
    const onAnadir = abrir();
    rellenarGranola('40');
    fireEvent.click(screen.getByText(/Añadirlo a mi día/i));

    const [alimento] = onAnadir.mock.calls[0] as [Alimento, string];
    // Una porción de ese alimento son los intercambios que se calcularon.
    expect(aporteDeAlimento(alimento, 1)).toEqual(alimento.equivale);
  });
});

/**
 * CARPETAS DEL BANCO DE RECETAS
 *
 * La lógica es la misma que ya usa el recomendador: una receta está en una
 * carpeta si tiene esa categoría. Puede estar en varias —una tortilla vale de
 * cena y de almuerzo— y las que no tienen ninguna hay que poder encontrarlas.
 */
describe('Ordenar el banco por tipo de comida', () => {
  const receta = (nombre: string, categorias: string[]) =>
    ({ nombre, categorias }) as unknown as { nombre: string; categorias: string[] };

  const banco = [
    receta('Avena', ['desayuno']),
    receta('Tortilla', ['cena', 'almuerzo']),
    receta('Wok', ['comida']),
    receta('Suelta', []),
  ];

  const enCarpeta = (r: { categorias: string[] }, carpeta: string) => {
    if (carpeta === 'todas') return true;
    if (carpeta === 'sin_clasificar') return !r.categorias.length;
    return r.categorias.includes(carpeta);
  };

  it('cada carpeta enseña lo suyo', () => {
    expect(banco.filter((r) => enCarpeta(r, 'desayuno')).map((r) => r.nombre)).toEqual(['Avena']);
    expect(banco.filter((r) => enCarpeta(r, 'comida')).map((r) => r.nombre)).toEqual(['Wok']);
  });

  it('una receta puede estar en dos carpetas', () => {
    expect(banco.filter((r) => enCarpeta(r, 'cena')).map((r) => r.nombre)).toEqual(['Tortilla']);
    expect(banco.filter((r) => enCarpeta(r, 'almuerzo')).map((r) => r.nombre)).toEqual(['Tortilla']);
  });

  it('las que no tienen categoría no se pierden', () => {
    expect(banco.filter((r) => enCarpeta(r, 'sin_clasificar')).map((r) => r.nombre)).toEqual([
      'Suelta',
    ]);
  });

  it('«todas» las enseña todas', () => {
    expect(banco.filter((r) => enCarpeta(r, 'todas'))).toHaveLength(4);
  });
});
