import { describe, it, expect } from 'vitest';
import {
  costeDeFamilia,
  generarCombinaciones,
  kcalDeOpcion,
  objetivoDeBucket,
  techoDeFamilia,
  validarCombo,
} from '../combos';
import type { ExchangeCounts } from '../exchanges';
import {
  alimentosDeComida,
  alternarExclusion,
  anadirAlimento,
  estaExcluido,
  notaAceite,
  repartoElegible,
  reservaAceite,
} from '../pantry';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import type { CombinacionGuardada, DayType, Meal } from '../../types/plan';
import {
  columnasDeComida,
  desdeOpcion,
  fusionarItems,
  guardarCombinacion,
  materializar,
  quitarCombinacion,
  sumarItem,
} from '../combosGuardados';
import { etiquetaItem, textoItem } from '../mealOptions';

const MEALS: Meal[] = [
  { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
  { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 2 },
  { id: 'merienda', nombre: 'Merienda', slot: 'merienda', orden: 3 },
  { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 4 },
];

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día entreno',
  proteinaGkg: 2,
  hcGkg: 4,
  meals: MEALS,
  grid: {
    // El caso del brief: 2 semigrasas + 2 magras
    desayuno: { proteicos_semigrasos: 2, proteicos_magros: 2, almidones: 2, grasas: 1 },
    comida: { proteicos_magros: 5, almidones: 4, grasas: 3, verduras: 2 },
    merienda: { proteicos_magros: 2, almidones: 1, grasas: 1 },
    cena: { proteicos_semigrasos: 2, almidones: 2, grasas: 2, verduras: 2 },
  },
  notas: {},
};

const id = (nombre: string) => FOOD_CATALOG.find((f) => f.nombre === nombre)!.id;

// ─────────────────────────── COMBINACIONES

describe('Combinaciones con tope calórico', () => {
  const objetivo = objetivoDeBucket(DIA.grid.desayuno!, 'proteina')!;

  it('el objetivo son las porciones del macro y las kcal que suman', () => {
    expect(objetivo.porciones).toBe(4);
    // 2 semigrasos (46 kcal) + 2 magros (32.5 kcal)
    expect(objetivo.kcalMaximas).toBeCloseTo(2 * 46 + 2 * 32.5, 4);
    expect(objetivo.kcalMaximas).toBeCloseTo(157, 4);
  });

  // Todos proteicos: el huevo es semigraso en esta prueba, así que se usa
  // un semigraso real de la base (tofu) junto a varios magros.
  const despensa = [
    'Tofu firme',
    'Clara de huevo',
    'Jamón York',
    'Queso cottage',
    'Proteína whey aislada',
    'Pechuga de pollo cruda',
  ].map((n) => FOOD_CATALOG.find((f) => f.nombre === n)!);

  const combos = generarCombinaciones(objetivo, despensa, { limite: 8 });

  it('todas las combinaciones cubren las 4 porciones', () => {
    expect(combos.length).toBeGreaterThan(2);
    for (const c of combos) {
      const total = c.items.reduce((s, i) => s + i.intercambios, 0);
      expect(total, c.texto).toBe(4);
    }
  });

  it('ninguna se pasa de las calorías pautadas', () => {
    for (const c of combos) {
      expect(kcalDeOpcion(c), c.texto).toBeLessThanOrEqual(objetivo.kcalMaximas * 1.02 + 0.01);
    }
  });

  it('permite servirlo todo magro, que sale más barato en calorías', () => {
    // Los magros valen todos lo mismo (32.5 kcal), así que basta con que
    // exista una opción de un solo alimento magro que cubra las 4 porciones.
    const todoMagro = combos.filter(
      (c) => c.items.length === 1 && c.items[0].grupo === 'proteicos_magros',
    );
    expect(todoMagro.length).toBeGreaterThan(0);
    expect(todoMagro[0].items[0].intercambios).toBe(4);
    expect(kcalDeOpcion(todoMagro[0])).toBeCloseTo(4 * 32.5, 4);
    expect(kcalDeOpcion(todoMagro[0])).toBeLessThan(objetivo.kcalMaximas);
  });

  it('no permite cuatro semigrasos: se pasaría de calorías', () => {
    const cuatroSemi = combos.find(
      (c) => c.items.length === 1 && c.items[0].grupo === 'proteicos_semigrasos',
    );
    expect(cuatroSemi).toBeUndefined();
    expect(4 * 46).toBeGreaterThan(objetivo.kcalMaximas);
  });

  it('reproduce las combinaciones del ejemplo', () => {
    const textos = combos.map((c) =>
      c.items.map((i) => `${i.nombre}:${i.intercambios}`).sort().join('+'),
    );
    // 2 huevos + 2 claras
    expect(textos.some((t) => t.includes('Tofu firme:2'))).toBe(true);
    // Un semigraso más dos magros también cuadra sin pasarse.
    expect(textos.some((t) => t.split('+').length >= 2)).toBe(true);
  });

  it('escala los gramos y la medida casera', () => {
    const claras = combos
      .flatMap((c) => c.items)
      .find((i) => i.nombre === 'Clara de huevo' && i.intercambios === 2)!;
    // 11 g de proteína/100 g → 65 g por intercambio
    expect(claras.gramos).toBe(130);
    expect(claras.unidad).toBe('ml');
  });

  it('no repite el mismo alimento como protagonista en toda la lista', () => {
    const principales = combos.map(
      (c) => [...c.items].sort((a, b) => b.intercambios - a.intercambios)[0].foodId,
    );
    const cuentas = new Map<string, number>();
    for (const p of principales) cuentas.set(p, (cuentas.get(p) ?? 0) + 1);
    expect(Math.max(...cuentas.values())).toBeLessThanOrEqual(2);
  });

  it('con una despensa de un solo alimento devuelve la única combinación posible', () => {
    const solo = [FOOD_CATALOG.find((f) => f.nombre === 'Clara de huevo')!];
    const c = generarCombinaciones(objetivo, solo);
    expect(c).toHaveLength(1);
    expect(c[0].items[0].intercambios).toBe(4);
  });

  it('con la despensa vacía no inventa nada', () => {
    expect(generarCombinaciones(objetivo, [])).toHaveLength(0);
  });

  it('un macro sin porciones no genera objetivo', () => {
    expect(objetivoDeBucket({ almidones: 2 }, 'proteina')).toBeUndefined();
  });

  it('las verduras no entran en el objetivo: son ilimitadas', () => {
    const o = objetivoDeBucket(DIA.grid.comida!, 'carbohidrato')!;
    expect(o.porciones).toBe(4); // sólo los almidones
  });
});

describe('Las familias no se mezclan', () => {
  // 1 almidón + 1 fruta: el caso que fallaba
  const reparto = { almidones: 1, fruta: 1 };
  const objetivo = objetivoDeBucket(reparto, 'carbohidrato')!;

  const despensa = ['Avena copos', 'Cereales de trigo', 'Pan integral tajado', 'Plátano', 'Manzana', 'Pera'].map(
    (n) => FOOD_CATALOG.find((f) => f.nombre === n)!,
  );

  it('separa el objetivo en una familia por tipo de alimento', () => {
    expect(objetivo.familias.map((f) => f.familia).sort()).toEqual(['almidones', 'fruta']);
    expect(objetivo.familias.find((f) => f.familia === 'almidones')!.porciones).toBe(1);
    expect(objetivo.familias.find((f) => f.familia === 'fruta')!.porciones).toBe(1);
  });

  it('toda combinación trae un almidón Y una fruta', () => {
    const combos = generarCombinaciones(objetivo, despensa, { limite: 6 });
    expect(combos.length).toBeGreaterThan(0);
    for (const c of combos) {
      const grupos = c.items.map((i) => i.grupo);
      expect(grupos, c.texto).toContain('almidones');
      expect(grupos, c.texto).toContain('fruta');
    }
  });

  it('ya no propone avena + cereales, que eran dos almidones', () => {
    const combos = generarCombinaciones(objetivo, despensa, { limite: 6 });
    const dosAlmidones = combos.find(
      (c) => c.items.filter((i) => i.grupo === 'almidones').length === 2,
    );
    expect(dosAlmidones).toBeUndefined();
  });

  it('sin fruta en la despensa no hay ninguna combinación posible', () => {
    const soloAlmidones = despensa.filter((f) => f.grupo === 'almidones');
    expect(generarCombinaciones(objetivo, soloAlmidones)).toHaveLength(0);
  });

  it('los lácteos son proteína: una sola familia', () => {
    const o = objetivoDeBucket({ proteicos_magros: 2, lacteos_desnatados: 1 }, 'proteina')!;
    expect(o.familias.map((f) => f.familia)).toEqual(['proteicos']);
    expect(o.familias[0].porciones).toBe(3);
  });

  it('un yogur proteico puede cubrir una porción pautada como proteico magro', () => {
    const o = objetivoDeBucket({ proteicos_magros: 2 }, 'proteina')!;
    const combos = generarCombinaciones(
      o,
      ['Clara de huevo', 'Yogur proteínas Mercadona', 'Queso cottage'].map(
        (n) => FOOD_CATALOG.find((f) => f.nombre === n)!,
      ),
      { limite: 6 },
    );
    expect(combos.length).toBeGreaterThan(0);
    expect(
      combos.some((c) => c.items.some((i) => i.grupo === 'lacteos_proteicos')),
      combos.map((c) => c.texto).join(' | '),
    ).toBe(true);
  });

  it('el hidrato del lácteo no cuenta para el tope de proteína, pero se avisa', () => {
    const o = objetivoDeBucket({ proteicos_magros: 2 }, 'proteina')!;
    // 2 magros = 65 kcal de tope, sin contar el hidrato de ningún lácteo.
    expect(o.kcalMaximas).toBeCloseTo(2 * (7 * 4 + 0.5 * 9), 4);

    const v = validarCombo(o, [{ grupo: 'lacteos_desnatados', intercambios: 2 }]);
    expect(v.valida).toBe(true);
    // 2 × 12 g de HC que no estaban pautados como lácteo.
    expect(v.hcDeLacteos).toBeCloseTo(24, 4);
    expect(v.nota).toMatch(/24 g de hidrato/);
  });

  it('sin lácteos no hay nota de hidrato', () => {
    const o = objetivoDeBucket({ proteicos_magros: 2 }, 'proteina')!;
    const v = validarCombo(o, [{ grupo: 'proteicos_magros', intercambios: 2 }]);
    expect(v.valida).toBe(true);
    expect(v.hcDeLacteos).toBeUndefined();
    expect(v.nota).toBeUndefined();
  });

  it('los proteicos grasos pautados son un techo: servirlo todo magro vale', () => {
    const o = objetivoDeBucket({ proteicos_grasos: 1, proteicos_magros: 1 }, 'proteina')!;
    const v = validarCombo(o, [{ grupo: 'proteicos_magros', intercambios: 2 }]);
    expect(v.valida).toBe(true);
    expect(v.kcal).toBeLessThan(v.kcalMaximas);
  });

  it('pero al revés no: dos grasos se pasan de lo pautado', () => {
    const o = objetivoDeBucket({ proteicos_grasos: 1, proteicos_magros: 1 }, 'proteina')!;
    const v = validarCombo(o, [{ grupo: 'proteicos_grasos', intercambios: 2 }]);
    expect(v.valida).toBe(false);
    expect(v.avisos.join(' ')).toMatch(/Se pasa/);
  });

  it('dentro de proteicos sí se puede bajar de graso a magro', () => {
    const o = objetivoDeBucket({ proteicos_semigrasos: 2, proteicos_magros: 2 }, 'proteina')!;
    expect(o.familias).toHaveLength(1);
    expect(o.familias[0].familia).toBe('proteicos');
  });
});

describe('Validación de combinaciones hechas a mano', () => {
  const objetivo = objetivoDeBucket({ almidones: 1, fruta: 1 }, 'carbohidrato')!;

  it('acepta la que cumple cada familia', () => {
    const v = validarCombo(objetivo, [
      { grupo: 'almidones', intercambios: 1 },
      { grupo: 'fruta', intercambios: 1 },
    ]);
    expect(v.valida).toBe(true);
    expect(v.avisos).toHaveLength(0);
  });

  it('rechaza dos almidones y lo explica', () => {
    const v = validarCombo(objetivo, [{ grupo: 'almidones', intercambios: 2 }]);
    expect(v.valida).toBe(false);
    expect(v.avisos.join(' ')).toMatch(/Sobran 1 de almidones/);
    expect(v.avisos.join(' ')).toMatch(/Faltan 1 de fruta/);
  });

  it('avisa de una familia que no pinta nada en esa comida', () => {
    const v = validarCombo(objetivo, [
      { grupo: 'almidones', intercambios: 1 },
      { grupo: 'fruta', intercambios: 1 },
      { grupo: 'azucares', intercambios: 1 },
    ]);
    expect(v.valida).toBe(false);
    expect(v.avisos.join(' ')).toMatch(/azucares no entra/);
  });

  it('en proteicos el aviso es de grasa, que es lo que limita', () => {
    const prot = objetivoDeBucket({ proteicos_semigrasos: 2, proteicos_magros: 2 }, 'proteina')!;
    // Pautado: 2 × 2 g + 2 × 0.5 g = 5 g de grasa como techo.
    expect(prot.familias[0].topeMaximo).toBeCloseTo(5, 4);
    const v = validarCombo(prot, [{ grupo: 'proteicos_semigrasos', intercambios: 4 }]);
    expect(v.valida).toBe(false);
    expect(v.avisos.join(' ')).toMatch(/g de grasa del máximo/);
  });

  it('los frutos secos cubren una porción de grasa: la misma grasa que el aceite', () => {
    const grasa = objetivoDeBucket({ grasas: 2 }, 'grasa')!;
    // 2 porciones de grasa = 10 g de grasa como techo.
    expect(grasa.familias[0].topeMaximo).toBeCloseTo(10, 4);

    const v = validarCombo(grasa, [{ grupo: 'frutos_secos', intercambios: 2 }]);
    expect(v.valida, v.avisos.join(' · ')).toBe(true);

    const combos = generarCombinaciones(
      grasa,
      ['Aceite de oliva virgen extra', 'Nueces', 'Almendras crudas'].map(
        (n) => FOOD_CATALOG.find((f) => f.nombre === n)!,
      ),
      { limite: 6 },
    );
    expect(
      combos.some((c) => c.items.some((i) => i.grupo === 'frutos_secos')),
      combos.map((c) => c.texto).join(' | '),
    ).toBe(true);
  });

  it('pero tres porciones de frutos secos donde había dos sí se pasan', () => {
    const grasa = objetivoDeBucket({ grasas: 2 }, 'grasa')!;
    const v = validarCombo(grasa, [{ grupo: 'frutos_secos', intercambios: 3 }]);
    expect(v.valida).toBe(false);
  });

  it('en carbohidrato el aviso sigue siendo de calorías', () => {
    const carbo = objetivoDeBucket({ fruta: 1 }, 'carbohidrato')!;
    // 1 fruta = 66 kcal; dos frutas se pasan del techo de su familia.
    const v = validarCombo(carbo, [{ grupo: 'fruta', intercambios: 2 }]);
    expect(v.valida).toBe(false);
    expect(v.avisos.join(' ')).toMatch(/Se pasa \d+ kcal/);
  });

  it('cuatro magros cumplen y no se pasan', () => {
    const prot = objetivoDeBucket({ proteicos_semigrasos: 2, proteicos_magros: 2 }, 'proteina')!;
    const v = validarCombo(prot, [{ grupo: 'proteicos_magros', intercambios: 4 }]);
    expect(v.valida).toBe(true);
    expect(v.kcal).toBeLessThan(v.kcalMaximas);
  });
});

// ─────────────────────────── DESPENSA POR COMIDA

describe('Despensa por comida', () => {
  it('por defecto muestra el catálogo filtrado por el tipo de comida', () => {
    const desayuno = alimentosDeComida(DIA, MEALS[0], FOOD_CATALOG);
    expect(desayuno.some((f) => f.nombre === 'Huevo')).toBe(true);
    expect(desayuno.some((f) => f.nombre === 'Lentejas crudas')).toBe(false);
  });

  it('quitar el huevo de la merienda no lo quita del desayuno', () => {
    const despensa = alternarExclusion(DIA, 'merienda', id('Huevo'));
    const dia = { ...DIA, despensa };

    expect(estaExcluido(dia, 'merienda', id('Huevo'))).toBe(true);
    expect(estaExcluido(dia, 'desayuno', id('Huevo'))).toBe(false);

    expect(
      alimentosDeComida(dia, MEALS[2], FOOD_CATALOG).some((f) => f.nombre === 'Huevo'),
    ).toBe(false);
    expect(
      alimentosDeComida(dia, MEALS[0], FOOD_CATALOG).some((f) => f.nombre === 'Huevo'),
    ).toBe(true);
  });

  it('volver a pulsar repone el alimento', () => {
    let dia = { ...DIA, despensa: alternarExclusion(DIA, 'merienda', id('Huevo')) };
    dia = { ...dia, despensa: alternarExclusion(dia, 'merienda', id('Huevo')) };
    expect(estaExcluido(dia, 'merienda', id('Huevo'))).toBe(false);
  });

  it('se puede añadir un alimento a una comida donde no estaba sugerido', () => {
    // Las lentejas no están sugeridas para el desayuno
    const patata = id('Lentejas crudas');
    expect(
      alimentosDeComida(DIA, MEALS[0], FOOD_CATALOG).some((f) => f.id === patata),
    ).toBe(false);

    const dia = { ...DIA, despensa: anadirAlimento(DIA, 'desayuno', patata) };
    expect(
      alimentosDeComida(dia, MEALS[0], FOOD_CATALOG).some((f) => f.id === patata),
    ).toBe(true);
    // Y sigue sin aparecer en la merienda.
    expect(
      alimentosDeComida(dia, MEALS[2], FOOD_CATALOG).some((f) => f.id === patata),
    ).toBe(false);
  });

  it('una selección explícita sustituye al catálogo entero', () => {
    const dia = {
      ...DIA,
      despensa: {
        desayuno: { seleccion: [id('Huevo'), id('Clara de huevo'), id('Avena copos')] },
      },
    };
    const lista = alimentosDeComida(dia, MEALS[0], FOOD_CATALOG);
    expect(lista.map((f) => f.nombre).sort()).toEqual(['Avena copos', 'Clara de huevo', 'Huevo']);
  });

  it('quitar dentro de una selección explícita la reduce', () => {
    const dia = {
      ...DIA,
      despensa: { desayuno: { seleccion: [id('Huevo'), id('Avena copos')] } },
    };
    const despensa = alternarExclusion(dia, 'desayuno', id('Avena copos'));
    expect(despensa.desayuno.seleccion).toEqual([id('Huevo')]);
  });

  it('la lista global antigua se sigue respetando', () => {
    const dia = { ...DIA, alimentosExcluidos: [id('Huevo')] };
    expect(
      alimentosDeComida(dia, MEALS[0], FOOD_CATALOG).some((f) => f.nombre === 'Huevo'),
    ).toBe(false);
  });
});

// ─────────────────────────── ACEITE DE COCCIÓN

describe('Aceite de cocción reservado', () => {
  it('se reserva una porción en comida y cena', () => {
    expect(reservaAceite(DIA, MEALS[1])).toBe(1);
    expect(reservaAceite(DIA, MEALS[3])).toBe(1);
  });

  it('no se reserva en desayuno ni merienda', () => {
    expect(reservaAceite(DIA, MEALS[0])).toBe(0);
    expect(reservaAceite(DIA, MEALS[2])).toBe(0);
  });

  it('la nutricionista puede cambiar la reserva por comida', () => {
    const dia = { ...DIA, aceiteCoccion: { desayuno: 1, comida: 0 } };
    expect(reservaAceite(dia, MEALS[0])).toBe(1);
    expect(reservaAceite(dia, MEALS[1])).toBe(0);
  });

  it('nunca reserva más grasa de la pautada', () => {
    const dia = { ...DIA, aceiteCoccion: { merienda: 5 } };
    expect(reservaAceite(dia, MEALS[2])).toBe(1); // sólo hay 1 pautada
  });

  it('sin grasa pautada no hay reserva', () => {
    const dia = { ...DIA, grid: { ...DIA.grid, comida: { proteicos_magros: 5 } } };
    expect(reservaAceite(dia, MEALS[1])).toBe(0);
  });

  it('el resto de la grasa queda a elección del cliente', () => {
    const { reparto, reserva } = repartoElegible(DIA, MEALS[1]);
    expect(reserva).toBe(1);
    expect(reparto.grasas).toBe(2); // 3 pautadas − 1 de aceite
    expect(reparto.proteicos_magros).toBe(5); // el resto no se toca
  });

  it('si toda la grasa es aceite, no queda nada que elegir', () => {
    const dia = { ...DIA, grid: { ...DIA.grid, cena: { grasas: 1, almidones: 2 } } };
    const { reparto, reserva } = repartoElegible(dia, MEALS[3]);
    expect(reserva).toBe(1);
    expect(reparto.grasas).toBeUndefined();
  });

  it('la nota dice los gramos y la medida casera', () => {
    expect(notaAceite(FOOD_CATALOG, 1)).toBe('Aceite de cocción: 5 g (1 cdta)');
    expect(notaAceite(FOOD_CATALOG, 2)).toBe('Aceite de cocción: 10 g (2 cdtas)');
    expect(notaAceite(FOOD_CATALOG, 0)).toBeUndefined();
  });

  it('el aceite reservado sigue contando como grasa pautada', () => {
    const g = EXCHANGE_GROUPS.grasas;
    expect(g.grasa).toBe(5);
    const { reparto, reserva } = repartoElegible(DIA, MEALS[1]);
    expect((reparto.grasas ?? 0) + reserva).toBe(DIA.grid.comida!.grasas);
  });
});

// ─────────────────────────── COMBINACIONES GUARDADAS

describe('Las combinaciones de la nutricionista mandan', () => {
  const DESAYUNO: Meal = MEALS[0];
  const base: DayType = {
    ...DIA,
    grid: { ...DIA.grid, desayuno: { almidones: 1, fruta: 1, proteicos_magros: 2 } },
  };

  it('sin nada guardado se usan las propuestas', () => {
    const cols = columnasDeComida(base, DESAYUNO, FOOD_CATALOG);
    const carbo = cols.find((c) => c.bucket === 'carbohidrato')!;
    expect(carbo.propias).toBe(false);
    expect(carbo.opciones.length).toBeGreaterThan(0);
  });

  it('al guardar una, el cliente ve sólo esa', () => {
    const mia: CombinacionGuardada = {
      id: 'cb1',
      bucket: 'carbohidrato',
      items: [
        { foodId: id('Avena copos'), porciones: 1 },
        { foodId: id('Plátano'), porciones: 1 },
      ],
    };
    const dia = { ...base, combinaciones: guardarCombinacion(base, 'desayuno', mia) };
    const carbo = columnasDeComida(dia, DESAYUNO, FOOD_CATALOG).find(
      (c) => c.bucket === 'carbohidrato',
    )!;

    expect(carbo.propias).toBe(true);
    expect(carbo.opciones).toHaveLength(1);
    expect(carbo.opciones[0].texto).toMatch(/avena/i);
    expect(carbo.opciones[0].texto).toMatch(/pl[áa]tano/i);
  });

  it('guardar en un macro no afecta a los demás', () => {
    const mia: CombinacionGuardada = {
      id: 'cb1',
      bucket: 'carbohidrato',
      items: [
        { foodId: id('Avena copos'), porciones: 1 },
        { foodId: id('Plátano'), porciones: 1 },
      ],
    };
    const dia = { ...base, combinaciones: guardarCombinacion(base, 'desayuno', mia) };
    const prot = columnasDeComida(dia, DESAYUNO, FOOD_CATALOG).find(
      (c) => c.bucket === 'proteina',
    )!;
    expect(prot.propias).toBe(false);
  });

  it('la combinación guardada trae los gramos escalados', () => {
    const mia: CombinacionGuardada = {
      id: 'cb2',
      bucket: 'proteina',
      items: [{ foodId: id('Clara de huevo'), porciones: 2 }],
    };
    const o = materializar(mia, FOOD_CATALOG)!;
    expect(o.items[0].gramos).toBe(130);
  });

  it('quitar la última devuelve las propuestas', () => {
    const mia: CombinacionGuardada = {
      id: 'cb1',
      bucket: 'carbohidrato',
      items: [
        { foodId: id('Avena copos'), porciones: 1 },
        { foodId: id('Plátano'), porciones: 1 },
      ],
    };
    let dia = { ...base, combinaciones: guardarCombinacion(base, 'desayuno', mia) };
    dia = { ...dia, combinaciones: quitarCombinacion(dia, 'desayuno', 'cb1') };
    const carbo = columnasDeComida(dia, DESAYUNO, FOOD_CATALOG).find(
      (c) => c.bucket === 'carbohidrato',
    )!;
    expect(carbo.propias).toBe(false);
  });

  it('una propuesta se convierte en guardable sin perder nada', () => {
    const cols = columnasDeComida(base, DESAYUNO, FOOD_CATALOG);
    const propuesta = cols.find((c) => c.bucket === 'carbohidrato')!.opciones[0];
    const guardada = desdeOpcion(propuesta);
    const vuelta = materializar(guardada, FOOD_CATALOG)!;
    expect(vuelta.texto).toBe(propuesta.texto);
  });
});

// ─────────────────────────── TEXTO Y DUPLICADOS

describe('El texto no repite el nombre del alimento', () => {
  it('"2 huevos" no se convierte en "2 huevos de huevo entero"', () => {
    expect(etiquetaItem('2 huevos', 'Huevo')).toBe('2 huevos');
    expect(etiquetaItem('1 huevo', 'Huevo')).toBe('1 huevo');
  });

  it('conserva el complemento cuando aclara de qué es', () => {
    expect(etiquetaItem('2 claras', 'Clara de huevo')).toBe('2 claras de huevo');
    expect(etiquetaItem('4 claras', 'Clara de huevo')).toBe('4 claras de huevo');
  });

  it('cuando la medida no nombra el alimento, lo añade', () => {
    expect(etiquetaItem('1/4 taza', 'Avena')).toBe('1/4 taza de avena');
    expect(etiquetaItem('2 lonchas', 'Jamón York')).toBe('2 lonchas de jamón york');
  });

  it('funciona sin tildes y con nombres compuestos', () => {
    expect(etiquetaItem('1 plátano', 'Plátano')).toBe('1 plátano');
    expect(etiquetaItem('1 unidad', 'Manzana')).toBe('1 unidad de manzana');
  });

  it('la línea completa lleva los gramos', () => {
    const huevo = FOOD_CATALOG.find((f) => f.nombre === 'Huevo')!;
    const item = {
      foodId: huevo.id,
      nombre: huevo.nombre,
      grupo: huevo.grupo!,
      intercambios: 2,
      gramos: 120,
      unidad: 'g',
      medida: '2 huevos',
    };
    expect(textoItem(item)).toBe('2 huevos (120 g)');
  });
});

describe('Un alimento repetido se suma en vez de duplicarse', () => {
  it('dos veces huevo son 2 porciones, no dos líneas', () => {
    let items: { foodId: string; porciones: number }[] = [];
    items = sumarItem(items, id('Huevo'));
    items = sumarItem(items, id('Huevo'));
    expect(items).toHaveLength(1);
    expect(items[0].porciones).toBe(2);
  });

  it('alimentos distintos siguen en líneas distintas', () => {
    let items: { foodId: string; porciones: number }[] = [];
    items = sumarItem(items, id('Huevo'));
    items = sumarItem(items, id('Clara de huevo'));
    expect(items).toHaveLength(2);
  });

  it('al materializar se ve "2 huevos (120 g)", no dos líneas de 60 g', () => {
    const combo: CombinacionGuardada = {
      id: 'c1',
      bucket: 'proteina',
      items: [
        { foodId: id('Huevo'), porciones: 1 },
        { foodId: id('Huevo'), porciones: 1 },
        { foodId: id('Clara de huevo'), porciones: 1 },
      ],
    };
    const o = materializar(combo, FOOD_CATALOG)!;
    expect(o.items).toHaveLength(2);
    expect(o.items[0].intercambios).toBe(2);
    expect(o.texto).toMatch(/^2 huevos \(110 g\)/);
  });

  it('fusionar respeta las medias porciones', () => {
    const out = fusionarItems([
      { foodId: 'a', porciones: 0.5 },
      { foodId: 'a', porciones: 1 },
    ]);
    expect(out).toEqual([{ foodId: 'a', porciones: 1.5 }]);
  });
});

/**
 * MEDIO GRAMO DE GRASA NO ES PASARSE
 *
 * El techo de los proteicos se mide en gramos de grasa, y ahí un margen del
 * 2 % no significa nada: con un lácteo proteico (0 g) y dos magros (0,5 g cada
 * uno) el techo es 1 g y el 2 % son dos centésimas. Cambiar el lácteo por otro
 * magro —los mismos 7 g de proteína, y la app ya los da por intercambiables—
 * sumaba medio gramo y bloqueaba la combinación entera.
 */
describe('El margen de grasa', () => {
  const objetivo = (counts: ExchangeCounts) => objetivoDeBucket(counts, 'proteina')!;

  it('deja pasar el medio gramo de cambiar un lácteo por un magro', () => {
    // Pautado: 1 lácteo proteico (0 g) + 2 magros (1 g) → techo 1 g.
    const o = objetivo({ lacteos_proteicos: 1, proteicos_magros: 2 });
    const f = o.familias[0];
    expect(f.topeMaximo).toBeCloseTo(1, 4);

    // Servido: 3 magros → 1,5 g. Medio gramo de más, y entra.
    expect(costeDeFamilia('proteicos', { proteicos_magros: 3 })).toBeCloseTo(1.5, 4);
    expect(techoDeFamilia('proteicos', f.topeMaximo)).toBeGreaterThanOrEqual(1.5);
  });

  /**
   * El margen tiene que quedarse por debajo de 1,5 g, que es lo que cuesta
   * subir una porción de magro a semigraso. Si lo pasara, se colaría un salto
   * de nivel entero y con él las calorías de la comida.
   */
  it('pero no llega a permitir subir una porción de nivel', () => {
    const o = objetivo({ proteicos_magros: 4 }); // techo 2 g
    const techo = techoDeFamilia('proteicos', o.familias[0].topeMaximo);
    // 3 magros + 1 semigraso son 3,5 g: un salto de nivel, y se queda fuera.
    expect(costeDeFamilia('proteicos', { proteicos_magros: 3, proteicos_semigrasos: 1 }))
      .toBeCloseTo(3.5, 4);
    expect(techo).toBeLessThan(3.5);
  });

  /**
   * Lo que de verdad importa sigue fuera: un huevo entero donde había claras
   * son 4,5 g de grasa por porción, y eso no puede colarse en silencio.
   */
  it('pero no deja colar un salto de nivel de verdad', () => {
    const o = objetivo({ proteicos_magros: 3 }); // techo 1,5 g
    const techo = techoDeFamilia('proteicos', o.familias[0].topeMaximo);
    // Tres grasos son 15 g: ni de lejos.
    expect(costeDeFamilia('proteicos', { proteicos_grasos: 3 })).toBeCloseTo(15, 4);
    expect(techo).toBeLessThan(15);
  });

  it('y en las familias que van por calorías no cambia nada', () => {
    // 2 almidones son 140 kcal; el margen sigue siendo sólo el 2 %.
    const o = objetivoDeBucket({ almidones: 2 }, 'carbohidrato')!;
    const techo = techoDeFamilia('almidones', o.familias[0].topeMaximo);
    expect(techo).toBeCloseTo(o.familias[0].topeMaximo * 1.02, 2);
  });
});
