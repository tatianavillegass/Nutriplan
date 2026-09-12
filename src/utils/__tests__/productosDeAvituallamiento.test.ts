import { describe, it, expect } from 'vitest';
import { alimentosDeComida, esAvituallamiento } from '../pantry';
import { listaDeLaCompra } from '../listaCompra';
import type { Alimento } from '../../types/food';
import type { DayType, Meal, Plan } from '../../types/plan';
import type { MenuSemana } from '../../types/diary';

/**
 * LA MARCA DE «PRODUCTO DE AVITUALLAMIENTO»
 *
 * En vez de un grupo de intercambio nuevo —que tendría que traer su porción,
 * su equivalencia y una columna en el reparto vacía todos los días menos el de
 * la tirada larga— es una marca en la ficha del alimento. Un gel sigue siendo
 * azúcar; lo que cambia es dónde se come.
 */

const alimento = (p: Partial<Alimento> & { id: string; nombre: string }): Alimento =>
  ({
    grupo: 'azucares',
    medida_casera: '1 unidad',
    gramos: 50,
    intercambios: 2.5,
    nutrientes: { kcal: 100, hc: 50, proteina: 0, grasa: 0 },
    comidas_sugeridas: ['extra'],
    alergenos: [],
    apto: [],
    ...p,
  }) as unknown as Alimento;

/** Un gel: 1 unidad de 50 g con 25 g de hidrato. */
const GEL = alimento({
  id: 'gel',
  nombre: 'Gel energético',
  medida_casera: '1 gel',
  gramos: 50,
  nutrientes: { kcal: 100, hc: 25, proteina: 0, grasa: 0 },
  avituallamiento: true,
});

/** La isotónica: no es una pieza («1 bidón» no es «1 unidad») y se cuenta igual. */
const BIDON = alimento({
  id: 'bidon',
  nombre: 'Bebida isotónica',
  medida_casera: '1 bidón (500 ml)',
  gramos: 500,
  unidad: 'ml',
  intercambios: 3,
  nutrientes: { kcal: 24, hc: 6, proteina: 0, grasa: 0 },
  avituallamiento: true,
});

const TOSTADA = alimento({
  id: 'tostada',
  nombre: 'Pan tostado',
  grupo: 'almidones',
  medida_casera: '1 rebanada',
  gramos: 20,
  intercambios: 1,
  comidas_sugeridas: ['extra', 'merienda'],
  nutrientes: { kcal: 70, hc: 15, proteina: 2, grasa: 0.5 },
});

const FOODS = [GEL, BIDON, TOSTADA];

const COMIDA = { id: 'intra', nombre: 'Intra-entreno', slot: 'extra', orden: 1 } as Meal;

const DIA = (avit?: DayType['avituallamientos']): DayType =>
  ({
    id: 'tirada',
    nombre: 'Tirada larga',
    grid: { intra: { azucares: 9 } },
    avituallamientos: avit,
  }) as unknown as DayType;

describe('La despensa de un avituallamiento', () => {
  it('ofrece los productos marcados y no lo que se merienda', () => {
    const dayType = DIA({ intra: { modo: 'hora', porHora: 60, horas: 1.5 } });
    expect(esAvituallamiento(dayType, 'intra')).toBe(true);

    const ofrecidos = alimentosDeComida(dayType, COMIDA, FOODS).map((f) => f.id);
    expect(ofrecidos).toContain('gel');
    expect(ofrecidos).toContain('bidon');
    expect(ofrecidos).not.toContain('tostada');
  });

  /** Sin avituallamiento es una comida normal y manda la comida sugerida. */
  it('y en una comida normal no cambia nada', () => {
    const ofrecidos = alimentosDeComida(DIA(), COMIDA, FOODS).map((f) => f.id);
    expect(ofrecidos).toContain('tostada');
  });
});

/**
 * En la mochila no caben «60 g de azúcares»: caben seis geles. Y la isotónica
 * no tenía ni subgrupo, así que antes no se podía ni poner en la despensa.
 */
describe('La lista de la compra', () => {
  const plan = { dayTypes: [] } as unknown as Plan;

  const menu = (dayType: DayType, dias: string[]): MenuSemana =>
    ({
      inicio: '2026-09-07',
      dias: Object.fromEntries(dias.map((d) => [d, { dayTypeId: dayType.id, comidas: {} }])),
    }) as unknown as MenuSemana;

  it('cuenta los geles de la pauta en unidades, no en gramos', () => {
    const dayType = DIA({
      intra: {
        modo: 'hora',
        porHora: 60,
        horas: 1.5,
        pauta: [
          { minuto: 20, foodId: 'gel', unidades: 1 },
          { minuto: 40, foodId: 'gel', unidades: 1 },
          { minuto: 60, foodId: 'bidon', unidades: 1 },
        ],
      },
    });
    const lista = listaDeLaCompra(
      menu(dayType, ['2026-09-12', '2026-09-13']),
      { ...plan, dayTypes: [dayType] },
      [],
      FOODS,
    );

    // Dos salidas × dos geles.
    const geles = lista.lineas.find((l) => l.foodId === 'gel');
    expect(geles?.piezas).toBe(4);
    expect(geles?.medida).toBe('gel');

    // Y dos bidones, que no son «1000 ml».
    const bidones = lista.lineas.find((l) => l.foodId === 'bidon');
    expect(bidones?.piezas).toBe(2);
    expect(bidones?.medida).toBe('bidón (500 ml)');
  });

  /**
   * En bici no se pauta el cuándo, así que no se sabe qué va a llevar: se le
   * recuerda que hay que avituallarse y no se inventa la compra.
   */
  it('sin reloj recuerda el avituallamiento pero no inventa qué comprar', () => {
    const dayType = DIA({ intra: { modo: 'total', gramos: 90 } });
    const lista = listaDeLaCompra(
      menu(dayType, ['2026-09-12']),
      { ...plan, dayTypes: [dayType] },
      [],
      FOODS,
    );

    const linea = lista.lineas.find((l) => l.nombre.startsWith('Avituallamiento'));
    expect(linea?.alGusto).toBe(true);
    expect(linea?.nombre).toContain('90 g');
    expect(lista.lineas.some((l) => l.foodId === 'gel')).toBe(false);
  });
});
