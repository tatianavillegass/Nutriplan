import { describe, it, expect } from 'vitest';
import { FOOD_CATALOG } from '../../data/foodCatalog';
import { calcularPorcion } from '../portions';
import { exchangesToMacros } from '../exchanges';
import { EXCHANGE_GROUPS, EXCHANGE_GROUP_LIST } from '../../data/exchangeGroups';
import { recetasDeComida } from '../../types/plan';
import { gramosPorIntercambio } from '../recipeComposition';

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Réplica de la búsqueda del FoodPicker, para poder probarla sin interfaz. */
function buscar(q: string) {
  const t = norm(q.trim());
  if (!t) return [];
  return FOOD_CATALOG.map((f) => {
    const n = norm(f.nombre);
    if (n.startsWith(t)) return { f, p: 0 };
    if (n.split(/[\s,()]+/).some((x) => x.startsWith(t))) return { f, p: 1 };
    if (n.includes(t)) return { f, p: 2 };
    return null;
  })
    .filter(Boolean)
    .sort((a, b) => a!.p - b!.p || a!.f.nombre.localeCompare(b!.f.nombre))
    .map((x) => x!.f);
}

describe('Búsqueda de alimentos por texto', () => {
  it('escribir "pollo" devuelve todos los cortes, no sólo la pechuga', () => {
    const r = buscar('pollo').map((f) => f.nombre);
    expect(r.length).toBeGreaterThanOrEqual(3);
    expect(r.join(' ')).toMatch(/pechuga de pollo/i);
    expect(r.join(' ')).toMatch(/muslo de pollo/i);
    // Y "muslo" encuentra también el contramuslo, que no lleva la palabra pollo.
    expect(buscar('muslo').map((f) => f.nombre).join(' ')).toMatch(/contramuslo/i);
  });

  it('los cortes tienen subgrupos distintos según su grasa', () => {
    const porNombre = (n: string) => FOOD_CATALOG.find((f) => f.nombre === n)!;
    expect(porNombre('Pechuga de pollo cruda').grupo).toBe('proteicos_magros');
    expect(porNombre('Contramuslo deshuesado crudo').grupo).toBe('proteicos_semigrasos');
    expect(porNombre('Huevo').grupo).toBe('proteicos_grasos');
  });

  it('encuentra sin tildes y buscando por el final del nombre', () => {
    expect(buscar('platano').map((f) => f.nombre)).toContain('Plátano');
    expect(buscar('arandano').map((f) => f.nombre)).toContain('Arándanos');
  });

  it('la coincidencia por el principio va antes que la del medio', () => {
    const r = buscar('pavo');
    expect(r[0].nombre.toLowerCase().startsWith('pavo')).toBe(true);
  });

  it('un término inexistente no devuelve nada', () => {
    expect(buscar('zzzz')).toHaveLength(0);
  });
});

describe('Frutas una a una, no una porción genérica', () => {
  const frutas = FOOD_CATALOG.filter((f) => f.grupo === 'fruta');

  it('hay una lista amplia de frutas concretas', () => {
    expect(frutas.length).toBeGreaterThanOrEqual(20);
  });

  it('ya no existe la porción genérica de fruta', () => {
    expect(FOOD_CATALOG.some((f) => f.id === 'c-fruta-porcion')).toBe(false);
  });

  it('cada fruta tiene su propio gramaje: 100 g de plátano no son 100 g de arándano', () => {
    const platano = frutas.find((f) => f.nombre === 'Plátano')!;
    const arandano = frutas.find((f) => f.nombre === 'Arándanos')!;
    const sandia = frutas.find((f) => f.nombre === 'Sandía')!;
    // 15 g de HC de cada una: cuanto menos azúcar, más gramos de porción
    expect(platano.gramos).toBe(65);
    expect(arandano.gramos).toBe(125);
    expect(sandia.gramos).toBe(200);
    expect(new Set(frutas.map((f) => f.gramos)).size).toBeGreaterThan(8);
  });

  it('todas aportan los ~15 g de carbohidrato de su intercambio', () => {
    for (const f of frutas) {
      const aporta = (f.nutrientes!.hc * f.gramos) / 100;
      expect(aporta).toBeGreaterThan(13);
      expect(aporta).toBeLessThan(17.5);
    }
  });
});

describe('Integridad del catálogo ampliado', () => {
  it('no hay identificadores repetidos', () => {
    const ids = FOOD_CATALOG.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('no hay nombres repetidos', () => {
    const nombres = FOOD_CATALOG.map((f) => f.nombre.toLowerCase());
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it('todos llevan nutrientes por 100 g y una porción coherente', () => {
    for (const f of FOOD_CATALOG) {
      expect(f.nutrientes, f.nombre).toBeTruthy();
      expect(f.gramos, f.nombre).toBeGreaterThan(0);
      if (!f.grupo) continue; // libres: no se pautan por intercambios
      const p = calcularPorcion(f.nutrientes!, f.grupo);
      expect(p, f.nombre).toBeTruthy();
    }
  });

  it('la porción guardada es la que sale de los nutrientes', () => {
    // Toda la base viene migrada, así que no hay porciones heredadas sueltas.
    const desviados = FOOD_CATALOG.filter((f) => {
      if (!f.grupo || EXCHANGE_GROUPS[f.grupo].ilimitado) return false;
      // Los compuestos no siguen esta regla: su medida no es un intercambio de
      // un grupo, sino el reparto entero que declara `equivale`.
      if (f.equivale) return false;
      const p = calcularPorcion(f.nutrientes!, f.grupo);
      return p ? Math.abs(p.gramos - f.gramos) / f.gramos > 0.02 : false;
    }).map((f) => f.nombre);
    expect(desviados).toEqual([]);
  });

  it('cada subgrupo que se pauta tiene al menos un alimento', () => {
    // Las verduras son ilimitadas y los azúcares no vienen en la hoja.
    for (const g of EXCHANGE_GROUP_LIST.filter(
      (x) => !x.ilimitado && x.id !== 'azucares',
    )) {
      expect(FOOD_CATALOG.some((f) => f.grupo === g.id), g.nombre).toBe(true);
    }
  });

  it('el bucket de cada alimento se deduce de su subgrupo', () => {
    for (const f of FOOD_CATALOG) {
      if (!f.grupo) continue;
      const esperado = EXCHANGE_GROUPS[f.grupo].bucket;
      if (f.bucket) expect(f.bucket).toBe(esperado);
    }
  });

  it('los lácteos cuentan como proteína y se separan por su grasa', () => {
    const lacteos = FOOD_CATALOG.filter((f) => f.grupo?.startsWith('lacteos'));
    expect(lacteos.length).toBeGreaterThan(4);
    for (const g of ['lacteos_desnatados', 'lacteos_semi', 'lacteos_enteros', 'lacteos_proteicos'] as const) {
      expect(EXCHANGE_GROUPS[g].bucket).toBe('proteina');
    }
    expect(exchangesToMacros({ lacteos_desnatados: 1 }).grasa).toBe(0);
    expect(exchangesToMacros({ lacteos_enteros: 1 }).grasa).toBe(8);
  });

  it('las bebidas y el alcohol entran como libres, sin intercambio', () => {
    const libres = FOOD_CATALOG.filter((f) => !f.grupo);
    expect(libres.length).toBeGreaterThan(20);
    expect(libres.map((f) => f.nombre)).toContain('Cerveza');
    expect(libres.map((f) => f.nombre)).toContain('Vino tinto');
    // No aparecen para pautar porciones.
    for (const f of libres) expect(gramosPorIntercambio(f), f.nombre).toBeUndefined();
  });
});

describe('Fase 1 — varias recetas por comida', () => {
  it('lee la lista de recetas de una comida', () => {
    expect(recetasDeComida({ comida: ['a', 'b', 'c'] }, 'comida')).toEqual(['a', 'b', 'c']);
  });

  it('sigue leyendo los planes antiguos que guardaban una sola receta', () => {
    expect(recetasDeComida({ comida: 'a' }, 'comida')).toEqual(['a']);
  });

  it('una comida sin recetas devuelve lista vacía', () => {
    expect(recetasDeComida({}, 'cena')).toEqual([]);
    expect(recetasDeComida(undefined, 'cena')).toEqual([]);
  });

  it('descarta los huecos vacíos que dejaban las versiones anteriores', () => {
    expect(recetasDeComida({ comida: '' }, 'comida')).toEqual([]);
    expect(recetasDeComida({ comida: ['a', ''] }, 'comida')).toEqual(['a']);
  });
});
