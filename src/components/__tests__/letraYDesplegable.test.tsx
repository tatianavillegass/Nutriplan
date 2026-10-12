// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ScaledRecipeView } from '../phase1/ScaledRecipeView';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { Receta } from '../../types/recipe';

afterEach(cleanup);

/**
 * «SE LE CORTA EN LA MITAD» Y «LA LETRA ES MUY PEQUEÑA» SON EL MISMO FALLO
 *
 * La app se escribió con la letra de una pantalla de ordenador, así que en un
 * móvil la clienta ampliaba con los dedos para leer. Y con la pantalla
 * ampliada, un desplegable agarrado a la ventana —centrado, del ancho de la
 * pantalla— mide más que lo que se ve: aparece cortado por un lado.
 *
 * Así que no eran dos cosas que arreglar sino una, y por los dos lados: la
 * lista se abre debajo del ingrediente, donde ella acaba de tocar, y la letra
 * sube lo suficiente para que no haga falta ampliar.
 */

const pollo = FOOD_CATALOG.find((f) => f.id === 'a-pechuga-de-pollo-cruda')!;

const receta: Receta = {
  id: 'r1',
  nombre: 'Plato de pollo',
  categorias: ['cena'],
  tags: [],
  base: { proteicos_magros: 4 },
  ingredientes: [
    {
      id: 'i1',
      nombre: 'Pollo',
      foodId: pollo.id,
      cantidad_base: 120,
      unidad: 'g',
      grupo: 'proteicos_magros',
      escalable: true,
      opcional: false,
    },
  ],
  preparacion: '',
  notas: '',
  createdAt: '',
  updatedAt: '',
} as unknown as Receta;

function abrirElCambio() {
  render(
    <ScaledRecipeView
      receta={receta}
      requeridos={{ proteicos_magros: 4 }}
      foods={FOOD_CATALOG}
      equivalentes={{}}
      onEquivalente={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByTitle(/Cambiar pollo/i));
  return screen.getByPlaceholderText(/Buscar en/i);
}

describe('La lista de equivalentes se abre en la página, no sobre la ventana', () => {
  it('al pulsar «Cambiar» sale la lista con sus alternativas', () => {
    const buscador = abrirElCambio();
    expect(buscador).toBeTruthy();
    // Pavo, atún, merluza… lo que comparte subgrupo con el pollo.
    expect(screen.getAllByRole('button').length).toBeGreaterThan(3);
  });

  /*
   * Esto es el arreglo: nada de la lista puede estar `fixed`. Un elemento
   * `fixed` se coloca respecto a la ventana entera y no respecto a lo que se
   * ve, así que con zoom se sale por un lado — que es exactamente lo que le
   * pasaba. Si alguien vuelve a centrarla sobre la pantalla, este test salta.
   */
  it('y ni ella ni ninguna capa por encima están agarradas a la ventana', () => {
    const buscador = abrirElCambio();
    for (let n: HTMLElement | null = buscador; n; n = n.parentElement) {
      expect(n.className).not.toMatch(/\bfixed\b/);
    }
  });

  it('se cierra por su propio botón, sin capa oscura que tocar', () => {
    abrirElCambio();
    fireEvent.click(screen.getByText('Cerrar'));
    expect(screen.queryByPlaceholderText(/Buscar en/i)).toBeNull();
  });
});

/*
 * La otra mitad del arreglo —subir la letra— vive en `index.css`, en el bloque
 * `.vista-cliente` dentro de `@media screen`. No se prueba aquí porque en los
 * tests el CSS no se carga: lo que pintan es el HTML sin hoja de estilos, así
 * que un test de tamaños no estaría mirando nada. Se comprueba a ojo, y lo que
 * lo guarda es el comentario de ese bloque.
 */
