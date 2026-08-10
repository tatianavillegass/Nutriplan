import { describe, it, expect } from 'vitest';
import {
  adherenciaDelDia,
  balanceDelDia,
  gramosMarcados,
  kcalDelDia,
  macrosDeExtra,
  macrosDePorciones,
  porcionesDeBucket,
  totalExtras,
} from '../diary';
import {
  claveFecha,
  desdeClave,
  fechaLegible,
  inicioSemana,
  registroVacio,
  sumarDias,
  DIAS_CORTOS,
} from '../../types/diary';
import type { RegistroDia } from '../../types/diary';
import type { DayType, Meal } from '../../types/plan';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import { kcalFromMacros } from '../macros';

const MEALS: Meal[] = [
  { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
  { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 2 },
  { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 3 },
];

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día descanso',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: MEALS,
  grid: {
    desayuno: { proteicos_magros: 2, almidones: 3, grasas: 1 },
    comida: { proteicos_magros: 5, almidones: 4, grasas: 2, verduras: 2 },
    cena: { proteicos_semigrasos: 3, almidones: 2, grasas: 1, verduras: 2 },
  },
  notas: {},
};

const base = (): RegistroDia => registroVacio('cl1', '2026-08-07', 'rg1');

// ─────────────────────────── FECHAS

describe('Fechas del calendario', () => {
  it('la clave no se desplaza por la zona horaria', () => {
    const d = new Date(2026, 7, 7, 23, 30);
    expect(claveFecha(d)).toBe('2026-08-07');
    expect(claveFecha(desdeClave('2026-08-07'))).toBe('2026-08-07');
  });

  it('la semana empieza en lunes', () => {
    // 2026-08-07 es viernes
    const lunes = inicioSemana(desdeClave('2026-08-07'));
    expect(claveFecha(lunes)).toBe('2026-08-03');
    expect(lunes.getDay()).toBe(1);
  });

  it('el lunes de un domingo es el lunes anterior, no el siguiente', () => {
    const lunes = inicioSemana(desdeClave('2026-08-09')); // domingo
    expect(claveFecha(lunes)).toBe('2026-08-03');
  });

  it('suma días cruzando meses', () => {
    expect(claveFecha(sumarDias(desdeClave('2026-08-30'), 3))).toBe('2026-09-02');
  });

  it('escribe la fecha en español', () => {
    expect(fechaLegible('2026-08-07')).toBe('viernes 7 de agosto');
    expect(DIAS_CORTOS[desdeClave('2026-08-07').getDay()]).toBe('VIE');
  });
});

// ─────────────────────────── PORCIONES MARCADAS

describe('Porciones que marca el cliente', () => {
  const pollo = FOOD_CATALOG.find((f) => f.nombre === 'Pechuga de pollo cruda')!;

  it('tres toques a pollo son 3 porciones y 90 g', () => {
    expect(pollo.gramos).toBe(30);
    expect(gramosMarcados(pollo, 3)).toBe(90);
  });

  it('cuenta las porciones de un bucket en una comida', () => {
    const r: RegistroDia = { ...base(), porciones: { comida: { [pollo.id]: 3 } } };
    expect(porcionesDeBucket(r, 'comida', 'proteina', FOOD_CATALOG)).toBe(3);
    expect(porcionesDeBucket(r, 'comida', 'carbohidrato', FOOD_CATALOG)).toBe(0);
  });

  it('las verduras no cuentan en el marcador: son ilimitadas', () => {
    const brocoli = FOOD_CATALOG.find((f) => f.nombre === 'Brocoli')!;
    const r: RegistroDia = { ...base(), porciones: { comida: { [brocoli.id]: 4 } } };
    expect(porcionesDeBucket(r, 'comida', 'carbohidrato', FOOD_CATALOG)).toBe(0);
  });

  it('los macros salen de la tabla de intercambios, no de los gramos', () => {
    const r: RegistroDia = { ...base(), porciones: { comida: { [pollo.id]: 3 } } };
    const m = macrosDePorciones(r, FOOD_CATALOG);
    expect(m.proteina).toBe(21); // 3 × 7
    expect(m.grasa).toBeCloseTo(1.5, 6); // 3 × 0.5
  });

  it('suma lo marcado en varias comidas', () => {
    const avena = FOOD_CATALOG.find((f) => f.nombre === 'Avena copos')!;
    const r: RegistroDia = {
      ...base(),
      porciones: { desayuno: { [avena.id]: 2 }, comida: { [pollo.id]: 5 } },
    };
    const m = macrosDePorciones(r, FOOD_CATALOG);
    expect(m.hc).toBe(28); // 2 almidones
    expect(m.proteina).toBe(2 * 2 + 5 * 7);
  });
});

// ─────────────────────────── EXTRAS

describe('Extras fuera del plan', () => {
  const cerveza = {
    id: 'ex1',
    nombre: 'Cerveza',
    macros: { proteina: 1.5, hc: 13, grasa: 0 },
    kcal: 58,
  };

  it('suma calorías y macros de varios extras', () => {
    const t = totalExtras([cerveza, { ...cerveza, id: 'ex2' }]);
    expect(t.kcal).toBe(116);
    expect(t.macros.hc).toBe(26);
  });

  it('calcula los macros de un extra desde el catálogo', () => {
    const choco = FOOD_CATALOG.find((f) => f.nombre === 'Chocolate 85% cacao')!;
    const r = macrosDeExtra(30, choco);
    expect(r.macros.grasa).toBeCloseTo((choco.nutrientes!.grasa * 30) / 100, 6);
    expect(r.kcal).toBeCloseTo(kcalFromMacros(r.macros), 6);
  });

  it('sin alimento del catálogo no inventa macros', () => {
    const r = macrosDeExtra(100, undefined);
    expect(r.macros).toEqual({ proteina: 0, hc: 0, grasa: 0 });
    expect(r.kcal).toBe(0);
  });

  it('el extra desplaza el día pero no lo rompe', () => {
    const r: RegistroDia = { ...base(), extras: [cerveza] };
    const b = balanceDelDia(DIA, r, FOOD_CATALOG, { asumirPlanCumplido: true });
    expect(b.kcalTotal).toBeCloseTo(b.kcalPautado + 58, 4);
    expect(b.kcalDiferencia).toBeCloseTo(58, 4);
    expect(b.pesoExtras).toBeGreaterThan(0);
    expect(b.pesoExtras).toBeLessThan(10);
  });

  it('el peso del extra se mide contra las calorías pautadas', () => {
    const grande = { ...cerveza, id: 'ex3', kcal: 500, macros: { proteina: 0, hc: 60, grasa: 25 } };
    const b = balanceDelDia(DIA, { ...base(), extras: [grande] }, FOOD_CATALOG, {
      asumirPlanCumplido: true,
    });
    expect(b.pesoExtras).toBeCloseTo((500 / b.kcalPautado) * 100, 4);
  });
});

// ─────────────────────────── BALANCE Y ADHERENCIA

describe('Balance del día', () => {
  it('sin registro, el día es exactamente lo pautado', () => {
    const b = balanceDelDia(DIA, undefined, FOOD_CATALOG, { asumirPlanCumplido: true });
    expect(b.kcalTotal).toBeCloseTo(b.kcalPautado, 4);
    expect(b.kcalDiferencia).toBeCloseTo(0, 6);
  });

  it('cuando el cliente marca porciones, manda lo marcado', () => {
    const pollo = FOOD_CATALOG.find((f) => f.nombre === 'Pechuga de pollo cruda')!;
    const r: RegistroDia = { ...base(), porciones: { comida: { [pollo.id]: 2 } } };
    const b = balanceDelDia(DIA, r, FOOD_CATALOG, { asumirPlanCumplido: true });
    expect(b.delPlan.proteina).toBe(14);
    expect(b.kcalTotal).toBeLessThan(b.kcalPautado);
  });

  it('las calorías del tipo de día salen de la grilla', () => {
    expect(kcalDelDia(DIA)).toBeGreaterThan(1000);
    expect(kcalDelDia(undefined)).toBe(0);
  });
});

describe('Adherencia', () => {
  it('cuenta las comidas marcadas como hechas', () => {
    const r: RegistroDia = { ...base(), cumplidas: ['desayuno', 'comida'] };
    const a = adherenciaDelDia(r, DIA);
    expect(a.comidasCumplidas).toBe(2);
    expect(a.comidasTotales).toBe(3);
    expect(a.porcentaje).toBe(67);
  });

  it('un día sin registro está al 0 %', () => {
    expect(adherenciaDelDia(undefined, DIA).porcentaje).toBe(0);
  });

  it('un día completo llega al 100 %', () => {
    const r: RegistroDia = { ...base(), cumplidas: ['desayuno', 'comida', 'cena'] };
    expect(adherenciaDelDia(r, DIA).porcentaje).toBe(100);
  });

  it('registra cuántos extras hubo ese día', () => {
    const r: RegistroDia = {
      ...base(),
      extras: [{ id: 'e', nombre: 'Cerveza', macros: { proteina: 0, hc: 13, grasa: 0 }, kcal: 58 }],
    };
    const a = adherenciaDelDia(r, DIA);
    expect(a.extras).toBe(1);
    expect(a.kcalExtras).toBe(58);
  });
});
