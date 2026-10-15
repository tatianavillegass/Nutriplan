// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ComiOtraCosa } from '../client/ComiOtraCosa';
import { DayProgressBar } from '../client/DayProgressBar';
import type { Bocado } from '../../types/diary';
import type { DayType } from '../../types/plan';

afterEach(cleanup);

const BOCADO: Bocado = {
  id: 'b1',
  nombre: 'Tostada integral',
  cantidad: 60,
  unidad: 'g',
  macros: { proteina: 5, hc: 30, grasa: 2 },
  kcal: 158,
  momento: 'merienda',
};

const pintar = (props: Partial<Parameters<typeof ComiOtraCosa>[0]> = {}) =>
  render(
    <ComiOtraCosa
      mealId="merienda"
      mealNombre="Merienda"
      foods={[]}
      bocados={[]}
      activa={false}
      onAbrir={() => {}}
      onCerrar={() => {}}
      onAnadir={() => {}}
      onQuitar={() => {}}
      onNota={() => {}}
      {...props}
    />,
  );

describe('Cerrado, es un enlace discreto', () => {
  it('se ofrece sin ocupar sitio', () => {
    pintar();
    expect(screen.getByText('Comí otra cosa')).toBeTruthy();
    // Es para la excepción: nada de formulario abierto de entrada.
    expect(screen.queryByText(/Apuntar lo que comiste/)).toBeNull();
  });

  it('al pulsarlo se abre', () => {
    const onAbrir = vi.fn();
    pintar({ onAbrir });
    fireEvent.click(screen.getByText('Comí otra cosa'));
    expect(onAbrir).toHaveBeenCalled();
  });
});

describe('Abierto y sin nada apuntado, es «no comí nada»', () => {
  it('se dice que así queda contestada', () => {
    pintar({ activa: true });
    expect(screen.getByText(/no comiste nada/i)).toBeTruthy();
    expect(screen.getByText(/no suma nada al día/i)).toBeTruthy();
  });

  it('y se puede deshacer, que equivocarse es normal', () => {
    const onCerrar = vi.fn();
    pintar({ activa: true, onCerrar });
    fireEvent.click(screen.getByText('Deshacer'));
    expect(onCerrar).toHaveBeenCalled();
  });
});

describe('Con lo que comió apuntado', () => {
  it('sale con su nombre y sus gramos', () => {
    pintar({ activa: true, bocados: [BOCADO] });
    expect(screen.getByText(/Tostada integral/)).toBeTruthy();
    expect(screen.getByText(/60 g/)).toBeTruthy();
  });

  it('se puede quitar una línea', () => {
    const onQuitar = vi.fn();
    pintar({ activa: true, bocados: [BOCADO], onQuitar });
    fireEvent.click(screen.getByLabelText('Quitar Tostada integral'));
    expect(onQuitar).toHaveBeenCalledWith('b1');
  });

  it('ya no se ofrece el «no comiste nada»', () => {
    pintar({ activa: true, bocados: [BOCADO] });
    expect(screen.queryByText(/no comiste nada/i)).toBeNull();
  });

  it('la nota se guarda al salir del campo', () => {
    const onNota = vi.fn();
    pintar({ activa: true, bocados: [BOCADO], onNota });
    const campo = screen.getByPlaceholderText(/cuéntame qué fue/i);
    fireEvent.change(campo, { target: { value: 'Me quedé sin tiempo' } });
    fireEvent.blur(campo);
    expect(onNota).toHaveBeenCalledWith('Me quedé sin tiempo');
  });
});

/**
 * La barra del día tiene que distinguir «comí otra cosa» de «sin marcar»: si
 * no, una comida contestada se queda pareciendo pendiente para siempre.
 */
describe('La barra del día lo enseña', () => {
  const DIA: DayType = {
    id: 'dt',
    nombre: 'Día base',
    proteinaGkg: 2,
    hcGkg: 3,
    meals: [
      { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
      { id: 'merienda', nombre: 'Merienda', slot: 'merienda', orden: 2 },
    ],
    grid: { desayuno: { almidones: 2 }, merienda: { fruta: 1 } },
    notas: {},
  };

  it('la comida sustituida no se queda pendiente', () => {
    render(
      <DayProgressBar
        dayType={DIA}
        porciones={{}}
        cumplidas={[]}
        sustituidas={{ merienda: {} }}
      />,
    );
    expect(screen.getByText('otra cosa')).toBeTruthy();
  });

  it('y cuenta como contestada en el resumen', () => {
    render(
      <DayProgressBar
        dayType={DIA}
        porciones={{}}
        cumplidas={['desayuno']}
        sustituidas={{ merienda: {} }}
      />,
    );
    expect(screen.getByText(/2 de 2 comidas hechas/)).toBeTruthy();
  });
});
