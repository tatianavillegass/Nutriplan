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

  it('a medio macro tampoco', () => {
    // De las 2 grasas de la comida, 1 se va en el aceite: hay que elegir 1.
    const s = { comida: { proteina: 4, carbohidrato: 3, grasa: 0.5 } };
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
  it('la grasa reservada para cocinar no la bloquea', () => {
    // La comida pauta 2 grasas y 1 se va en el aceite, que no se elige. Con
    // 1 elegida la comida está entera: si el aceite contara, ninguna comida
    // cocinada se cerraría jamás.
    const s = { comida: { proteina: 4, carbohidrato: 3, grasa: 1 } };
    expect(comidaCubierta(DIA, COMIDA, s)).toBe(true);

    // Y si se le dice que no hay aceite, entonces sí faltan las dos.
    const sinAceite = { ...DIA, aceiteCoccion: { comida: 0 } } as unknown as DayType;
    expect(comidaCubierta(sinAceite, COMIDA, s)).toBe(false);
  });

  it('las verduras no hacen falta: son libres', () => {
    // La grilla pauta 2 verduras y no se marca ninguna; la comida cierra igual.
    const s = { comida: { proteina: 4, carbohidrato: 3, grasa: 2 } };
    expect(comidaCubierta(DIA, COMIDA, s)).toBe(true);
  });
});
