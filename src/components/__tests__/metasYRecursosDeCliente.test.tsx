// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MetasDiarias } from '../client/MetasDiarias';
import { RecursosDeCliente, MetasDeCliente } from '../planning/RecursosYMetas';
import type { Client } from '../../types/client';
import type { Recurso } from '../../types/recursos';

afterEach(cleanup);

const META = (id: string, texto: string, activa = true) => ({
  id,
  texto,
  activa,
  createdAt: '2026-08-01',
});

const CLIENTE = { id: 'cl1', nombre: 'Catalina' } as unknown as Client;

const RECURSOS: Recurso[] = [
  { id: 'rc1', titulo: 'Guía de raciones', orden: 0, createdAt: '2026-08-01' },
  { id: 'rc2', titulo: 'Productos recomendados', orden: 1, createdAt: '2026-08-01' },
];

/**
 * LAS METAS, DEL LADO DE QUIEN LAS CUMPLE
 *
 * Se marcan con un gesto y no piden número: «2 litros» es la meta, no hay que
 * apuntar cuántos vasos van.
 */
describe('Marcar las metas del día', () => {
  const pintar = (hechas: string[] = [], onAlternar = vi.fn()) => {
    render(
      <MetasDiarias
        metas={[META('a', 'Beber 2 litros de agua'), META('b', 'Caminar 10.000 pasos')]}
        hechas={hechas}
        onAlternar={onAlternar}
      />,
    );
    return onAlternar;
  };

  it('se ven todas, con lo que lleva marcado', () => {
    pintar(['a']);
    expect(screen.getByText('Beber 2 litros de agua')).toBeTruthy();
    expect(screen.getByText('1 de 2')).toBeTruthy();
  });

  it('un toque la marca', () => {
    const onAlternar = pintar();
    fireEvent.click(screen.getByText('Caminar 10.000 pasos'));
    expect(onAlternar).toHaveBeenCalledWith('b');
  });

  it('y otro la desmarca: nadie acierta a la primera', () => {
    const onAlternar = pintar(['a']);
    fireEvent.click(screen.getByText('Beber 2 litros de agua'));
    expect(onAlternar).toHaveBeenCalledWith('a');
  });

  it('no pide ningún número', () => {
    pintar();
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });

  /** Que no cuenten en las comidas hay que decirlo, o se lee como un fallo. */
  it('deja claro que van por su cuenta', () => {
    pintar();
    expect(screen.getByText(/no cuentan en las comidas/i)).toBeTruthy();
  });

  it('sin metas puestas no ocupa sitio', () => {
    const { container } = render(
      <MetasDiarias metas={[]} hechas={[]} onAlternar={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

/**
 * LOS RECURSOS SE ABREN DE UNO EN UNO
 *
 * De entrada no ve ninguno: el error de dar de más no se puede deshacer,
 * porque ya lo ha visto.
 */
describe('Elegir los recursos de una clienta', () => {
  it('de entrada no tiene ninguno', () => {
    render(<RecursosDeCliente client={CLIENTE} recursos={RECURSOS} onChange={() => {}} />);
    expect(screen.getByText(/Ve 0 de 2/)).toBeTruthy();
    for (const caja of screen.getAllByRole('checkbox')) {
      expect((caja as HTMLInputElement).checked).toBe(false);
    }
  });

  it('marcar uno se lo abre', () => {
    const onChange = vi.fn();
    render(<RecursosDeCliente client={CLIENTE} recursos={RECURSOS} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(onChange).toHaveBeenCalledWith({ recursos: ['rc1'] });
  });

  it('desmarcarlo se lo quita', () => {
    const onChange = vi.fn();
    render(
      <RecursosDeCliente
        client={{ ...CLIENTE, recursos: ['rc1', 'rc2'] }}
        recursos={RECURSOS}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(onChange).toHaveBeenCalledWith({ recursos: ['rc2'] });
  });

  it('sin recursos escritos, explica dónde se crean', () => {
    render(<RecursosDeCliente client={CLIENTE} recursos={[]} onChange={() => {}} />);
    expect(screen.getByText(/Todavía no has escrito ninguno/i)).toBeTruthy();
  });
});

describe('Escribir las metas de una clienta', () => {
  it('se añade una y queda activa', () => {
    const onChange = vi.fn();
    render(<MetasDeCliente client={CLIENTE} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/2 litros/i), {
      target: { value: 'Dormir 7 horas' },
    });
    fireEvent.click(screen.getByText('Añadir'));

    const [patch] = onChange.mock.calls[0] as [{ metas: { texto: string; activa: boolean }[] }];
    expect(patch.metas[0].texto).toBe('Dormir 7 horas');
    expect(patch.metas[0].activa).toBe(true);
  });

  /** Pausar en vez de borrar: borrarla se lleva los días ya marcados con ella. */
  it('se puede pausar sin perder el historial', () => {
    const onChange = vi.fn();
    render(
      <MetasDeCliente client={{ ...CLIENTE, metas: [META('a', 'Agua')] }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByText('Pausar'));
    const [patch] = onChange.mock.calls[0] as [{ metas: { id: string; activa: boolean }[] }];
    expect(patch.metas[0]).toMatchObject({ id: 'a', activa: false });
  });

  it('avisa si se ponen demasiadas', () => {
    render(
      <MetasDeCliente
        client={{
          ...CLIENTE,
          metas: ['a', 'b', 'c', 'd'].map((x) => META(x, `Meta ${x}`)),
        }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/se vuelve inalcanzable/i)).toBeTruthy();
  });
});
