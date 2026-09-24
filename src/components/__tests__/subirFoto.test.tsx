// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MisMedidas } from '../client/MisMedidas';

afterEach(cleanup);

/**
 * «NO ME DEJA SUBIR LAS FOTOS»
 *
 * No era que no dejara: era que cuando fallaba no lo decía. El «Preparando…»
 * se apagaba y ahí acababa todo, así que desde el móvil parecía que el botón
 * no hacía nada. Un HEIC de iPhone o un archivo enorme se tragaban igual.
 */

const pintar = () =>
  render(
    <MisMedidas
      registros={[]}
      mediciones={[]}
      preparacion={{ hechos: [] }}
      onGuardar={vi.fn()}
    />,
  );

/** jsdom no dibuja imágenes: `<img>` nunca carga y `prepararFoto` se queja. */
const subirUna = (file: File) => {
  /* Se abre el panel y dentro está el desplegable de las fotos. */
  fireEvent.click(screen.getByRole('button', { expanded: false }));
  for (const d of document.querySelectorAll('details')) d.setAttribute('open', '');
  const inputs = document.querySelectorAll('input[type="file"]');
  expect(inputs.length).toBeGreaterThan(0);
  fireEvent.change(inputs[0], { target: { files: [file] } });
};

describe('Cuando la foto no entra, se dice por qué', () => {
  it('un archivo enorme se rechaza con su peso escrito, no en silencio', async () => {
    pintar();
    const enorme = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    Object.defineProperty(enorme, 'size', { value: 40 * 1024 * 1024 });
    subirUna(enorme);

    await waitFor(() => {
      expect(screen.getByText(/40\.0 MB/)).toBeTruthy();
    });
  });
});
