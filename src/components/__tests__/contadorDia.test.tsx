// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ContadorDia } from '../phase4/ContadorDia';
import { RecetasDeConsulta } from '../phase4/RecetasDeConsulta';
import type { DayType } from '../../types/plan';
import type { Bocado } from '../../types/diary';
import type { Alimento } from '../../types/food';
import type { Receta } from '../../types/recipe';

afterEach(cleanup);

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [{ id: 'comida', nombre: 'Comida', slot: 'comida', orden: 1 }],
  grid: { comida: { proteicos_magros: 4, almidones: 3, grasas: 2 } },
  notas: {},
};

const POLLO = {
  id: 'a-pollo',
  nombre: 'Pechuga de pollo',
  grupo: 'proteicos_magros',
  bucket: 'proteina',
  medida_casera: '30 g',
  gramos: 30,
  intercambios: 1,
  nutrientes: { proteina: 23, hc: 0, grasa: 2 },
  comidas_sugeridas: [],
  alergenos: [],
  apto: [],
} as unknown as Alimento;

const BOCADO: Bocado = {
  id: 'b1',
  nombre: 'Pechuga de pollo',
  cantidad: 150,
  unidad: 'g',
  macros: { proteina: 34.5, hc: 0, grasa: 3 },
  kcal: 165,
};

/**
 * EL CONTADOR DE LA FASE 4
 *
 * Lo que se enseña es lo que llevas, nunca lo que te queda: un número que baja
 * hasta cero y se pone en rojo convierte cenar en un descubierto, y esa es la
 * parte de contar macros que hace daño.
 */
describe('Lo que ve quien cuenta macros', () => {
  const pintar = (bocados: Bocado[] = [], onAnadir = vi.fn(), onQuitar = vi.fn()) =>
    render(
      <ContadorDia
        dayType={DIA}
        bocados={bocados}
        foods={[POLLO]}
        onAnadir={onAnadir}
        onQuitar={onQuitar}
      />,
    );

  it('el objetivo del día son sus intercambios en gramos', () => {
    pintar();
    expect(screen.getByText('Calorías')).toBeTruthy();
    // 34 g de proteína, 42 de hidrato y 13,5 de grasa.
    const texto = document.body.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(texto).toContain('/ 34 g');
    expect(texto).toContain('/ 42 g');
  });

  it('dice lo que llevas, no lo que te queda', () => {
    pintar([BOCADO]);
    const texto = document.body.textContent ?? '';
    expect(texto).not.toMatch(/te quedan|restantes/i);
    expect(screen.getByText('Lo que llevas hoy')).toBeTruthy();
  });

  it('con el día vacío no se le juzga', () => {
    pintar();
    expect(screen.getByText(/Todavía no has apuntado nada/i)).toBeTruthy();
  });

  it('lo apuntado se ve con sus gramos y se puede quitar', () => {
    const onQuitar = vi.fn();
    pintar([BOCADO], vi.fn(), onQuitar);
    expect(screen.getByText(/Pechuga de pollo/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Quitar Pechuga de pollo'));
    expect(onQuitar).toHaveBeenCalledWith('b1');
  });

  /** Ni racha de registro, ni nota del día, ni proyección de peso. */
  it('no engancha con rachas ni proyecciones', () => {
    pintar([BOCADO]);
    const texto = document.body.textContent ?? '';
    expect(texto).not.toMatch(/racha|días seguidos|pesarías|adherencia/i);
  });

  it('se busca el alimento, se ponen los gramos y se añade', () => {
    const onAnadir = vi.fn();
    pintar([], onAnadir);

    fireEvent.change(screen.getByPlaceholderText(/Qué has comido/i), {
      target: { value: 'pollo' },
    });
    fireEvent.click(screen.getByText(/Pechuga de pollo/));
    fireEvent.click(screen.getByText('Añadir'));

    expect(onAnadir).toHaveBeenCalled();
    const [bocado] = onAnadir.mock.calls[0];
    expect(bocado.nombre).toBe('Pechuga de pollo');
    // La medida casera del alimento son 30 g: es lo que propone.
    expect(bocado.cantidad).toBe(30);
    expect(bocado.macros.proteina).toBeCloseTo(6.9, 5);
  });

  /** Sin esta salida, un yogur de marca dejaba el día a medias. */
  it('lo que no está en la lista se apunta con su etiqueta', () => {
    const onAnadir = vi.fn();
    pintar([], onAnadir);

    fireEvent.click(screen.getByText(/Copia su etiqueta/i));
    expect(screen.getByText(/Por 100 g, según la etiqueta/i)).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/Qué es:/i), {
      target: { value: 'Yogur de la marca esa' },
    });
    const campos = document.querySelectorAll('input[type="number"]');
    // Proteína, carbohidrato, grasa y fibra por 100 g; el último es la cantidad.
    fireEvent.change(campos[0], { target: { value: '10' } });
    fireEvent.change(campos[1], { target: { value: '4' } });
    fireEvent.change(campos[2], { target: { value: '3' } });
    fireEvent.change(campos[4], { target: { value: '200' } });
    fireEvent.click(screen.getByText('Añadir'));

    const [bocado, alimentoNuevo] = onAnadir.mock.calls[0];
    expect(bocado.nombre).toBe('Yogur de la marca esa');
    expect(bocado.macros.proteina).toBeCloseTo(20, 5);
    // Y queda guardado, para poder volver a usarlo hoy mismo.
    expect(alimentoNuevo?.nombre).toBe('Yogur de la marca esa');
  });

  it('la nutricionista lo mira sin poder tocarlo', () => {
    render(
      <ContadorDia
        dayType={DIA}
        bocados={[BOCADO]}
        foods={[POLLO]}
        onAnadir={vi.fn()}
        onQuitar={vi.fn()}
        soloLectura
      />,
    );
    expect(screen.queryByText('Añadir')).toBeNull();
    expect(screen.queryByLabelText('Quitar Pechuga de pollo')).toBeNull();
  });
});

/**
 * Terminar el proceso no es perder el material. Las recetas se quedan, pero
 * plegadas: si se abren solas, la pantalla vuelve a decirle qué comer, que es
 * lo que esta fase deja atrás.
 */
describe('Las recetas en fase 4', () => {
  const RECETA: Receta = {
    id: 'rc1',
    nombre: 'Wok de pollo',
    categorias: ['comida'],
    tags: [],
    base: { proteicos_magros: 4, almidones: 3 },
    ingredientes: [],
    preparacion: '',
    notas: '',
    createdAt: '',
    updatedAt: '',
  };

  const CON_RECETA: DayType = { ...DIA, recetasAsignadas: { comida: ['rc1'] } };

  it('están a mano, pero cerradas', () => {
    render(<RecetasDeConsulta dayType={CON_RECETA} recipes={[RECETA]} foods={[POLLO]} />);
    expect(screen.getByText('Tus recetas')).toBeTruthy();
    expect(screen.queryByText('Wok de pollo')).toBeNull();
  });

  it('y se abren cuando ella quiere', () => {
    render(<RecetasDeConsulta dayType={CON_RECETA} recipes={[RECETA]} foods={[POLLO]} />);
    fireEvent.click(screen.getByText('Tus recetas'));
    expect(screen.getByText('Wok de pollo')).toBeTruthy();
  });

  it('sin recetas asignadas no ocupa sitio', () => {
    const { container } = render(
      <RecetasDeConsulta dayType={DIA} recipes={[RECETA]} foods={[POLLO]} />,
    );
    expect(container.textContent).toBe('');
  });
});

