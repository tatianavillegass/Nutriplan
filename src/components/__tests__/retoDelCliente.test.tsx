// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Preparacion } from '../client/Preparacion';
import { RetoDelDia } from '../client/RetoDelDia';
import { EntrenosDelReto } from '../retos/EntrenosDelReto';
import type { Reto } from '../../types/reto';

afterEach(cleanup);

const RETO: Reto = {
  id: 'rt1',
  nombre: 'UPGRADE 1.0',
  fechaInicio: '2026-09-01',
  dias: 30,
  participantes: ['c1'],
  recursos: [],
  recetas: [{ recetaId: 'rc1', slot: 'desayuno', desdeDia: 1 }],
  entrenos: [
    {
      id: 'e1',
      nombre: 'Tren inferior',
      descripcion: '45 min · necesitas una banda',
      videoUrl: 'https://ejemplo.com/video',
      desdeDia: 1,
      ejercicios: [{ id: 'ej1', nombre: 'Sentadilla', series: 4, repeticiones: '10-12' }],
    },
    { id: 'e2', nombre: 'Tren superior', desdeDia: 10, ejercicios: [] },
  ],
  createdAt: '2026-08-01',
};

/**
 * Antes de esto la participante veía una línea con el nombre del reto y ya: las
 * recetas y los entrenos no llegaban a ninguna parte, así que el reto era una
 * etiqueta de color en la pantalla de otra cosa.
 */
describe('El reto, dentro de su app', () => {
  const pintar = (hoy: string, onEntreno = vi.fn(), hechos: string[] = []) =>
    render(
      <RetoDelDia reto={RETO} hoy={hoy} hechos={hechos} onEntreno={onEntreno} />,
    );

  it('enseña los entrenos abiertos, con sus series', () => {
    pintar('2026-09-03');
    fireEvent.click(screen.getByText('Tren inferior'));
    expect(screen.getByText('Sentadilla')).toBeTruthy();
    expect(screen.getByText(/4 series × 10-12/)).toBeTruthy();
    expect(screen.getByText('Ver el vídeo')).toBeTruthy();
  });

  it('lo que todavía no se ha abierto no se ve', () => {
    pintar('2026-09-03');
    expect(screen.queryByText('Tren superior')).toBeNull();
  });

  /**
   * Las recetas ya salen abajo, en su comida: repetirlas aquí ocupaba media
   * pantalla y hacía dudar de si eran las mismas o unas aparte.
   */
  it('las recetas no se repiten aquí', () => {
    pintar('2026-09-03');
    expect(screen.queryByText(/Tortitas/)).toBeNull();
  });

  /** Marcarlo es lo que deja ver a la nutricionista si de verdad se entrena. */
  it('el entreno se puede marcar hecho', () => {
    const onEntreno = vi.fn();
    pintar('2026-09-03', onEntreno);
    fireEvent.click(screen.getByText('Tren inferior'));
    fireEvent.click(screen.getByText('Marcar hecho'));
    expect(onEntreno).toHaveBeenCalledWith('e1');
  });

  it('y una vez hecho se ve sin abrirlo', () => {
    pintar('2026-09-03', vi.fn(), ['e1']);
    expect(screen.getByText('hecho ✓')).toBeTruthy();
  });
});

/**
 * Entre apuntarse y empezar pasan días, y ese hueco es donde se pierde la
 * gente. Tres cosas que se pueden terminar hoy.
 */
describe('La preparación antes de empezar', () => {
  const pintar = (onGuardar = vi.fn(), datos = { hechos: [] as never[] }) =>
    render(
      <Preparacion nombreReto="UPGRADE 1.0" faltan={5} datos={datos} onGuardar={onGuardar} />,
    );

  it('enseña cuánto lleva y cuánto falta para empezar', () => {
    pintar();
    expect(screen.getByText('0/3')).toBeTruthy();
    expect(screen.getByText(/Faltan 5 días/)).toBeTruthy();
  });

  it('las medidas se apuntan y marcan el paso', () => {
    const onGuardar = vi.fn();
    pintar(onGuardar);
    fireEvent.click(screen.getByText(/Mídete la cintura/));
    fireEvent.change(screen.getByLabelText(/Cintura/i), { target: { value: '78' } });
    fireEvent.click(screen.getByText('Guardar'));

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ cintura: 78, hechos: ['medidas'] }),
    );
  });

  /** La foto es suya: puede subirla o quedársela y marcar el paso. */
  it('la foto se puede dar por hecha sin subirla', () => {
    const onGuardar = vi.fn();
    pintar(onGuardar);
    fireEvent.click(screen.getByText(/Hazte la foto/));
    fireEvent.click(screen.getByText('Ya me la he hecho'));

    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ hechos: ['foto'] }));
    expect(onGuardar.mock.calls[0][0].foto).toBeUndefined();
  });

  it('con todo hecho lo dice y deja de dar tareas', () => {
    render(
      <Preparacion
        nombreReto="UPGRADE 1.0"
        faltan={1}
        datos={{ hechos: ['medidas', 'foto', 'guia'] }}
        onGuardar={vi.fn()}
      />,
    );
    expect(screen.getByText('3/3')).toBeTruthy();
    expect(screen.getByText(/Ya está todo listo/i)).toBeTruthy();
  });
});

describe('Montar los entrenos', () => {
  it('se añade uno y se le ponen ejercicios', () => {
    const onCambiar = vi.fn();
    const { rerender } = render(<EntrenosDelReto entrenos={[]} onCambiar={onCambiar} />);
    fireEvent.click(screen.getByText('+ Añadir entreno'));

    const creado = onCambiar.mock.calls[0][0];
    expect(creado).toHaveLength(1);
    expect(creado[0].desdeDia).toBe(1);

    // Se abre solo al crearlo: lo siguiente que se hace es ponerle nombre.
    rerender(<EntrenosDelReto entrenos={creado} onCambiar={onCambiar} />);
    expect(screen.getByPlaceholderText('Fuerza tren inferior')).toBeTruthy();

    fireEvent.click(screen.getByText('+ Añadir ejercicio'));
    expect(onCambiar.mock.calls[1][0][0].ejercicios).toHaveLength(1);
  });

  it('y se puede quitar', () => {
    const onCambiar = vi.fn();
    render(
      <EntrenosDelReto
        entrenos={[{ id: 'e1', nombre: 'Tren inferior', desdeDia: 1, ejercicios: [] }]}
        onCambiar={onCambiar}
      />,
    );
    fireEvent.click(screen.getByText('Quitar'));
    expect(onCambiar).toHaveBeenCalledWith([]);
  });
});
