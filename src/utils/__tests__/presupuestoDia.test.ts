import { describe, it, expect } from 'vitest';
import { presupuestoDelDia, reservaAceiteDelDia } from '../dailyBudget';
import type { DayType } from '../../types/plan';

/**
 * EL PRESUPUESTO DEL DÍA (FASE 3)
 *
 * Lo que manda es el total del día: el reparto por comidas está pensado, pero
 * si la clienta se come la fruta de la merienda en el desayuno no ha roto
 * nada. Para poder repartirlo hay que verlo entero y verlo en lo que ella
 * escoge de verdad, no en «carbohidrato».
 */

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 2 },
    { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 3 },
  ],
  grid: {
    desayuno: { lacteos_proteicos: 2, almidones: 2, fruta: 1 },
    comida: { proteicos_magros: 4, almidones: 3, grasas: 2, verduras: 2 },
    cena: { proteicos_magros: 3, almidones: 1, grasas: 1 },
  },
  notas: {},
};

describe('Suma el día entero, no una comida', () => {
  const p = presupuestoDelDia(DIA, {});

  it('junta las porciones de todas las comidas', () => {
    const carbo = p.find((m) => m.bucket === 'carbohidrato')!;
    const almidones = carbo.grupos.find((g) => g.grupo === 'almidones')!;
    // 2 del desayuno + 3 de la comida + 1 de la cena
    expect(almidones.pautado).toBe(6);
  });

  it('agrupa los subgrupos bajo su macro', () => {
    const prote = p.find((m) => m.bucket === 'proteina')!;
    expect(prote.grupos.map((g) => g.grupo).sort()).toEqual([
      'lacteos_proteicos',
      'proteicos_magros',
    ]);
    // 2 lácteos + 4 magros + 3 magros
    expect(prote.pautado).toBe(9);
  });

  it('la verdura no entra: es ilimitada', () => {
    const todos = p.flatMap((m) => m.grupos.map((g) => g.grupo));
    expect(todos).not.toContain('verduras');
  });

  it('sin nada marcado, queda todo por comer', () => {
    for (const m of p) {
      expect(m.elegido).toBe(0);
      expect(m.restante).toBe(m.pautado);
    }
  });
});

describe('Descuenta lo que va marcando, sin importar en qué comida', () => {
  it('da igual dónde se lo coma: cuenta contra el total del día', () => {
    // Se come en el desayuno tres almidones, que eran «de la comida».
    const p = presupuestoDelDia(DIA, { desayuno: { almidones: 3 } });
    const almidones = p
      .find((m) => m.bucket === 'carbohidrato')!
      .grupos.find((g) => g.grupo === 'almidones')!;
    expect(almidones.elegido).toBe(3);
    expect(almidones.restante).toBe(3);
  });

  it('suma lo de varias comidas', () => {
    const p = presupuestoDelDia(DIA, {
      desayuno: { almidones: 2 },
      comida: { almidones: 3, proteicos_magros: 4 },
    });
    const carbo = p.find((m) => m.bucket === 'carbohidrato')!;
    expect(carbo.grupos.find((g) => g.grupo === 'almidones')!.elegido).toBe(5);
    const prote = p.find((m) => m.bucket === 'proteina')!;
    expect(prote.elegido).toBe(4);
    expect(prote.restante).toBe(5);
  });

  it('pasarse sale en negativo, para poder decirlo', () => {
    const p = presupuestoDelDia(DIA, { cena: { grasas: 5 } });
    const grasa = p.find((m) => m.bucket === 'grasa')!;
    // 3 pautadas menos 2 del aceite = 1 a elegir; se eligen 5.
    expect(grasa.restante).toBe(-4);
  });

  it('un subgrupo que no estaba pautado aparece igual', () => {
    // Coge frutos secos donde no había ninguno pautado: tiene que verse.
    const p = presupuestoDelDia(DIA, { cena: { frutos_secos: 1 } });
    const grasa = p.find((m) => m.bucket === 'grasa')!;
    const fs = grasa.grupos.find((g) => g.grupo === 'frutos_secos');
    expect(fs).toBeDefined();
    expect(fs!.pautado).toBe(0);
    expect(fs!.elegido).toBe(1);
  });
});

/**
 * EL ACEITE DE COCINAR NO SE ESCOGE
 *
 * Cada comida principal reserva una porción de grasa para el aceite, que no
 * aparece en la despensa porque se da por puesto. Contándola como pendiente,
 * la clienta llenaba todas sus comidas y el presupuesto seguía diciéndole que
 * le faltaban grasas, sin nada que pudiera marcar para completarlas.
 */
describe('Las grasas del aceite no se piden dos veces', () => {
  it('lo que hay que elegir es lo pautado menos el aceite', () => {
    const p = presupuestoDelDia(DIA, {});
    const grasa = p.find((m) => m.bucket === 'grasa')!;
    // 2 en la comida + 1 en la cena = 3, menos 1 de aceite en cada una.
    expect(reservaAceiteDelDia(DIA)).toBe(2);
    expect(grasa.pautado).toBe(1);
  });

  it('llenando lo que se puede elegir, el día queda completo', () => {
    const p = presupuestoDelDia(DIA, { comida: { grasas: 1 } });
    const grasa = p.find((m) => m.bucket === 'grasa')!;
    expect(grasa.restante).toBe(0);
  });

  it('un día sin aceite reservado no cambia', () => {
    // Sólo desayuno: no es una comida de las que llevan aceite de cocción.
    const soloDesayuno: DayType = {
      ...DIA,
      meals: [DIA.meals[0]],
      grid: { desayuno: { grasas: 2, almidones: 2 } },
    };
    expect(reservaAceiteDelDia(soloDesayuno)).toBe(0);
    const grasa = presupuestoDelDia(soloDesayuno, {}).find((m) => m.bucket === 'grasa')!;
    expect(grasa.pautado).toBe(2);
  });

  it('los demás macros no se tocan', () => {
    const p = presupuestoDelDia(DIA, {});
    expect(p.find((m) => m.bucket === 'proteina')!.pautado).toBe(9);
    expect(p.find((m) => m.bucket === 'carbohidrato')!.pautado).toBe(7);
  });
});

describe('Un día sin nada pautado no enseña presupuesto', () => {
  it('devuelve la lista vacía', () => {
    const vacio: DayType = { ...DIA, grid: {} };
    expect(presupuestoDelDia(vacio, {})).toEqual([]);
  });
});
