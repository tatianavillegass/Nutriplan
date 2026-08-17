// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  AlimentosDeClientes,
  alimentosDeClientes,
} from '../food/AlimentosDeClientes';
import { registroVacio } from '../../types/diary';
import type { Alimento } from '../../types/food';
import type { Client } from '../../types/client';
import type { RegistroDia } from '../../types/diary';

afterEach(cleanup);
// Lo descartado se guarda en el navegador: sin limpiarlo, una prueba se lleva
// por delante la siguiente.
beforeEach(() => localStorage.clear());

const CLIENTE = { id: 'c1', nombre: 'Marta Ruiz' } as unknown as Client;

const suyo = (nombre: string): Alimento =>
  ({
    id: `mio_${nombre}`,
    nombre,
    medida_casera: '100 g',
    gramos: 100,
    intercambios: 1,
    nutrientes: { proteina: 10, hc: 4, grasa: 3 },
    custom: true,
  }) as unknown as Alimento;

const dia = (fecha: string, alimentos: Alimento[]): RegistroDia => ({
  ...registroVacio('c1', fecha, `r-${fecha}`),
  alimentosPropios: alimentos,
});

/**
 * LO QUE APUNTAN ELLOS, REVISADO POR TI
 *
 * Un dato mal copiado en el catálogo se llevaría por delante los planes de todo
 * el mundo, así que lo suyo se queda suyo hasta que la nutricionista lo mira.
 * Pero casi siempre es un alimento que le sirve a más gente.
 */
describe('Los alimentos que apuntan los clientes', () => {
  it('se juntan de todos sus días, del más nuevo al más viejo', () => {
    const lista = alimentosDeClientes(
      [CLIENTE],
      [dia('2026-08-10', [suyo('Granola')]), dia('2026-08-14', [suyo('Yogur de marca')])],
      [],
    );
    expect(lista.map((x) => x.alimento.nombre)).toEqual(['Yogur de marca', 'Granola']);
    expect(lista[0].quien).toBe('Marta');
  });

  it('lo que ya está en el catálogo no se vuelve a ofrecer', () => {
    const lista = alimentosDeClientes(
      [CLIENTE],
      [dia('2026-08-14', [suyo('Granola')])],
      [suyo('granola')],
    );
    expect(lista).toEqual([]);
  });

  it('y el mismo alimento repetido en varios días sale una vez', () => {
    const lista = alimentosDeClientes(
      [CLIENTE],
      [dia('2026-08-10', [suyo('Granola')]), dia('2026-08-14', [suyo('Granola')])],
      [],
    );
    expect(lista).toHaveLength(1);
  });

  /** No todo sirve: media lista son marcas de una tienda concreta. */
  it('lo descartado deja de proponerse', () => {
    const lista = alimentosDeClientes(
      [CLIENTE],
      [dia('2026-08-14', [suyo('Granola')])],
      [],
      ['granola'],
    );
    expect(lista).toEqual([]);
  });

  it('y se descarta con su × sin tocar el alimento de quien lo creó', () => {
    render(
      <AlimentosDeClientes
        clients={[CLIENTE]}
        registros={[dia('2026-08-14', [suyo('Yogur de marca')])]}
        foods={[]}
        onAnadir={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Descartar Yogur de marca'));
    expect(screen.queryByText('Yogur de marca')).toBeNull();
  });

  it('sin nada apuntado, la sección no ocupa sitio', () => {
    const { container } = render(
      <AlimentosDeClientes clients={[CLIENTE]} registros={[]} foods={[]} onAnadir={vi.fn()} />,
    );
    expect(container.textContent).toBe('');
  });

  it('se ven sus números y pasan al catálogo cuando tú lo dices', () => {
    const onAnadir = vi.fn();
    render(
      <AlimentosDeClientes
        clients={[CLIENTE]}
        registros={[dia('2026-08-14', [suyo('Yogur de marca')])]}
        foods={[]}
        onAnadir={onAnadir}
      />,
    );
    expect(screen.getByText('Yogur de marca')).toBeTruthy();
    // Los números a la vista para poder comprobarlos de un golpe.
    expect(document.body.textContent?.replace(/\s+/g, ' ')).toContain(
      'P 10,0 · HC 4,0 · G 3,0',
    );

    fireEvent.click(screen.getByText('Añadir al catálogo'));
    expect(onAnadir).toHaveBeenCalled();
    expect(screen.getByText(/En el catálogo/)).toBeTruthy();
  });
});
