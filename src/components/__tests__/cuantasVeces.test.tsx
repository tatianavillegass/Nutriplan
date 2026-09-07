// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CuantasVeces, type ComidaConOpciones } from '../phase2/CuantasVeces';
import type { MenuSemana } from '../../types/diary';
import type { OpcionEscalada } from '../../utils/mealOptions';

afterEach(cleanup);

/**
 * CUÁNTAS VECES, NO QUÉ DÍA
 *
 * En fase 2 la clienta come combinaciones que elige cada mañana. Pedirle que
 * diga «el martes huevos» le quita la libertad que esa fase existe para darle,
 * y sin saber qué come el jueves no hay lista de la compra.
 */

const opcion = (id: string, nombre: string, bucket: OpcionEscalada['bucket']) =>
  ({
    id,
    bucket,
    texto: nombre,
    cubre: {},
    unificada: false,
    items: [
      {
        foodId: `f-${id}`,
        nombre,
        grupo: 'proteicos_magros',
        intercambios: 2,
        gramos: 110,
        unidad: 'g',
        medida: nombre,
      },
    ],
  }) as OpcionEscalada;

const COMIDAS: ComidaConOpciones[] = [
  {
    mealId: 'desayuno',
    nombre: 'Desayuno',
    columnas: [
      {
        bucket: 'proteina',
        opciones: [opcion('a', '2 huevos', 'proteina'), opcion('b', '2 claras', 'proteina')],
      },
      { bucket: 'carbohidrato', opciones: [opcion('c', '60 g de pan', 'carbohidrato')] },
    ],
  },
];

const menu = (veces?: MenuSemana['veces']): MenuSemana => ({
  inicio: '2026-08-31',
  dias: {},
  veces,
});

describe('Los + y − de cada opción', () => {
  it('suben y bajan las veces de esa opción', () => {
    const onCambiar = vi.fn();
    render(
      <CuantasVeces menu={menu()} comidas={COMIDAS} onCambiar={onCambiar} />,
    );
    fireEvent.click(screen.getByLabelText('Una vez más de 2 huevos'));
    expect(onCambiar.mock.calls[0][0].veces.desayuno.a).toBe(1);
  });

  it('a cero no se puede bajar más', () => {
    render(<CuantasVeces menu={menu()} comidas={COMIDAS} onCambiar={vi.fn()} />);
    expect(
      (screen.getByLabelText('Una vez menos de 2 huevos') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('y de siete no se pasa', () => {
    render(
      <CuantasVeces
        menu={menu({ desayuno: { a: 7 } })}
        comidas={COMIDAS}
        onCambiar={vi.fn()}
      />,
    );
    expect(
      (screen.getByLabelText('Una vez más de 2 huevos') as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

/**
 * Se cuenta por macro: las columnas de fase 2 son independientes y cada una
 * tiene que llegar a siete por su cuenta.
 */
describe('Lo que falta', () => {
  it('se dice por macro, no por comida entera', () => {
    render(
      <CuantasVeces
        menu={menu({ desayuno: { a: 3, b: 2, c: 7 } })}
        comidas={COMIDAS}
        onCambiar={vi.fn()}
      />,
    );
    // Proteína: 3 + 2 = 5, faltan 2. Carbohidrato: 7, completo.
    expect(screen.getByText('2 sin decidir')).toBeTruthy();
    expect(screen.getByText('los 7 puestos')).toBeTruthy();
  });

  /** Dejar días sueltos para improvisar es una decisión, no un fallo. */
  it('sin bloquear nada y sin reñir', () => {
    render(
      <CuantasVeces
        menu={menu({ desayuno: { a: 2 } })}
        comidas={COMIDAS}
        onCambiar={vi.fn()}
      />,
    );
    const texto = document.body.textContent ?? '';
    expect(texto).not.toMatch(/falta.*complet|tienes que|debes/i);
    expect(screen.getByText('5 sin decidir')).toBeTruthy();
  });

  it('y pasarse también se dice', () => {
    render(
      <CuantasVeces
        menu={menu({ desayuno: { a: 5, b: 4 } })}
        comidas={COMIDAS}
        onCambiar={vi.fn()}
      />,
    );
    expect(screen.getByText('2 de más')).toBeTruthy();
  });
});

/**
 * NO ES UN MENÚ
 *
 * La app no le va a decir «hoy te tocan huevos»: esto es para la compra, y si
 * un día le apetece otra cosa la elige y ya.
 */
describe('El tono', () => {
  it('deja claro que es para comprar, no para obedecer', () => {
    render(<CuantasVeces menu={menu()} comidas={COMIDAS} onCambiar={vi.fn()} />);
    expect(document.body.textContent).toContain('no un menú');
  });

  it('y sin opciones que repartir lo dice en vez de quedarse en blanco', () => {
    render(
      <CuantasVeces
        menu={menu()}
        comidas={[{ mealId: 'x', nombre: 'Comida', columnas: [] }]}
        onCambiar={vi.fn()}
      />,
    );
    expect(document.body.textContent).toContain('Todavía no hay opciones');
  });
});
