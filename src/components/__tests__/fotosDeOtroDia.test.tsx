// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MisMedidas } from '../client/MisMedidas';
import type { MedidasDelDia } from '../../types/diary';
import type { Preparacion } from '../../utils/preparacion';

afterEach(cleanup);

/**
 * LAS FOTOS DE UN DÍA SON DE ESE DÍA
 *
 * «Juan Guillermo y Maritza subieron las fotos del inicio y después las de
 * seguimiento, y se duplicaron las de seguimiento.»
 *
 * No estaba en la subida: estaba en el formulario. Los campos se rellenaban
 * **una sola vez**, al montarse el componente, y no se volvían a sincronizar
 * (`useState` sólo mira su valor inicial). Así que al cambiar de día seguían
 * cargadas las fotos del día anterior y, al guardar cualquier cosa, se
 * escribían otra vez en la fecha nueva: las mismas tres fotos en dos tomas, y
 * en el comparador dos veces.
 *
 * Arrastrar un peso ya era raro; arrastrar una foto inventa una toma que no
 * existió.
 */

const PREPARACION = { hechos: [] } as unknown as Preparacion;

const DEL_INICIO: MedidasDelDia = {
  peso: 80,
  fotos: { frente: 'data:image/png;base64,INICIO' },
};

const pintar = (fecha: string, deHoy?: MedidasDelDia) => {
  const onGuardar = vi.fn();
  const { rerender } = render(
    <MisMedidas
      registros={[]}
      mediciones={[]}
      preparacion={PREPARACION}
      deHoy={deHoy}
      fecha={fecha}
      clientId="c1"
      onGuardar={onGuardar}
    />,
  );
  const aOtroDia = (f: string, d?: MedidasDelDia) =>
    rerender(
      <MisMedidas
        registros={[]}
        mediciones={[]}
        preparacion={PREPARACION}
        deHoy={d}
        fecha={f}
        clientId="c1"
        onGuardar={onGuardar}
      />,
    );
  return { onGuardar, aOtroDia };
};

/** El panel va plegado: se abre con el botón de la cabecera. */
const abrir = () => fireEvent.click(screen.getByRole('button', { expanded: false }));

const guardar = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

describe('Al cambiar de día', () => {
  it('lo del día anterior no se queda cargado', () => {
    const { onGuardar, aOtroDia } = pintar('2026-01-05', DEL_INICIO);
    abrir();
    /* Se ve lo del inicio, que para eso se abre. */
    expect(screen.getByDisplayValue('80')).toBeTruthy();

    /* Y ahora otro día, sin nada apuntado todavía. */
    aOtroDia('2026-02-10', undefined);
    expect(screen.queryByDisplayValue('80')).toBeNull();

    guardar();
    const medidas = onGuardar.mock.calls[0][0] as MedidasDelDia;
    /* Lo que se pedía: ni las fotos ni el peso del día del inicio. */
    expect(medidas.fotos).toBeUndefined();
    expect(medidas.peso).toBeUndefined();
  });

  /* Y al abrir un día que sí tiene lo suyo, sale lo suyo. */
  it('y lo del día que se abre sí se carga', () => {
    const { onGuardar, aOtroDia } = pintar('2026-02-10', undefined);
    abrir();
    aOtroDia('2026-01-05', DEL_INICIO);

    expect(screen.getByDisplayValue('80')).toBeTruthy();
    guardar();
    const medidas = onGuardar.mock.calls[0][0] as MedidasDelDia;
    expect(medidas.peso).toBe(80);
    expect(medidas.fotos?.frente).toContain('INICIO');
  });

  /* Corregir lo de hoy el mismo día sigue funcionando: no se vacía por nada. */
  it('y en el mismo día no se toca lo que está escribiendo', () => {
    const { aOtroDia } = pintar('2026-01-05', DEL_INICIO);
    abrir();
    const peso = screen.getByDisplayValue('80');
    fireEvent.change(peso, { target: { value: '79' } });
    /* Un re-render del padre —llega algo de la nube— no puede borrarlo. */
    aOtroDia('2026-01-05', DEL_INICIO);
    expect(screen.getByDisplayValue('79')).toBeTruthy();
  });
});
