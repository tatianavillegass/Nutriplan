import { describe, it, expect } from 'vitest';
import { comidaCubierta } from '../dailyBudget';
import type { DayType, Meal } from '../../types/plan';

const COMIDA: Meal = { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 2 };
const DESAYUNO: Meal = { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 };

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [DESAYUNO, COMIDA],
  grid: {
    desayuno: { almidones: 2, proteicos_magros: 2 },
    comida: { proteicos_magros: 4, almidones: 3, grasas: 2, verduras: 2 },
  },
  notas: {},
};

/**
 * MARCAR LAS PORCIONES YA ES DECIR QUE TE LO HAS COMIDO
 *
 * Pedir después un «marcar hecha» es hacer repetir lo mismo con otro botón, y
 * lo que pasaba es que se quedaba sin pulsar: el día salía a medias con el
 * plato entero registrado.
 */
describe('¿Está la comida completa?', () => {
  it('con todos los macros cubiertos, sí', () => {
    const s = { comida: { proteina: 4, carbohidrato: 3, grasa: 2 } };
    expect(comidaCubierta(DIA, COMIDA, s)).toBe(true);
  });

  it('si falta un macro, no', () => {
    const s = { comida: { proteina: 4, carbohidrato: 3 } };
    expect(comidaCubierta(DIA, COMIDA, s)).toBe(false);
  });

  /**
   * Quedarse corta no la descompleta. En fase 3 lo que manda es el total del
   * día: la media grasa que falta aquí se come en la merienda. Pidiendo la
   * cuenta exacta, la comida se quedaba sin marcar aunque estuviera comida.
   */
  it('quedarse corta de un macro la deja completa igual', () => {
    const s = { comida: { proteina: 4, carbohidrato: 3, grasa: 0.5 } };
    expect(comidaCubierta(DIA, COMIDA, s)).toBe(true);
  });

  it('pero de ese macro tiene que haber algo', () => {
    const s = { comida: { proteina: 4, carbohidrato: 3, grasa: 0 } };
    expect(comidaCubierta(DIA, COMIDA, s)).toBe(false);
  });

  /** Pasarse no descompleta: quien come de más se lo ha comido igual. */
  it('pasarse la deja completa', () => {
    const s = { comida: { proteina: 6, carbohidrato: 3, grasa: 2 } };
    expect(comidaCubierta(DIA, COMIDA, s)).toBe(true);
  });

  it('sin nada marcado, no', () => {
    expect(comidaCubierta(DIA, COMIDA, {})).toBe(false);
  });

  it('cada comida va por su cuenta', () => {
    const s = { comida: { proteina: 4, carbohidrato: 3, grasa: 2 } };
    expect(comidaCubierta(DIA, DESAYUNO, s)).toBe(false);
  });

  it('una comida sin nada pautado no se puede completar', () => {
    const vacia: DayType = { ...DIA, grid: { ...DIA.grid, comida: {} } };
    expect(comidaCubierta(vacia, COMIDA, { comida: { proteina: 4 } })).toBe(false);
  });

  /**
   * El aceite de cocinar no se elige, así que no puede impedir que la comida
   * se dé por completa: si contara, ninguna comida con aceite se cerraría
   * jamás y el botón se quedaría siempre a medias.
   */
  /**
   * Si toda la grasa de la comida es la del aceite, no queda grasa que elegir:
   * exigirla dejaría esa comida sin cerrar para siempre.
   */
  it('una comida cuya única grasa es el aceite se cierra sin marcar grasa', () => {
    const soloAceite: DayType = {
      ...DIA,
      grid: { ...DIA.grid, comida: { proteicos_magros: 4, almidones: 3, grasas: 1 } },
    };
    const s = { comida: { proteina: 4, carbohidrato: 3 } };
    expect(comidaCubierta(soloAceite, COMIDA, s)).toBe(true);
  });

  it('las verduras no hacen falta: son libres', () => {
    // La grilla pauta 2 verduras y no se marca ninguna; la comida cierra igual.
    const s = { comida: { proteina: 4, carbohidrato: 3, grasa: 2 } };
    expect(comidaCubierta(DIA, COMIDA, s)).toBe(true);
  });
});
