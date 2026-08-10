// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  aplicarPlantilla,
  aplicarPlantillaDia,
  borrarPlantilla,
  borrarPlantillaDia,
  cobertura,
  desdeDayType,
  guardarPlantilla,
  guardarPlantillaDia,
  guardarPlantillas,
  guardarPlantillasDia,
  leerPlantillas,
  leerPlantillasDia,
  resolverPlantilla,
  totalAlimentos,
  type PlantillaDia,
} from '../plantillas';
import { alimentosDeComida } from '../pantry';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import { PLANTILLAS_INICIALES } from '../../data/plantillasIniciales';
import { EXCHANGE_GROUPS } from '../../data/exchangeGroups';
import type { DayType, Meal } from '../../types/plan';

const DESAYUNO: Meal = { id: 'm1', nombre: 'Desayuno', slot: 'desayuno', orden: 1 };
const COMIDA: Meal = { id: 'm2', nombre: 'Comida', slot: 'comida', orden: 2 };
const CENA: Meal = { id: 'm3', nombre: 'Cena', slot: 'cena', orden: 3 };
const IDS = ['a-queso-fresco-batido-0', 'a-huevo', 'a-avena-copos'];

const dia = (despensa?: DayType['despensa']): DayType => ({
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [DESAYUNO, COMIDA, CENA],
  grid: { m1: { proteicos_magros: 2, almidones: 2 } },
  despensa,
  notas: {},
});

describe('Plantillas de una comida', () => {
  beforeEach(() => {
    localStorage.clear();
    guardarPlantillas([]);
  });

  it('guarda con su comida y la recupera', () => {
    const lista = guardarPlantilla([], 'Desayuno de siempre', IDS, 'desayuno');
    expect(lista[0].foodIds).toEqual(IDS);
    expect(lista[0].slot).toBe('desayuno');
  });

  it('guardar con el mismo nombre reemplaza en vez de duplicar', () => {
    const uno = guardarPlantilla([], 'Desayuno', IDS);
    const dos = guardarPlantilla(uno, 'desayuno', ['a-huevo']);
    expect(dos).toHaveLength(1);
    expect(dos[0].foodIds).toEqual(['a-huevo']);
  });

  it('no guarda sin nombre ni vacías', () => {
    expect(guardarPlantilla([], '   ', IDS)).toHaveLength(0);
    expect(guardarPlantilla([], 'Vacía', [])).toHaveLength(0);
  });

  it('aplicarla sustituye la lista de la comida', () => {
    const [p] = guardarPlantilla([], 'Desayuno', IDS);
    expect(aplicarPlantilla({ seleccion: ['a-platano'] }, p).seleccion).toEqual(IDS);
  });

  it('con "sumar" se añade a lo que había, sin repetir', () => {
    const [p] = guardarPlantilla([], 'Desayuno', IDS);
    const d = aplicarPlantilla({ seleccion: ['a-huevo', 'a-platano'] }, p, true);
    expect(d.seleccion).toEqual(['a-huevo', 'a-platano', 'a-queso-fresco-batido-0', 'a-avena-copos']);
  });

  it('avisa de los alimentos que ya no existen', () => {
    const [p] = guardarPlantilla([], 'Vieja', [...IDS, 'a-inventado']);
    const r = resolverPlantilla(p, FOOD_CATALOG);
    expect(r.encontrados).toHaveLength(3);
    expect(r.perdidos).toBe(1);
  });

  it('borrar la quita del almacenamiento', () => {
    const lista = guardarPlantilla([], 'Desayuno', IDS);
    expect(borrarPlantilla(lista, lista[0].id)).toHaveLength(0);
    expect(leerPlantillas().find((p) => p.nombre === 'Desayuno')).toBeUndefined();
  });
});

describe('Plantillas de día completo', () => {
  beforeEach(() => {
    localStorage.clear();
    guardarPlantillasDia([]);
  });

  const PLANTILLA: PlantillaDia = {
    id: 'pd1',
    nombre: 'Día base',
    comidas: {
      desayuno: ['a-huevo', 'a-avena-copos'],
      cena: ['a-merluza-cruda', 'a-patata'],
    },
    createdAt: '2026-01-01',
  };

  it('rellena las comidas que casan por su tipo', () => {
    const d = aplicarPlantillaDia(dia(), PLANTILLA);
    expect(d.m1.seleccion).toEqual(['a-huevo', 'a-avena-copos']);
    expect(d.m3.seleccion).toEqual(['a-merluza-cruda', 'a-patata']);
  });

  it('las comidas que la plantilla no cubre se quedan como estaban', () => {
    const d = aplicarPlantillaDia(dia({ m2: { seleccion: ['a-pechuga-de-pollo-cruda'] } }), PLANTILLA);
    expect(d.m2.seleccion).toEqual(['a-pechuga-de-pollo-cruda']);
  });

  it('por defecto sustituye; con "sumar" añade', () => {
    const previo = dia({ m1: { seleccion: ['a-platano'] } });
    expect(aplicarPlantillaDia(previo, PLANTILLA).m1.seleccion).toEqual([
      'a-huevo',
      'a-avena-copos',
    ]);
    expect(aplicarPlantillaDia(previo, PLANTILLA, true).m1.seleccion).toEqual([
      'a-platano',
      'a-huevo',
      'a-avena-copos',
    ]);
  });

  it('dice cuántas comidas del día cubre', () => {
    expect(cobertura(dia(), PLANTILLA)).toBe(2);
    expect(totalAlimentos(PLANTILLA)).toBe(4);
  });

  it('el día montado se puede guardar como plantilla', () => {
    const montado = dia({
      m1: { seleccion: ['a-huevo'] },
      m3: { seleccion: ['a-merluza-cruda'] },
    });
    const comidas = desdeDayType(montado);
    expect(comidas).toEqual({ desayuno: ['a-huevo'], cena: ['a-merluza-cruda'] });

    const lista = guardarPlantillaDia([], 'Mi día', comidas);
    expect(lista).toHaveLength(1);
    expect(borrarPlantillaDia(lista, lista[0].id)).toHaveLength(0);
  });

  it('un día sin nada no se guarda como plantilla', () => {
    expect(guardarPlantillaDia([], 'Vacío', {})).toHaveLength(0);
  });

  it('aplicada, el cliente ve exactamente esos alimentos', () => {
    const d = aplicarPlantillaDia(dia(), PLANTILLA);
    const conDespensa = dia(d);
    const ofrecidos = alimentosDeComida(conDespensa, DESAYUNO, FOOD_CATALOG);
    expect(ofrecidos.map((f) => f.id)).toEqual(['a-huevo', 'a-avena-copos']);
  });
});

describe('Plantillas que vienen de fábrica', () => {
  beforeEach(() => localStorage.clear());

  it('la primera vez ya hay algo con lo que empezar', () => {
    expect(leerPlantillas().length).toBeGreaterThanOrEqual(5);
    expect(leerPlantillasDia().length).toBeGreaterThanOrEqual(1);
  });

  it('todos sus alimentos existen en el catálogo', () => {
    const ids = new Set(FOOD_CATALOG.map((f) => f.id));
    for (const p of PLANTILLAS_INICIALES.comidas) {
      for (const id of p.foodIds) expect(ids.has(id), `${p.nombre}: ${id}`).toBe(true);
    }
  });

  it('cada una cubre los tres macros: el cliente siempre puede completar', () => {
    for (const p of PLANTILLAS_INICIALES.comidas) {
      const buckets = new Set(
        p.foodIds
          .map((id) => FOOD_CATALOG.find((f) => f.id === id)?.grupo)
          .filter((g): g is NonNullable<typeof g> => !!g)
          .map((g) => EXCHANGE_GROUPS[g].bucket),
      );
      expect([...buckets].sort(), p.nombre).toEqual(['carbohidrato', 'grasa', 'proteina']);
    }
  });

  it('si las borras no vuelven a aparecer', () => {
    const lista = leerPlantillas();
    let quedan = lista;
    for (const p of lista) quedan = borrarPlantilla(quedan, p.id);
    expect(quedan).toHaveLength(0);
    expect(leerPlantillas()).toHaveLength(0);
  });
});
