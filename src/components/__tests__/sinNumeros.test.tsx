// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SinNumerosProvider, ConNumeros, useSinNumeros } from '../client/SinNumeros';
import { MacroBar } from '../common/RecipeMeta';

afterEach(cleanup);

/**
 * SIN NÚMEROS DE ENERGÍA
 *
 * A quien arrastra un trastorno de conducta alimentaria, cada cifra es una
 * cuenta más que llevar. Con esto encendido ve su plan entero y ni una
 * caloría ni un macro — y la pantalla de la nutricionista no se entera.
 */

const MACROS = { proteina: 26, hc: 43, grasa: 17 };

function Chivato() {
  return <span>{useSinNumeros() ? 'escondido' : 'a la vista'}</span>;
}

describe('Apagado, que es como está por defecto', () => {
  it('sin nadie que lo encienda, los números salen', () => {
    render(<MacroBar macros={MACROS} />);
    expect(screen.getByText('kcal')).toBeTruthy();
  });

  it('la pantalla de la nutricionista no necesita envolver nada', () => {
    render(<Chivato />);
    expect(screen.getByText('a la vista')).toBeTruthy();
  });

  it('y con el interruptor a falso tampoco cambia nada', () => {
    render(
      <SinNumerosProvider activo={false}>
        <MacroBar macros={MACROS} />
      </SinNumerosProvider>,
    );
    expect(screen.getByText('kcal')).toBeTruthy();
  });
});

describe('Encendido', () => {
  const conElModo = (ui: React.ReactNode) =>
    render(<SinNumerosProvider activo>{ui}</SinNumerosProvider>);

  it('la barra de macros no se enseña a medias: desaparece entera', () => {
    conElModo(<MacroBar macros={MACROS} />);
    // Ni las kcal ni las siglas: «P —» sigue diciendo que hay algo que mirar.
    expect(screen.queryByText('kcal')).toBeNull();
    expect(screen.queryByText('P')).toBeNull();
    expect(document.body.textContent).not.toMatch(/26|43|17/);
  });

  it('lo envuelto en ConNumeros no se pinta', () => {
    conElModo(
      <>
        <ConNumeros>
          <span>420 kcal</span>
        </ConNumeros>
        <span>Porridge de avena</span>
      </>,
    );
    expect(screen.queryByText('420 kcal')).toBeNull();
    // Lo que no son números sigue ahí: ve su plato, no su energía.
    expect(screen.getByText('Porridge de avena')).toBeTruthy();
  });

  it('se sabe desde cualquier profundidad', () => {
    conElModo(
      <div>
        <div>
          <Chivato />
        </div>
      </div>,
    );
    expect(screen.getByText('escondido')).toBeTruthy();
  });
});
