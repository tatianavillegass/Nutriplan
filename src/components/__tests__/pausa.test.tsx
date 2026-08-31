// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { BotonPausa } from '../client/BotonPausa';
import { MisPausas } from '../client/MisPausas';
import { PatronesDePausa } from '../client/PatronesDePausa';
import type { Pausa, RegistroDia } from '../../types/diary';

afterEach(cleanup);

const pausa = (extra: Partial<Pausa> = {}): Pausa => ({
  id: `p-${Math.random()}`,
  hora: new Date(2026, 7, 31, 22, 0).toISOString(),
  momento: 'antes',
  emocion: 'Aburrimiento',
  contexto: 'Sola en casa',
  queHizo: 'otra-cosa',
  actividad: 'Salir a andar',
  despues: 'Más tranquila',
  ...extra,
});

const dias = (pausas: Pausa[]): RegistroDia[] =>
  [{ id: 'r1', clientId: 'c', fecha: '2026-08-31', pausas }] as unknown as RegistroDia[];

/**
 * EL NOMBRE DEL BOTÓN NO ES UN DETALLE
 *
 * «He tenido un episodio» es una casilla de confesión, y a las once de la noche
 * —que es cuando hace falta— no lo pulsa nadie.
 */
describe('El botón', () => {
  it('se llama Pausa y no habla de fallos', () => {
    render(<BotonPausa onGuardar={vi.fn()} />);
    expect(screen.getByText('Pausa')).toBeTruthy();
    const texto = document.body.textContent ?? '';
    for (const palabra of ['episodio', 'atracón', 'fallo', 'recaída']) {
      expect(texto.toLowerCase()).not.toContain(palabra);
    }
  });

  /**
   * La primera pantalla no pregunta por ella, pregunta por el momento. Si de
   * entrada la hace sentir que llega tarde, no hay segunda.
   */
  it('empieza preguntando dónde está, y las dos respuestas valen', () => {
    render(<BotonPausa onGuardar={vi.fn()} />);
    fireEvent.click(screen.getByText('Pausa'));
    expect(screen.getByText('Todavía no he comido')).toBeTruthy();
    expect(screen.getByText('Ya he comido')).toBeTruthy();
  });

  it('si ya ha comido, va directo a anotar sin hacerle el árbol', () => {
    render(<BotonPausa onGuardar={vi.fn()} />);
    fireEvent.click(screen.getByText('Pausa'));
    fireEvent.click(screen.getByText('Ya he comido'));
    // Se salta las preguntas del árbol y pregunta qué sentía.
    expect(screen.getByText('¿Qué estás sintiendo?')).toBeTruthy();
    expect(screen.queryByText('¿Sabes qué estás sintiendo?')).toBeNull();
  });

  it('y si no, le hace el árbol de decisión', () => {
    render(<BotonPausa onGuardar={vi.fn()} />);
    fireEvent.click(screen.getByText('Pausa'));
    fireEvent.click(screen.getByText('Todavía no he comido'));
    expect(screen.getByText('¿Sabes qué estás sintiendo?')).toBeTruthy();
    fireEvent.click(screen.getByText('No'));
    expect(document.body.textContent).toContain('Conecta con tu emoción');
  });

  it('guarda lo que escribió, con su hora', () => {
    const onGuardar = vi.fn();
    render(<BotonPausa onGuardar={onGuardar} />);
    fireEvent.click(screen.getByText('Pausa'));
    fireEvent.click(screen.getByText('Ya he comido'));
    // «Aburrimiento» sale dos veces: el título de la familia y la propia
    // emoción. La que se pulsa es el botón.
    fireEvent.click(
      screen.getAllByText('Aburrimiento').find((e) => e.tagName === 'BUTTON')!,
    );
    fireEvent.click(screen.getByText('Seguir'));
    fireEvent.click(screen.getByText('Guardar'));

    const guardada = onGuardar.mock.calls[0]?.[0] as Pausa;
    expect(guardada.emocion).toBe('Aburrimiento');
    expect(guardada.momento).toBe('despues');
    expect(guardada.hora).toBeTruthy();
  });

  /** No saber qué siente también es una respuesta: no se le bloquea el paso. */
  it('se puede seguir sin saber qué se siente', () => {
    render(<BotonPausa onGuardar={vi.fn()} />);
    fireEvent.click(screen.getByText('Pausa'));
    fireEvent.click(screen.getByText('Ya he comido'));
    expect(screen.getByText('No sabría decir')).toBeTruthy();
  });
});

/**
 * AQUÍ NO SE CUENTA NADA
 *
 * Un contador de episodios es un marcador de fracasos. Es lo mismo que ya se
 * rechazó con el porcentaje de adherencia y con ordenar clientas por peso.
 */
describe('Lo que ve la clienta', () => {
  const tres = dias([pausa(), pausa(), pausa({ senales: ['sin-control'] })]);

  it('ve lo que escribió, para poder releerlo', () => {
    render(<MisPausas registros={tres} />);
    fireEvent.click(screen.getByText('Tus pausas'));
    expect(screen.getAllByText('Aburrimiento').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sola en casa').length).toBeGreaterThan(0);
  });

  it('pero en ningún sitio cuántas van', () => {
    render(<MisPausas registros={tres} />);
    fireEvent.click(screen.getByText('Tus pausas'));
    const texto = document.body.textContent ?? '';
    expect(texto).not.toMatch(/\b3\b/);
    expect(texto.toLowerCase()).not.toContain('racha');
    expect(texto.toLowerCase()).not.toContain('van ');
  });

  /**
   * Las señales se preguntaron para la nutricionista. Devolvérselas marcadas
   * sería convertir una confidencia en un diagnóstico.
   */
  it('ni las señales que marcó', () => {
    render(<MisPausas registros={tres} />);
    fireEvent.click(screen.getByText('Tus pausas'));
    const texto = document.body.textContent ?? '';
    expect(texto).not.toContain('no podía parar');
    expect(texto.toLowerCase()).not.toContain('señal');
  });

  it('y sin ninguna pausa no ocupa sitio', () => {
    const { container } = render(<MisPausas registros={dias([])} />);
    expect(container.textContent).toBe('');
  });
});

/**
 * En la pantalla de la nutricionista sí hay números: saber si van a más o a
 * menos es su trabajo.
 */
describe('Lo que ve la nutricionista', () => {
  it('los patrones, y lo que le funcionó', () => {
    render(<PatronesDePausa registros={dias([pausa(), pausa()])} />);
    expect(document.body.textContent).toContain('2 pausas registradas');
    expect(screen.getByText('Qué le funcionó')).toBeTruthy();
    expect(screen.getAllByText('Salir a andar').length).toBeGreaterThan(0);
  });

  it('las señales, con lo que significan y sin diagnosticar', () => {
    render(<PatronesDePausa registros={dias([pausa({ senales: ['sin-control'] })])} />);
    expect(screen.getByText('Para hablarlo con ella')).toBeTruthy();
    expect(document.body.textContent).toContain('atracón');
  });

  it('y si no marcó ninguna, no se inventa una alarma', () => {
    render(<PatronesDePausa registros={dias([pausa()])} />);
    expect(screen.queryByText('Para hablarlo con ella')).toBeNull();
  });
});
