// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { ContadorDia } from '../phase4/ContadorDia';
import { RecetasDeConsulta } from '../phase4/RecetasDeConsulta';
import type { DayType, Plan } from '../../types/plan';
import { DEMO_PLAN } from '../../data/demoSeed';
import type { Bocado } from '../../types/diary';
import type { Alimento } from '../../types/food';
import type { Receta } from '../../types/recipe';

afterEach(cleanup);

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 2 },
    { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 3 },
  ],
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
  momento: 'comida',
};


/** Cada comida tiene su propio «+ Añadir», en el orden del día. */
const abrirEn = (comida: string) => {
  const titulo = screen.getByText(new RegExp(`^${comida}$`, 'i'));
  const bloque = titulo.closest('div')?.parentElement as HTMLElement;
  fireEvent.click(within(bloque).getByText('+ Añadir'));
};

/**
 * EL CONTADOR DE LA FASE 4
 *
 * Lo que se enseña es lo que llevas, nunca lo que te queda: un número que baja
 * hasta cero y se pone en rojo convierte cenar en un descubierto, y esa es la
 * parte de contar macros que hace daño.
 */
describe('Lo que ve quien cuenta macros', () => {
  const pintar = (
    bocados: Bocado[] = [],
    onAnadir = vi.fn(),
    onQuitar = vi.fn(),
    onCantidad = vi.fn(),
  ) =>
    render(
      <ContadorDia
        dayType={DIA}
        bocados={bocados}
        foods={[POLLO]}
        onAnadir={onAnadir}
        onQuitar={onQuitar}
        onCantidad={onCantidad}
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

  /**
   * En una lista corrida hay que acordarse de qué has metido ya; por comidas se
   * ve de un vistazo que falta la cena.
   */
  it('lo apuntado se reparte por comidas', () => {
    pintar([BOCADO]);
    expect(screen.getByText('Desayuno')).toBeTruthy();
    expect(screen.getByText('Comida')).toBeTruthy();
    expect(screen.getByText('Cena')).toBeTruthy();
    // Y cada comida lleva su propia cuenta, aparte de la línea del alimento.
    expect(screen.getAllByText('165 kcal').length).toBe(2);
  });

  it('cada comida tiene su propio botón de añadir', () => {
    const onAnadir = vi.fn();
    pintar([], onAnadir);
    abrirEn('cena');

    fireEvent.change(screen.getByPlaceholderText(/Qué has comido/i), {
      target: { value: 'pollo' },
    });
    fireEvent.click(screen.getByText(/Pechuga de pollo/));
    fireEvent.click(screen.getByText('Añadir'));

    const [bocado] = onAnadir.mock.calls[0];
    expect(bocado.momento).toBe('cena');
  });

  /** Lo de antes de que hubiera comidas no se pierde: cae en la última. */
  it('lo apuntado sin comida no desaparece', () => {
    pintar([{ ...BOCADO, momento: undefined }]);
    expect(screen.getByText(/Pechuga de pollo/)).toBeTruthy();
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

  /**
   * Repetir el desayuno de ayer no sirve de nada si hoy te has puesto 20 g de
   * queso donde ayer había 40 y la única salida es borrarlo y buscarlo otra
   * vez: lo normal es repetir CASI lo mismo.
   */
  it('se toca lo apuntado y se cambian los gramos', () => {
    const onCantidad = vi.fn();
    pintar([BOCADO], vi.fn(), vi.fn(), onCantidad);

    fireEvent.click(screen.getByText(/Pechuga de pollo/));
    fireEvent.change(screen.getByLabelText(/Cantidad de Pechuga/i), {
      target: { value: '20' },
    });
    fireEvent.click(screen.getByText('Guardar'));
    expect(onCantidad).toHaveBeenCalledWith('b1', 20);
  });

  it('y en la vista de la nutricionista no se toca nada', () => {
    render(
      <ContadorDia
        dayType={DIA}
        bocados={[BOCADO]}
        foods={[POLLO]}
        onAnadir={vi.fn()}
        onQuitar={vi.fn()}
        onCantidad={vi.fn()}
        soloLectura
      />,
    );
    fireEvent.click(screen.getByText(/Pechuga de pollo/));
    expect(screen.queryByLabelText(/Cantidad de Pechuga/i)).toBeNull();
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
    abrirEn('comida');

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

  /**
   * Un desayuno son cuatro o cinco cosas: cerrando el buscador tras cada una
   * había que pulsar «añadir» cinco veces para apuntar una tostada.
   */
  it('el buscador se queda abierto para lo siguiente', () => {
    const onAnadir = vi.fn();
    pintar([], onAnadir);
    abrirEn('comida');

    fireEvent.change(screen.getByPlaceholderText(/Qué has comido/i), {
      target: { value: 'pollo' },
    });
    fireEvent.click(screen.getByText(/Pechuga de pollo/));
    fireEvent.click(screen.getByText('Añadir'));

    expect(onAnadir).toHaveBeenCalledTimes(1);
    // Y sigue ahí, vacío, esperando lo siguiente.
    expect(screen.getByPlaceholderText(/Qué has comido/i)).toBeTruthy();
  });

  it('y se cierra al tocar en cualquier otro sitio', () => {
    pintar();
    abrirEn('comida');
    expect(screen.getByPlaceholderText(/Qué has comido/i)).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByPlaceholderText(/Qué has comido/i)).toBeNull();
  });

  /** Sin esta salida, un yogur de marca dejaba el día a medias. */
  it('lo que no está en la lista se apunta con su etiqueta', () => {
    const onAnadir = vi.fn();
    pintar([], onAnadir);
    abrirEn('desayuno');

    fireEvent.click(screen.getByText(/Copia su etiqueta/i));
    expect(screen.getByText(/Por 100 g, según la etiqueta/i)).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/Qué es:/i), {
      target: { value: 'Yogur de la marca esa' },
    });
    const campos = document.querySelectorAll('input[inputmode="decimal"]');
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
        onCantidad={vi.fn()}
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

  /** Las recetas son del plan; los gramos, del día. */
  const planCon = (recetasAsignadas?: Record<string, string[]>) =>
    ({ ...DEMO_PLAN, fase: 4, dayTypes: [DIA], recetasAsignadas }) as Plan;

  it('están a mano, pero cerradas', () => {
    render(
      <RecetasDeConsulta
        plan={planCon({ comida: ['rc1'] })}
        dayType={DIA}
        recipes={[RECETA]}
        foods={[POLLO]}
      />,
    );
    expect(screen.getByText('Tus recetas')).toBeTruthy();
    expect(screen.queryByText('Wok de pollo')).toBeNull();
  });

  it('y se abren cuando ella quiere', () => {
    render(
      <RecetasDeConsulta
        plan={planCon({ comida: ['rc1'] })}
        dayType={DIA}
        recipes={[RECETA]}
        foods={[POLLO]}
      />,
    );
    fireEvent.click(screen.getByText('Tus recetas'));
    expect(screen.getByText('Wok de pollo')).toBeTruthy();
  });

  /**
   * Las que se pautaron cuando las recetas vivían en el tipo de día siguen
   * saliendo: nadie tiene que volver a elegirlas.
   */
  it('y las del formato viejo también', () => {
    const viejo: DayType = { ...DIA, recetasAsignadas: { comida: ['rc1'] } };
    render(
      <RecetasDeConsulta
        plan={
          {
            ...DEMO_PLAN,
            fase: 4,
            dayTypes: [viejo],
            recetasAsignadas: undefined,
          } as Plan
        }
        dayType={viejo}
        recipes={[RECETA]}
        foods={[POLLO]}
      />,
    );
    fireEvent.click(screen.getByText('Tus recetas'));
    expect(screen.getByText('Wok de pollo')).toBeTruthy();
  });

  it('sin recetas asignadas no ocupa sitio', () => {
    const { container } = render(
      <RecetasDeConsulta
        plan={planCon()}
        dayType={DIA}
        recipes={[RECETA]}
        foods={[POLLO]}
      />,
    );
    expect(container.textContent).toBe('');
  });
});


/**
 * COMER FUERA, TAMBIÉN CONTANDO GRAMOS
 *
 * Marcar una comida como libre existía en las otras fases y en la 4 no se
 * pintaba. Y es justo donde más falta hace: a una hamburguesa que no has
 * cocinado tú no se le ponen gramos, así que la única salida honesta es
 * decir «he comido fuera» y que no se cuente.
 */
describe('Una comida fuera en fase 4', () => {
  const props = {
    dayType: DIA,
    bocados: [] as Bocado[],
    foods: [POLLO],
    onAnadir: vi.fn(),
    onQuitar: vi.fn(),
    onCantidad: vi.fn(),
  };

  it('a la comida marcada no se le piden gramos', () => {
    render(<ContadorDia {...props} libres={{ cena: {} }} />);

    const cena = screen.getByText('Cena').closest('div')?.parentElement as HTMLElement;
    expect(within(cena).queryByText('+ Añadir')).toBeNull();

    // Y a las demás sí, que sólo se calla la que se comió fuera.
    const comida = screen.getByText('Comida').closest('div')?.parentElement as HTMLElement;
    expect(within(comida).getByText('+ Añadir')).toBeTruthy();
  });

  /**
   * Sin esta línea, el total del día se queda corto y parece que le falta
   * comida. No falta: es que esa comida no se mide.
   */
  it('y se explica por qué el día se queda corto', () => {
    render(<ContadorDia {...props} libres={{ cena: {} }} />);
    expect(screen.getByText(/Una comida fuera, que no se cuenta/i)).toBeTruthy();

    cleanup();
    render(<ContadorDia {...props} libres={{ cena: {}, comida: {} }} />);
    expect(screen.getByText(/2 comidas fuera, que no se cuentan/i)).toBeTruthy();
  });

  it('sin ninguna comida fuera no se dice nada', () => {
    render(<ContadorDia {...props} />);
    expect(screen.queryByText(/no se cuenta/i)).toBeNull();
  });

  /** El botón lo pinta la pantalla, que es quien sabe guardar. */
  it('el botón de la cabecera viene de fuera', () => {
    render(
      <ContadorDia
        {...props}
        botonLibre={(_id, nombre) => <button>Libre {nombre}</button>}
      />,
    );
    expect(screen.getByText('Libre Cena')).toBeTruthy();
  });
});
