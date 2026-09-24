import { describe, it, expect } from 'vitest';
import { FOOD_CATALOG } from '../../data/foodCatalog';

describe('Lo que se pesa va en gramos, no en mililitros', () => {
  /**
   * Del Excel venían marcados en ml unos cuantos sólidos —el chocolate, el
   * aguacate, la crema de cacahuete— y en el plan de la clienta salía «11 ml
   * de chocolate». El ml es de lo que se sirve en un vaso.
   */
  const porId = (id: string) => FOOD_CATALOG.find((f) => f.id === id)!;

  it('el chocolate se pesa', () => {
    for (const id of ['a-chocolate-85-cacao', 'a-chocolate-70-cacao']) {
      expect(porId(id).unidad ?? 'g').toBe('g');
      expect(porId(id).medida_casera).not.toMatch(/ml/);
    }
  });

  it('y el aguacate, la crema de cacahuete y el queso batido también', () => {
    for (const id of [
      'a-aguacate-hass-maduro',
      'a-crema-de-cacahuete-natural',
      'a-queso-fresco-batido-0',
    ]) {
      expect(porId(id).unidad ?? 'g').toBe('g');
    }
  });

  it('las bebidas sí siguen en ml: eso se sirve, no se pesa', () => {
    expect(porId('a-leche-entera').unidad).toBe('ml');
    expect(porId('a-zumo-de-naranja-natural').unidad).toBe('ml');
  });
});
