import { describe, it, expect } from 'vitest';
import { escalarMedida, formatCantidad, parseCantidad, pluralizar } from '../measures';
import { describirReparto } from '../mealOptions';
import { generarCombinaciones, objetivoDeBucket } from '../combos';
import {
  balanceBucket,
  balanceComida,
  balanceGrasa,
  resumenDia,
  pautadoDelDia,
} from '../dailyBudget';
import { exchangesToMacros } from '../exchanges';
import { kcalFromMacros } from '../macros';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import { FASES, FASE_POR_NUMERO } from '../../types/plan';
import type { DayType, Meal } from '../../types/plan';
import type { Alimento } from '../../types/food';

// ─────────────────────────── MEDIDAS CASERAS

describe('Escalado de medidas caseras', () => {
  it('lee números, fracciones y mixtos', () => {
    expect(parseCantidad('1')).toBe(1);
    expect(parseCantidad('1/2')).toBe(0.5);
    expect(parseCantidad('1 1/2')).toBe(1.5);
    expect(parseCantidad('0,5')).toBe(0.5);
  });

  it('los escribe como lo haría una persona', () => {
    expect(formatCantidad(2)).toBe('2');
    expect(formatCantidad(0.5)).toBe('1/2');
    expect(formatCantidad(1.5)).toBe('1 1/2');
    expect(formatCantidad(0.25)).toBe('1/4');
    expect(formatCantidad(2.75)).toBe('2 3/4');
  });

  it('pluraliza en español', () => {
    expect(pluralizar('huevo')).toBe('huevos');
    expect(pluralizar('taza')).toBe('tazas');
    expect(pluralizar('unidad')).toBe('unidades');
    expect(pluralizar('porción')).toBe('porciones');
    expect(pluralizar('cda')).toBe('cdas');
  });

  it('multiplica la medida y ajusta el plural', () => {
    expect(escalarMedida('1 huevo', 2)).toBe('2 huevos');
    expect(escalarMedida('1/2 taza', 3)).toBe('1 1/2 tazas');
    expect(escalarMedida('2 lonchas', 2)).toBe('4 lonchas');
    expect(escalarMedida('1 rebanada', 1)).toBe('1 rebanada');
  });

  it('con medidas sin número antepone el multiplicador', () => {
    expect(escalarMedida('Filete pequeño', 3)).toBe('3 × filete pequeño');
    expect(escalarMedida('Porción', 2)).toBe('2 × porción');
  });

  it('el singular no se pluraliza', () => {
    expect(escalarMedida('2 claras', 0.5)).toBe('1 clara');
  });
});

// ─────────────────────────── FASE 2 · OPCIONES ESCALADAS

describe('Fase 2 — opciones con las cantidades ya hechas', () => {
  // Desayuno: 2 proteicos semigrasos + 1 magro · 2 almidones · 1 grasa
  const desayuno = { proteicos_semigrasos: 2, proteicos_magros: 1, almidones: 2, grasas: 1 };

  const objProt = objetivoDeBucket(desayuno, 'proteina')!;
  const despensaProt = ['Contramuslo deshuesado crudo', 'Clara de huevo', 'Jamón York'].map(
    (n) => FOOD_CATALOG.find((f) => f.nombre === n)!,
  );
  const prot = { opciones: generarCombinaciones(objProt, despensaProt, { limite: 6 }) };

  it('cada opción cubre las porciones de proteína sin pasarse de calorías', () => {
    expect(prot.opciones.length).toBeGreaterThan(0);
    for (const o of prot.opciones) {
      const total = o.items.reduce((s, i) => s + i.intercambios, 0);
      expect(total, o.texto).toBe(3);
    }
  });

  it('ninguna opción se pasa del techo calórico de su familia', () => {
    for (const o of prot.opciones) {
      expect(kcalFromMacros(exchangesToMacros(o.cubre)), o.texto).toBeLessThanOrEqual(
        objProt.kcalMaximas * 1.02 + 0.01,
      );
    }
  });

  it('los gramos vienen multiplicados por las porciones', () => {
    const item = prot.opciones
      .flatMap((o) => o.items)
      .find((i) => i.nombre === 'Contramuslo deshuesado crudo' && i.intercambios === 2)!;
    expect(item).toBeTruthy();
    // 17 g de proteína/100 g → 40 g por intercambio → ×2
    expect(item.gramos).toBe(80);
  });

  it('el texto se lee como el documento de la nutricionista', () => {
    const o = prot.opciones.find((x) => !x.unificada)!;
    // Cada línea lleva su cantidad, con medida casera entre paréntesis
    // ("2 huevos (120 g)") o directa cuando no la hay ("80 g de pollo").
    expect(o.texto).toMatch(/\d+ (g|ml)/);
    expect(o.texto).toContain(' + ');
    // Y nunca repite la cantidad dos veces en la misma línea.
    expect(o.texto).not.toMatch(/(\d+ (?:g|ml)) de [^+]*\(\1\)/);
  });

  it('ofrece también opciones de un solo alimento', () => {
    const solas = prot.opciones.filter((o) => o.items.length === 1);
    expect(solas.length).toBeGreaterThan(0);
    for (const o of solas) expect(o.items[0].intercambios).toBe(3); // 2 + 1
  });

  it('con una sola porción de grasa, cada opción es un alimento', () => {
    const objGrasa = objetivoDeBucket(desayuno, 'grasa')!;
    const grasa = generarCombinaciones(
      objGrasa,
      ['Aceite de oliva virgen extra', 'Aguacate'].map(
        (n) => FOOD_CATALOG.find((f) => f.nombre === n)!,
      ),
    );
    expect(objGrasa.porciones).toBe(1);
    expect(grasa.every((o) => o.items[0].intercambios === 1)).toBe(true);
  });

  it('la comida escala el pollo a los 5 intercambios pautados', () => {
    const comida = { proteicos_magros: 5, almidones: 4, grasas: 2, verduras: 2 };
    const obj = objetivoDeBucket(comida, 'proteina')!;
    const pollo = FOOD_CATALOG.find((f) => f.nombre === 'Pechuga de pollo cruda')!;
    const opciones = generarCombinaciones(obj, [pollo]);
    // 22 g de proteína/100 g → 30 g por intercambio → ×5
    expect(opciones[0].items[0].gramos).toBe(150);
  });

  it('sólo usa los alimentos de la despensa que se le pasa', () => {
    const soloClaras = generarCombinaciones(objProt, [
      FOOD_CATALOG.find((f) => f.nombre === 'Clara de huevo')!,
    ]);
    expect(soloClaras.every((o) => o.items.every((i) => i.nombre === 'Clara de huevo'))).toBe(true);
  });

  it('las verduras no generan objetivo: son ilimitadas', () => {
    expect(objetivoDeBucket({ verduras: 3, proteicos_magros: 2 }, 'carbohidrato')).toBeUndefined();
  });

  it('describe el reparto en palabras', () => {
    expect(describirReparto([['proteicos_semigrasos', 2], ['proteicos_magros', 1]])).toBe(
      '2 proteicos semigrasos + 1 proteicos magros',
    );
  });

  it('sin candidatos no inventa opciones', () => {
    const raro: Alimento[] = [];
    const obj = objetivoDeBucket({ proteicos_magros: 2 }, 'proteina')!;
    expect(generarCombinaciones(obj, raro)).toHaveLength(0);
  });
});

// ─────────────────────────── FASE 3 · PRESUPUESTO DIARIO

const MEALS: Meal[] = [
  { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
  { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 2 },
  { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 3 },
];

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día entreno CrossFit',
  proteinaGkg: 2,
  hcGkg: 4,
  meals: MEALS,
  grid: {
    // proteína: 1 + 2 + 2 = 5 al día
    desayuno: { proteicos_magros: 1, almidones: 3, grasas: 1 },
    comida: { proteicos_grasos: 2, almidones: 4, grasas: 2, verduras: 2 },
    cena: { proteicos_magros: 2, almidones: 2, grasas: 1, verduras: 2 },
  },
  notas: {},
};

describe('Fase 3 — presupuesto del día', () => {
  it('cuenta lo pautado por comida y por día', () => {
    expect(pautadoDelDia(DIA).proteina).toBe(5);
    const b = balanceBucket(DIA, MEALS[1], 'proteina', {});
    expect(b.pautadoComida).toBe(2);
    expect(b.pautadoDia).toBe(5);
  });

  it('sin elegir nada el estado es pendiente y no hay mensaje', () => {
    const b = balanceBucket(DIA, MEALS[1], 'proteina', {});
    expect(b.estado).toBe('pendiente');
    expect(b.mensaje).toBeUndefined();
  });

  it('al completar lo pautado marca la comida como cerrada', () => {
    const b = balanceBucket(DIA, MEALS[1], 'proteina', { comida: { proteina: 2 } });
    expect(b.estado).toBe('completo');
    expect(b.mensaje).toBeUndefined();
  });

  it('pasarse de proteína no genera aviso: lo que cuenta es la grasa', () => {
    const b = balanceBucket(DIA, MEALS[1], 'proteina', { comida: { proteina: 3 } });
    expect(b.estado).toBe('completo');
    expect(b.mensaje).toBeUndefined();
    // El contador sí lo refleja, para que se vea lo que lleva.
    expect(b.elegidoComida).toBe(3);
    expect(b.restanteDia).toBe(2);
  });

  it('en carbohidrato sí se avisa, porque ahí las porciones son las kcal', () => {
    const b = balanceBucket(DIA, MEALS[1], 'carbohidrato', { comida: { carbohidrato: 6 } });
    expect(b.estado).toBe('excedido');
    expect(b.mensaje).toContain('porciones de carbohidrato');
  });

  it('tiene en cuenta lo ya consumido en otras comidas', () => {
    const b = balanceBucket(DIA, MEALS[1], 'proteina', {
      desayuno: { proteina: 2 },
      comida: { proteina: 3 },
    });
    expect(b.elegidoOtras).toBe(2);
    expect(b.restanteDia).toBe(0);
  });

  it('avisa cuando ya no queda margen en el día, en los macros que sí limitan', () => {
    const b = balanceBucket(DIA, MEALS[1], 'carbohidrato', {
      desayuno: { carbohidrato: 5 },
      comida: { carbohidrato: 8 },
    });
    expect(b.estado).toBe('sin_margen');
    expect(b.mensaje).toContain('Te has pasado');
    expect(b.mensaje).toContain('compensar');
  });

  it('quedarse corto no genera alarma', () => {
    const b = balanceBucket(DIA, MEALS[1], 'proteina', { comida: { proteina: 1 } });
    expect(b.estado).toBe('pendiente');
    expect(b.mensaje).toBeUndefined();
  });

  it('devuelve el balance de los tres macros de la comida', () => {
    const bs = balanceComida(DIA, MEALS[1], {});
    expect(bs.map((b) => b.bucket)).toEqual(['proteina', 'carbohidrato', 'grasa']);
  });

  it('el resumen del día suma todas las comidas', () => {
    const r = resumenDia(DIA, { desayuno: { proteina: 1 }, cena: { proteina: 2 } });
    const prot = r.find((x) => x.bucket === 'proteina')!;
    expect(prot.pautado).toBe(5);
    expect(prot.elegido).toBe(3);
    expect(prot.restante).toBe(2);
  });

  it('acepta medias porciones', () => {
    const b = balanceBucket(DIA, MEALS[1], 'proteina', { comida: { proteina: 2.5 } });
    expect(b.restanteDia).toBe(2.5);
    const c = balanceBucket(DIA, MEALS[1], 'carbohidrato', { comida: { carbohidrato: 4.5 } });
    expect(c.estado).toBe('excedido');
  });

  it('lo que sí se vigila es la grasa de la proteína del día', () => {
    // Pautado: 1 magro + 2 grasos + 2 magros = 0.5 + 10 + 1 = 11.5 g de grasa.
    const sinPasarse = balanceGrasa(DIA, 'proteicos', {
      comida: { proteicos_magros: 2 },
      cena: { proteicos_magros: 2 },
      desayuno: { proteicos_magros: 1 },
    });
    expect(sinPasarse.mensaje).toBeUndefined();

    const pasandose = balanceGrasa(DIA, 'proteicos', {
      comida: { proteicos_grasos: 4 },
      cena: { proteicos_grasos: 2 },
    });
    expect(pasandose.elegidaDia).toBeCloseTo(30, 4);
    expect(pasandose.mensaje).toMatch(/g de grasa de proteicos/);
  });

  it('comer de más en magros no dispara el aviso de grasa', () => {
    const g = balanceGrasa(DIA, 'proteicos', { comida: { proteicos_magros: 8 } });
    // 8 × 0.5 = 4 g, muy por debajo de los 11.5 g pautados.
    expect(g.elegidaDia).toBeCloseTo(4, 4);
    expect(g.mensaje).toBeUndefined();
  });
});

// ─────────────────────────── LAS FASES

describe('Las fases de entrega', () => {
  it('están definidas en orden de autonomía creciente', () => {
    expect(FASES.map((f) => f.fase)).toEqual([1, 2, 3, 4]);
    expect(FASES.map((f) => f.autonomia)).toEqual(['Baja', 'Media', 'Alta', 'Total']);
  });

  it('cada una describe qué recibe el cliente', () => {
    expect(FASE_POR_NUMERO[1].titulo).toMatch(/recetas/i);
    expect(FASE_POR_NUMERO[2].titulo).toMatch(/cantidades/i);
    expect(FASE_POR_NUMERO[3].titulo).toMatch(/intercambios/i);
    expect(FASE_POR_NUMERO[4].titulo).toMatch(/macros/i);
  });

  /** La 4 es el alta, no el principio: quien entra nuevo no cuenta gramos. */
  it('la última es para quien ya se maneja sola', () => {
    expect(FASE_POR_NUMERO[4].paraQuien).toMatch(/domina|sola/i);
  });

  it('las tres presentan los mismos intercambios pautados', () => {
    const total = pautadoDelDia(DIA);
    // Fase 2 los escala; fase 3 los lista; el total del día no cambia.
    const protComida = objetivoDeBucket(DIA.grid.comida!, 'proteina')!;
    expect(protComida.porciones).toBe(2);
    expect(total.proteina).toBe(5);
  });
});
