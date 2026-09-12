// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { EvolucionDeMedidas } from '../client/EvolucionDeMedidas';
import { ComparaFotos } from '../client/ComparaFotos';
import { ApuntarUnaToma } from '../client/ApuntarUnaToma';
import type { Medida } from '../../utils/misMedidas';

afterEach(cleanup);

const t = (fecha: string, extra: Partial<Medida> = {}): Medida => ({ fecha, ...extra });

describe('El gráfico de evolución', () => {
  const medidas = [
    t('2026-06-01', { peso: 70, cintura: 82 }),
    t('2026-07-01', { peso: 69, cintura: 80 }),
    t('2026-08-01', { peso: 68, cintura: 78 }),
  ];

  it('pinta una línea con un punto por toma', () => {
    const { container } = render(<EvolucionDeMedidas medidas={medidas} />);
    expect(container.querySelector('path')).toBeTruthy();
    expect(container.querySelectorAll('circle').length).toBe(3);
  });

  it('y deja cambiar de medida', () => {
    render(<EvolucionDeMedidas medidas={medidas} />);
    const cintura = screen.getByText('Cintura');
    fireEvent.click(cintura);
    expect(cintura.getAttribute('aria-pressed')).toBe('true');
  });

  /** Un gráfico de un punto es una promesa vacía. */
  it('con una sola toma no promete nada', () => {
    render(<EvolucionDeMedidas medidas={[t('2026-06-01', { peso: 70 })]} />);
    expect(screen.getByText(/Con dos tomas/)).toBeTruthy();
  });

  /**
   * Un peso de 68 a 70 en un eje que arranca en cero es una línea plana, y es
   * justo el cambio que hay que ver. Aquí sólo se comprueba que no revienta
   * cuando no se ha movido nada, que es la división por cero.
   */
  it('y no se rompe si el peso no se ha movido', () => {
    const quietas = [t('2026-06-01', { peso: 70 }), t('2026-07-01', { peso: 70 })];
    const { container } = render(<EvolucionDeMedidas medidas={quietas} />);
    const d = container.querySelector('path')?.getAttribute('d') ?? '';
    expect(d).not.toContain('NaN');
  });
});

describe('El comparador de fotos', () => {
  const conFotos = [
    t('2026-06-01', { fotos: { frente: 'a', perfil: 'b' } }),
    t('2026-07-01', { fotos: { frente: 'c', perfil: 'e' } }),
    t('2026-08-01', { fotos: { frente: 'd' } }),
  ];

  it('empieza por la primera contra la última', () => {
    render(<ComparaFotos medidas={conFotos} />);
    const fotos = screen.getAllByRole('img');
    expect(fotos[0].getAttribute('src')).toBe('a');
    expect(fotos[1].getAttribute('src')).toBe('d');
  });

  /** Un estancamiento se ve entre dos meses concretos, no en el total. */
  it('con tres o más tomas deja elegir las dos fechas', () => {
    render(<ComparaFotos medidas={conFotos} />);
    expect(screen.getByText('Antes')).toBeTruthy();
    expect(screen.getByText('Después')).toBeTruthy();
  });

  it('sólo ofrece los ángulos de los que hay foto', () => {
    render(<ComparaFotos medidas={conFotos} />);
    expect(screen.getByText('De frente')).toBeTruthy();
    expect(screen.getByText('De perfil')).toBeTruthy();
    expect(screen.queryByText('De espalda')).toBeNull();
  });

  /**
   * Si ese día no se hizo la foto de espalda, esconderlo haría creer que la
   * comparación es de otra fecha.
   */
  it('y si a una toma le falta ese ángulo, lo dice en vez de saltárselo', () => {
    render(<ComparaFotos medidas={conFotos} />);
    fireEvent.click(screen.getByText('De perfil'));
    expect(screen.getAllByText(/Sin foto de este ángulo/).length).toBeGreaterThan(0);
  });

  it('sin fotos no ocupa sitio', () => {
    const { container } = render(<ComparaFotos medidas={[t('2026-06-01', { peso: 70 })]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('Apuntar una toma por ella', () => {
  it('guarda los perímetros con los nombres de la antropometría', () => {
    const onGuardar = vi.fn();
    render(<ApuntarUnaToma clientId="c1" onGuardar={onGuardar} />);
    fireEvent.click(screen.getByText('Apuntar una toma'));

    fireEvent.change(screen.getByLabelText(/Peso/i, { selector: 'input' }), {
      target: { value: '70' },
    });
    fireEvent.click(screen.getByText('Guardar la toma'));

    const m = onGuardar.mock.calls[0][0];
    expect(m.clientId).toBe('c1');
    expect(m.peso).toBe(70);
    expect(m.pliegues).toEqual({});
  });

  /**
   * Se apunta cuando llega el correo, que puede ser una semana después de que
   * se midiera: la fecha de hoy convertiría la toma de agosto en una de
   * septiembre.
   */
  it('y la fecha se escribe, no se adivina', () => {
    const onGuardar = vi.fn();
    render(<ApuntarUnaToma clientId="c1" onGuardar={onGuardar} />);
    fireEvent.click(screen.getByText('Apuntar una toma'));

    fireEvent.change(screen.getByLabelText(/Fecha en que se midió/), {
      target: { value: '2026-06-01' },
    });
    fireEvent.click(screen.getByText('Guardar la toma'));
    expect(onGuardar.mock.calls[0][0].fecha).toBe('2026-06-01');
  });
});
