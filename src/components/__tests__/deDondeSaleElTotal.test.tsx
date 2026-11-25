// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PlanSchemaTable } from '../phase2/PlanSchemaTable';
import { bucketExchanges, deDondeSale, gridTotals } from '../../utils/exchanges';
import type { DayType } from '../../types/plan';

afterEach(cleanup);

/**
 * «PUSE 5 PROTEÍNAS Y ME APARECEN 6»
 *
 * Las dos pantallas cuentan bien, pero cuentan cosas distintas: «cálculo
 * plan» reparte **por subgrupo** y el esquema de entrega suma **por macro**.
 * Al macro de proteína entran también los lácteos proteicos y las legumbres,
 * que cuentan en hidrato y en proteína a la vez porque sus 7 g lo son igual
 * que los de un proteico magro.
 *
 * El 6 es correcto y el 5 también. Lo que faltaba era decir cuál se está
 * contestando: un total que no cuadra con lo que acabas de escribir no se lee
 * como otra cuenta, se lee como un error.
 */

/** Lo que pautó: 5 proteicos magros repartidos, y una ración de legumbres. */
const CON_LEGUMBRE: DayType = {
  id: 'dt',
  nombre: 'base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 3 },
  ],
  grid: {
    desayuno: { proteicos_magros: 2, almidones: 2 },
    comida: { proteicos_magros: 3, legumbres: 1 },
  },
  notas: {},
} as DayType;

describe('De dónde sale el total de proteína', () => {
  it('la legumbre también es proteína: 5 pautadas salen 6', () => {
    const totales = bucketExchanges(gridTotals(CON_LEGUMBRE.grid, CON_LEGUMBRE.meals));
    expect(totales.proteina).toBe(6);
  });

  /* En el orden del catálogo, que es el mismo de todas las demás pantallas. */
  it('y se dice de dónde sale', () => {
    render(<PlanSchemaTable dayType={CON_LEGUMBRE} />);
    expect(screen.getByText(/1 legumbres \+ 5 proteicos magros/)).toBeTruthy();
  });

  /* También en el hidrato, que es donde la legumbre cuenta «de verdad». */
  it('y lo mismo en el hidrato', () => {
    render(<PlanSchemaTable dayType={CON_LEGUMBRE} />);
    expect(screen.getByText(/2 almidones \+ 1 legumbres/)).toBeTruthy();
  });

  /* Con un solo subgrupo detrás, el número ya se explica solo. */
  it('con un solo subgrupo no se desglosa nada', () => {
    const simple = {
      ...CON_LEGUMBRE,
      grid: { desayuno: { proteicos_magros: 5 }, comida: {} },
    } as DayType;
    render(<PlanSchemaTable dayType={simple} />);
    expect(screen.queryByText(/proteicos magros \+/)).toBeNull();
  });

  /* Un lácteo proteico es proteína: es el otro caso que descuadra la cuenta. */
  it('el lácteo proteico también suma en proteína', () => {
    const conYogur = {
      ...CON_LEGUMBRE,
      grid: { desayuno: { lacteos_proteicos: 1 }, comida: { proteicos_magros: 5 } },
    } as DayType;
    render(<PlanSchemaTable dayType={conYogur} />);
    expect(screen.getByText(/1 lácteos proteicos \+ 5 proteicos magros/)).toBeTruthy();
  });
});

describe('El desglose, sin pantalla', () => {
  it('lista los subgrupos que suman a ese macro', () => {
    const partes = deDondeSale({ proteicos_magros: 5, legumbres: 1, almidones: 2 }, 'proteina');
    expect(partes.map((p) => p.grupo)).toEqual(['legumbres', 'proteicos_magros']);
  });

  /* La verdura no cuenta: es ilimitada y no gasta. */
  it('y deja fuera lo ilimitado', () => {
    expect(deDondeSale({ verduras: 3, almidones: 2 }, 'carbohidrato').map((p) => p.grupo)).toEqual(
      ['almidones'],
    );
  });
});
