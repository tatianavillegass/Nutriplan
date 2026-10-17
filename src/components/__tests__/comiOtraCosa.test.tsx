// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ComiOtraCosa } from '../client/ComiOtraCosa';
import { DayProgressBar } from '../client/DayProgressBar';
import type { Bocado } from '../../types/diary';
import type { DayType } from '../../types/plan';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClientView } from '../../pages/ClientView';
import { useAppStore } from '../../store/useAppStore';
import { DEMO_CLIENT, DEMO_PLAN } from '../../data/demoSeed';
import { FOOD_CATALOG } from '../../data/foodCatalog';

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
      onCerrar={() => {}}
      onAnadir={() => {}}
      onQuitar={() => {}}
      onNota={() => {}}
      {...props}
    />,
  );

/**
 * Quien lo abre es el botón «Otro» de la fila de acciones de la comida, al
 * lado de «Libre». Aquí había además un enlace y salían los dos, uno debajo
 * del otro.
 */
describe('Cerrado no ocupa sitio', () => {
  it('no pinta nada hasta que se dice que se comió otra cosa', () => {
    const { container } = pintar();
    expect(container.firstChild).toBeNull();
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

  /*
   * Lo dice la pastilla, no un contador: «2 de 2 comidas hechas» repetía con
   * números lo que los colores ya dicen, y se quitó.
   */
  it('y cuenta como contestada, no como pendiente', () => {
    render(
      <DayProgressBar
        dayType={DIA}
        porciones={{}}
        cumplidas={['desayuno']}
        sustituidas={{ merienda: {} }}
      />,
    );
    expect(screen.getByText('✓ hecha')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
  });
});

/**
 * «OTRO», AL LADO DE «LIBRE»
 * ==========================
 * Empezó siendo un enlace pequeño debajo de la comida, pensando que lo
 * discreto evitaría que se usara de más. No se usaba de más: no se
 * encontraba. Son los dos la misma cosa —la excepción del día— así que son el
 * mismo botón con dos colores, en la misma fila.
 */
describe('El botón que lo abre está en la fila de la comida', () => {
  it('sale junto a «Libre», con su misma forma', () => {
    Element.prototype.scrollIntoView = vi.fn();
    useAppStore.setState({
      clients: [DEMO_CLIENT],
      plans: [DEMO_PLAN],
      foods: FOOD_CATALOG,
      recipes: [],
      registros: [],
      mediciones: [],
      recursos: [],
    });
    render(
      <MemoryRouter initialEntries={[`/clientes/${DEMO_CLIENT.id}/vista`]}>
        <Routes>
          <Route path="/clientes/:id/vista" element={<ClientView />} />
        </Routes>
      </MemoryRouter>,
    );

    const libre = screen.getAllByRole('button', { name: 'Libre' })[0];
    const otro = screen.getAllByRole('button', { name: 'Otra cosa' })[0];
    expect(otro).toBeTruthy();
    // La misma fila: comparten padre, que es lo que los pone al lado.
    expect(otro.parentElement).toBe(libre.parentElement);
    // Y ya no está el enlace de antes, que salía además de éste.
    expect(screen.queryByText('Comí otra cosa')).toBeNull();
  });
});
