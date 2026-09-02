import { describe, it, expect } from 'vitest';
import {
  elegirOpcion,
  fijarAlimento,
  limpiarBucket,
  marcadoDeBucket,
  marcarAlimento,
  opcionElegida,
  seleccionPorBucket,
  seleccionPorGrupo,
} from '../marcado';
import {
  balanceGrasa,
  balanceSubgrupo,
  balanceSubgruposDeBucket,
  esCambioALaBaja,
} from '../dailyBudget';
import { generarCombinaciones, objetivoDeBucket } from '../combos';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import type { DayType, Meal } from '../../types/plan';
import type { PorcionesMarcadas } from '../../types/diary';

const MEALS: Meal[] = [
  { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
  { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 2 },
  { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 3 },
];

/** Desayuno con 2 semigrasos + 1 magro, como el documento de referencia. */
const DIA: DayType = {
  id: 'dt',
  nombre: 'Día entreno',
  proteinaGkg: 2,
  hcGkg: 4,
  meals: MEALS,
  grid: {
    desayuno: { proteicos_semigrasos: 2, proteicos_magros: 1, almidones: 2, fruta: 1, grasas: 1 },
    comida: { proteicos_magros: 5, almidones: 4, grasas: 2, verduras: 2 },
    cena: { proteicos_semigrasos: 2, almidones: 2, grasas: 1, verduras: 2 },
  },
  notas: {},
};

// En la hoja el huevo es proteico graso, así que el semigraso de
// referencia para estas pruebas es el contramuslo.
const semigraso = FOOD_CATALOG.find((f) => f.nombre === 'Contramuslo deshuesado crudo')!;
const clara = FOOD_CATALOG.find((f) => f.nombre === 'Clara de huevo')!;
const jamon = FOOD_CATALOG.find((f) => f.nombre === 'Jamón York')!;
const avena = FOOD_CATALOG.find((f) => f.nombre === 'Avena copos')!;
const pollo = FOOD_CATALOG.find((f) => f.nombre === 'Pechuga de pollo cruda')!;

describe('Marcado de porciones', () => {
  it('suma y resta sin bajar de cero', () => {
    let p: PorcionesMarcadas = {};
    p = marcarAlimento(p, 'comida', pollo.id, 3);
    expect(p.comida[pollo.id]).toBe(3);
    p = marcarAlimento(p, 'comida', pollo.id, -1);
    expect(p.comida[pollo.id]).toBe(2);
    p = marcarAlimento(p, 'comida', pollo.id, -5);
    expect(p.comida[pollo.id]).toBeUndefined();
  });

  it('devuelve objetos nuevos, no muta el anterior', () => {
    const antes: PorcionesMarcadas = { comida: { [pollo.id]: 1 } };
    const despues = marcarAlimento(antes, 'comida', pollo.id, 1);
    expect(antes.comida[pollo.id]).toBe(1);
    expect(despues.comida[pollo.id]).toBe(2);
  });

  it('agrega por macro y por subgrupo', () => {
    const p: PorcionesMarcadas = {
      desayuno: { [semigraso.id]: 2, [jamon.id]: 1, [avena.id]: 2 },
    };
    expect(seleccionPorBucket(p, FOOD_CATALOG).desayuno.proteina).toBe(3);
    expect(seleccionPorBucket(p, FOOD_CATALOG).desayuno.carbohidrato).toBe(2);

    const porGrupo = seleccionPorGrupo(p, FOOD_CATALOG).desayuno;
    expect(porGrupo.proteicos_semigrasos).toBe(2); // contramuslo
    expect(porGrupo.proteicos_magros).toBe(1); // jamón
  });

  it('limpiar un macro no toca los demás', () => {
    const p: PorcionesMarcadas = { desayuno: { [semigraso.id]: 2, [avena.id]: 2 } };
    const out = limpiarBucket(p, 'desayuno', 'proteina', FOOD_CATALOG);
    expect(out.desayuno[semigraso.id]).toBeUndefined();
    expect(out.desayuno[avena.id]).toBe(2);
  });
});

describe('Fase 2 — pulsar una opción completa', () => {
  const objetivo = objetivoDeBucket(DIA.grid.desayuno!, 'proteina')!;
  const despensa = ['Contramuslo deshuesado crudo', 'Clara de huevo', 'Jamón York'].map(
    (n) => FOOD_CATALOG.find((f) => f.nombre === n)!,
  );
  const col = { opciones: generarCombinaciones(objetivo, despensa, { limite: 6 }) };
  const opcion = col.opciones[0];

  it('marca de golpe todos los alimentos de la opción', () => {
    const p = elegirOpcion({}, 'desayuno', opcion, FOOD_CATALOG);
    for (const item of opcion.items) {
      expect(p.desayuno[item.foodId]).toBe(item.intercambios);
    }
    expect(opcionElegida(p, 'desayuno', opcion)).toBe(true);
  });

  it('cubre exactamente lo pautado de ese macro', () => {
    const p = elegirOpcion({}, 'desayuno', opcion, FOOD_CATALOG);
    expect(marcadoDeBucket(p, 'desayuno', 'proteina', FOOD_CATALOG)).toBe(3);
  });

  /**
   * ARREPENTIRSE ES NORMAL
   *
   * Antes, una vez marcada una opción algo tenía que quedar marcado sí o sí:
   * sólo se podía cambiar por otra. Y si te equivocaste de comida, o al final
   * no lo comiste, la única salida era dejar puesto algo que no era verdad.
   */
  it('volver a pulsarla la quita y la comida se queda en blanco', () => {
    let p = elegirOpcion({}, 'desayuno', opcion, FOOD_CATALOG);
    expect(opcionElegida(p, 'desayuno', opcion)).toBe(true);

    p = elegirOpcion(p, 'desayuno', opcion, FOOD_CATALOG);
    expect(opcionElegida(p, 'desayuno', opcion)).toBe(false);
    expect(marcadoDeBucket(p, 'desayuno', 'proteina', FOOD_CATALOG)).toBe(0);
  });

  /** Y quitarla no se lleva por delante lo que tenga marcado de otro macro. */
  it('y al quitarla no se toca lo de los demás macros', () => {
    const objCarbo = objetivoDeBucket(DIA.grid.desayuno!, 'carbohidrato')!;
    const carbo = generarCombinaciones(
      objCarbo,
      ['Avena copos', 'Plátano'].map((n) => FOOD_CATALOG.find((f) => f.nombre === n)!),
      { limite: 3 },
    )[0];

    let p: PorcionesMarcadas = elegirOpcion({}, 'desayuno', carbo, FOOD_CATALOG);
    p = elegirOpcion(p, 'desayuno', opcion, FOOD_CATALOG);
    p = elegirOpcion(p, 'desayuno', opcion, FOOD_CATALOG);

    expect(opcionElegida(p, 'desayuno', carbo)).toBe(true);
    expect(marcadoDeBucket(p, 'desayuno', 'proteina', FOOD_CATALOG)).toBe(0);
  });

  it('elegir otra opción del mismo macro sustituye a la anterior', () => {
    const otra = col.opciones[1];
    let p = elegirOpcion({}, 'desayuno', opcion, FOOD_CATALOG);
    p = elegirOpcion(p, 'desayuno', otra, FOOD_CATALOG);

    expect(opcionElegida(p, 'desayuno', otra)).toBe(true);
    expect(opcionElegida(p, 'desayuno', opcion)).toBe(false);
    // Sigue sin duplicar porciones.
    expect(marcadoDeBucket(p, 'desayuno', 'proteina', FOOD_CATALOG)).toBe(3);
  });

  it('elegir proteína no borra el carbohidrato ya elegido', () => {
    const objCarbo = objetivoDeBucket(DIA.grid.desayuno!, 'carbohidrato')!;
    const carbo = generarCombinaciones(
      objCarbo,
      ['Avena copos', 'Plátano'].map((n) => FOOD_CATALOG.find((f) => f.nombre === n)!),
      { limite: 3 },
    )[0];
    let p = elegirOpcion({}, 'desayuno', carbo, FOOD_CATALOG);
    p = elegirOpcion(p, 'desayuno', opcion, FOOD_CATALOG);
    expect(opcionElegida(p, 'desayuno', carbo)).toBe(true);
    expect(opcionElegida(p, 'desayuno', opcion)).toBe(true);
  });

  it('una opción a medias no cuenta como elegida', () => {
    const p = fijarAlimento({}, 'desayuno', opcion.items[0].foodId, opcion.items[0].intercambios);
    expect(opcionElegida(p, 'desayuno', opcion)).toBe(opcion.items.length === 1);
  });
});

describe('Fase 3 — avisos por subgrupo', () => {
  it('el caso del brief: 2 semigrasas pautadas y 3 marcadas', () => {
    const p: PorcionesMarcadas = { desayuno: { [semigraso.id]: 3 } };
    const porGrupo = seleccionPorGrupo(p, FOOD_CATALOG);
    const b = balanceSubgrupo(DIA, MEALS[0], 'proteicos_semigrasos', porGrupo);

    expect(b.pautadoComida).toBe(2);
    expect(b.pautadoDia).toBe(4); // 2 desayuno + 2 cena
    expect(b.elegidoComida).toBe(3);
    expect(b.estado).toBe('excedido');
    expect(b.mensaje).toContain('2 de proteicos semigrasos en esta comida');
    expect(b.mensaje).toContain('4 al día');
    expect(b.mensaje).toContain('queda 1 para el resto del día');
  });

  it('marcar justo lo pautado deja el subgrupo cerrado y sin aviso', () => {
    const p: PorcionesMarcadas = { desayuno: { [semigraso.id]: 2 } };
    const b = balanceSubgrupo(DIA, MEALS[0], 'proteicos_semigrasos', seleccionPorGrupo(p, FOOD_CATALOG));
    expect(b.estado).toBe('completo');
    expect(b.mensaje).toBeUndefined();
  });

  it('un subgrupo que no estaba pautado en esa comida avisa aparte', () => {
    const p: PorcionesMarcadas = { comida: { [semigraso.id]: 2 } };
    const b = balanceSubgrupo(DIA, MEALS[1], 'proteicos_semigrasos', seleccionPorGrupo(p, FOOD_CATALOG));
    expect(b.pautadoComida).toBe(0);
    expect(b.mensaje).toContain('no había proteicos semigrasos pautados');
  });

  it('pasarse del total del día pide compensar', () => {
    const p: PorcionesMarcadas = { desayuno: { [semigraso.id]: 3 }, cena: { [semigraso.id]: 3 } };
    const b = balanceSubgrupo(DIA, MEALS[0], 'proteicos_semigrasos', seleccionPorGrupo(p, FOOD_CATALOG));
    expect(b.estado).toBe('sin_margen');
    expect(b.mensaje).toContain('Te has pasado');
  });

  it('el desglose de un macro cubre todos sus subgrupos pautados', () => {
    const subs = balanceSubgruposDeBucket(DIA, MEALS[0], 'proteina', {});
    expect(subs.map((s) => s.grupo)).toEqual(['proteicos_magros', 'proteicos_semigrasos']);
  });

  it('incluye subgrupos marcados aunque no estuvieran pautados', () => {
    const p: PorcionesMarcadas = { comida: { [semigraso.id]: 1 } };
    const subs = balanceSubgruposDeBucket(DIA, MEALS[1], 'proteina', seleccionPorGrupo(p, FOOD_CATALOG));
    expect(subs.map((s) => s.grupo)).toContain('proteicos_semigrasos');
  });

  it('repartir bien entre magro y semigraso no dispara ningún aviso', () => {
    const p: PorcionesMarcadas = { desayuno: { [clara.id]: 1, [semigraso.id]: 2 } };
    const porGrupo = seleccionPorGrupo(p, FOOD_CATALOG);
    expect(balanceSubgrupo(DIA, MEALS[0], 'proteicos_semigrasos', porGrupo).estado).toBe('completo');
    expect(balanceSubgrupo(DIA, MEALS[0], 'proteicos_magros', porGrupo).estado).toBe('completo');
  });
});

/**
 * Un día donde la grasa del desayuno son frutos secos y nada más. El cliente
 * tiene que poder desayunar aceite o aguacate sin que le riñan: la misma
 * grasa, menos calorías.
 */
const DIA_NUECES: DayType = {
  ...DIA,
  grid: {
    desayuno: { proteicos_magros: 2, almidones: 2, frutos_secos: 1 },
    comida: { proteicos_magros: 5, almidones: 4, frutos_secos: 1, verduras: 2 },
    cena: { proteicos_magros: 2, almidones: 2, verduras: 2 },
  },
};

/** Y el contrario: pautado el aceite, elegidos los frutos secos. */
const DIA_ACEITE: DayType = {
  ...DIA,
  grid: {
    desayuno: { proteicos_magros: 2, almidones: 2, grasas: 1 },
    comida: { proteicos_magros: 5, almidones: 4, grasas: 2, verduras: 2 },
    cena: { proteicos_magros: 2, almidones: 2, verduras: 2 },
  },
};

describe('Cambiar de grasa dentro de la familia', () => {
  it('aceite donde estaban pautados los frutos secos: sin aviso', () => {
    // Las dos porciones aportan 5 g de grasa; las nueces además traen
    // hidratos y proteína, así que el aceite sale más barato.
    const b = balanceSubgrupo(DIA_NUECES, MEALS[0], 'grasas', { desayuno: { grasas: 1 } });
    expect(b.mensaje).toBeUndefined();
    expect(b.estado).toBe('completo');
  });

  it('aunque coja de más, sigue sin haber nada que avisar', () => {
    const b = balanceSubgrupo(DIA_NUECES, MEALS[0], 'grasas', { desayuno: { grasas: 3 } });
    expect(b.mensaje).toBeUndefined();
  });

  /**
   * FRUTOS SECOS DONDE HABÍA ACEITE: TAMPOCO SE AVISA
   *
   * Cuestan 14 kcal más por porción, pero llevan la misma grasa — y en esta
   * familia la regla es que manda la grasa, no las calorías, porque medirla en
   * calorías dejaba a las nueces siempre cortas.
   *
   * El aviso era además el equivocado: decía «grasas proteicas no entra en tu
   * plan de hoy» cada vez que la clienta cogía un puñado de almendras, aunque
   * tuviera grasas pautadas. Eso obligaba a pautar subgrupo por subgrupo sólo
   * para callarlo.
   */
  it('frutos secos donde había aceite: la grasa es la misma, no se avisa', () => {
    const b = balanceSubgrupo(DIA_ACEITE, MEALS[0], 'frutos_secos', {
      desayuno: { frutos_secos: 2 },
    });
    expect(b.mensaje).toBeUndefined();
  });

  it('esCambioALaBaja distingue en qué sentido va el cambio', () => {
    expect(esCambioALaBaja(DIA_NUECES, 'grasas')).toBe(true);
    expect(esCambioALaBaja(DIA_ACEITE, 'frutos_secos')).toBe(false);
    // Contra sí mismo siempre empata, y empatar es libre.
    expect(esCambioALaBaja(DIA_ACEITE, 'grasas')).toBe(true);
  });

  it('sin nada de grasa pautada en el día no hay contra qué comparar', () => {
    const sinGrasa: DayType = {
      ...DIA,
      grid: { desayuno: { proteicos_magros: 2, almidones: 2 }, comida: {}, cena: {} },
    };
    expect(esCambioALaBaja(sinGrasa, 'grasas')).toBe(false);
    // Y entonces sí se avisa: no entraba en el plan de hoy.
    const b = balanceSubgrupo(sinGrasa, MEALS[0], 'grasas', { desayuno: { grasas: 2 } });
    expect(b.mensaje).toContain('no entra en tu plan');
  });

  it('la proteína magra sigue siendo libre pase lo que pase', () => {
    const b = balanceSubgrupo(DIA_NUECES, MEALS[0], 'proteicos_magros', {
      desayuno: { proteicos_magros: 6 },
    });
    expect(b.mensaje).toBeUndefined();
  });
});

/**
 * UN SUBGRUPO QUE NO SE PAUTÓ NO ES UN AVISO
 *
 * La nutricionista pauta proteicos magros y grasos, y grasas a secas. Luego la
 * clienta desayuna un yogur proteico y unas almendras: las dos cosas cuadran el
 * macro, las dos estaban en su despensa, y las dos disparaban un «no entra en
 * tu plan de hoy». Para callarlo había que pautar subgrupo por subgrupo cada
 * comida, que es justo lo que la regla de los macros venía a evitar.
 *
 * Lo que sigue protegiendo el plan es el total del macro y, en la proteína, los
 * gramos de grasa del día.
 */
describe('Elegir un subgrupo que no estaba en la plantilla', () => {
  /** Pauta normal: proteína sin decir de dónde, grasas sin decir de cuáles. */
  const DIA_LLANO: DayType = {
    ...DIA,
    grid: {
      desayuno: { proteicos_magros: 2, almidones: 2, grasas: 1 },
      comida: { proteicos_magros: 4, almidones: 3, grasas: 2, verduras: 2 },
      cena: { proteicos_magros: 3, almidones: 2, verduras: 2 },
    },
  };

  it('el yogur proteico donde había pollo no dice nada', () => {
    const b = balanceSubgrupo(DIA_LLANO, MEALS[0], 'lacteos_proteicos', {
      desayuno: { lacteos_proteicos: 2 },
    });
    expect(b.mensaje).toBeUndefined();
  });

  it('las almendras donde había aceite tampoco', () => {
    const b = balanceSubgrupo(DIA_LLANO, MEALS[0], 'frutos_secos', {
      desayuno: { frutos_secos: 1 },
    });
    expect(b.mensaje).toBeUndefined();
  });

  it('pero un macro que no pautaste sí se dice', () => {
    // Ese día no hay ni una grasa en toda la plantilla.
    const sinGrasa: DayType = {
      ...DIA,
      grid: { desayuno: { proteicos_magros: 2, almidones: 2 }, comida: {}, cena: {} },
    };
    const b = balanceSubgrupo(sinGrasa, MEALS[0], 'frutos_secos', {
      desayuno: { frutos_secos: 1 },
    });
    expect(b.mensaje).toContain('no entra en tu plan');
  });

  it('y la grasa del día sigue vigilada: queso curado donde había pollo', () => {
    // 5 porciones de proteico graso son 40 g de grasa; lo pautado, 4,5.
    const g = balanceGrasa(DIA_LLANO, 'proteicos', {
      desayuno: { proteicos_grasos: 5 },
    });
    expect(g.mensaje).toBeTruthy();
  });
});
