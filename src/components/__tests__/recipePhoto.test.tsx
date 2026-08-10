// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PhotoUpload } from '../common/PhotoUpload';
import { RecipeMeta, MacroBar } from '../common/RecipeMeta';
import { ScaledRecipeView } from '../phase1/ScaledRecipeView';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import { SEED_RECIPES } from '../../data/seedRecipes';
import type { Receta } from '../../types/recipe';

afterEach(cleanup);

const FOTO = 'data:image/jpeg;base64,' + 'A'.repeat(4000);

describe('Subida de la foto', () => {
  it('sin foto invita a arrastrarla', () => {
    render(<PhotoUpload onChange={() => {}} />);
    expect(screen.getByText(/Arrastra la foto/)).toBeTruthy();
  });

  it('con foto la enseña con su peso y los botones de cambiar y quitar', () => {
    render(<PhotoUpload value={FOTO} onChange={() => {}} />);
    const img = screen.getByAltText('Foto de la receta') as HTMLImageElement;
    expect(img.src).toBe(FOTO);
    expect(screen.getByText('3 KB')).toBeTruthy();
    expect(screen.getByText('Cambiar')).toBeTruthy();
  });

  it('"Quitar" borra la foto de la receta', () => {
    const onChange = vi.fn();
    render(<PhotoUpload value={FOTO} onChange={onChange} />);
    fireEvent.click(screen.getByText('Quitar'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('avisa si el archivo soltado no es una imagen', async () => {
    render(<PhotoUpload onChange={() => {}} />);
    const zona = screen.getByText(/Arrastra la foto/).closest('button')!;
    const file = new File(['x'], 'plan.pdf', { type: 'application/pdf' });
    fireEvent.drop(zona, { dataTransfer: { files: [file] } });
    expect(await screen.findByText(/no es una imagen/i)).toBeTruthy();
  });
});

describe('Etiquetas de la ficha', () => {
  const base: Receta = {
    ...SEED_RECIPES[0],
    tiempo: '<5 min',
    dificultad: 'Muy fácil',
    tupper: false,
  };

  it('muestra tiempo, dificultad y si va a tupper', () => {
    render(<RecipeMeta receta={base} />);
    expect(screen.getByText('<5 min')).toBeTruthy();
    expect(screen.getByText('Muy fácil')).toBeTruthy();
    expect(screen.getByText('No apto para tupper')).toBeTruthy();
  });

  it('tupper true dice "Apto para tupper"', () => {
    render(<RecipeMeta receta={{ ...base, tupper: true }} />);
    expect(screen.getByText('Apto para tupper')).toBeTruthy();
  });

  it('una receta sin esos datos no pinta nada', () => {
    const { container } = render(
      <RecipeMeta receta={{ ...base, tiempo: undefined, dificultad: undefined, tupper: undefined }} />,
    );
    expect(container.textContent).toBe('');
  });
});

describe('Barra de kcal y macros', () => {
  it('las kcal salen de los macros y el rango es ±25 %', () => {
    // 39 HC + 24 P = 252 kcal, 13 G = 117 → 369
    render(<MacroBar macros={{ hc: 39, proteina: 24, grasa: 13 }} />);
    expect(screen.getByText('369')).toBeTruthy();
    expect(screen.getByText(/min 277–461 max/)).toBeTruthy();
    expect(screen.getByText('39')).toBeTruthy();
    expect(screen.getByText('24')).toBeTruthy();
    expect(screen.getByText('13')).toBeTruthy();
  });

  it('en modo compacto no enseña el rango', () => {
    render(<MacroBar macros={{ hc: 39, proteina: 24, grasa: 13 }} compacto />);
    expect(screen.queryByText(/min/)).toBeNull();
  });
});

describe('Ficha de receta del cliente', () => {
  const wok: Receta = {
    ...SEED_RECIPES.find((r) => r.id === 'rc_wok_pollo')!,
    foto_url: FOTO,
    preparacion: '1. Cocer el arroz.\n2. Saltear el pollo.\n3. Mezclar.',
  };

  it('enseña la foto, el título y las etiquetas', () => {
    render(
      <ScaledRecipeView
        receta={wok}
        requeridos={{ proteicos_magros: 5, almidones: 3, grasas: 2 }}
        foods={FOOD_CATALOG}
      />,
    );
    expect((screen.getByAltText(wok.nombre) as HTMLImageElement).src).toBe(FOTO);
    expect(screen.getByText(wok.nombre)).toBeTruthy();
    expect(screen.getByText('Fácil')).toBeTruthy();
  });

  it('numera los pasos de la elaboración', () => {
    render(
      <ScaledRecipeView
        receta={wok}
        requeridos={{ proteicos_magros: 5, almidones: 3, grasas: 2 }}
        foods={FOOD_CATALOG}
      />,
    );
    expect(screen.getByText('Elaboración')).toBeTruthy();
    expect(screen.getByText('Cocer el arroz.')).toBeTruthy();
    expect(screen.getByText('Saltear el pollo.')).toBeTruthy();
    // El "1." del texto se convierte en el número del paso, no se repite.
    expect(screen.queryByText('1. Cocer el arroz.')).toBeNull();
  });

  it('una receta sin foto sigue mostrándose entera', () => {
    render(
      <ScaledRecipeView
        receta={{ ...wok, foto_url: undefined }}
        requeridos={{ proteicos_magros: 5, almidones: 3, grasas: 2 }}
        foods={FOOD_CATALOG}
      />,
    );
    expect(screen.queryByAltText(wok.nombre)).toBeNull();
    expect(screen.getByText('150 g')).toBeTruthy();
  });
});
