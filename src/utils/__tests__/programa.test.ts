import { describe, it, expect } from 'vitest';
import { comoVaElMes, dondeVa, felicitacionDeMes } from '../programa';
import { registroVacio } from '../../types/diary';
import type { RegistroDia } from '../../types/diary';
import type { DayType } from '../../types/plan';

/**
 * UN RETO CONSIGO MISMA
 *
 * RESET 90 es consulta individual con principio y final. Se cuenta por meses
 * porque «día 1 de 90» dice *te quedan 89*, que es lo contrario de lo que hace
 * falta al empezar.
 */

const PROGRAMA = { nombre: 'RESET 90', inicio: '2026-08-01', dias: 90 };

const DIA: DayType = {
  id: 'd1',
  nombre: 'Base',
  meals: [{ id: 'm1', nombre: 'Comida', slot: 'comida', orden: 1 }],
  grid: { m1: { proteicos_magros: 3 } },
} as unknown as DayType;

const cerrado = (fecha: string): RegistroDia => ({
  ...registroVacio('c1', fecha, `r_${fecha}`),
  dayTypeId: DIA.id,
  cumplidas: ['m1'],
});

describe('Por dónde va', () => {
  it('el primer día es el día 1 del mes 1', () => {
    const d = dondeVa(PROGRAMA, '2026-08-01')!;
    expect(d.dia).toBe(1);
    expect(d.mes).toBe(1);
    expect(d.diaDelMes).toBe(1);
    expect(d.meses).toBe(3);
    // El primer día no estrena mes: sería felicitarla por presentarse.
    expect(d.estrenaMes).toBe(false);
  });

  it('a los 30 días empieza el mes 2, y eso sí se dice', () => {
    const d = dondeVa(PROGRAMA, '2026-08-31')!;
    expect(d.mes).toBe(2);
    expect(d.diaDelMes).toBe(1);
    expect(d.estrenaMes).toBe(true);
  });

  it('la tira es de ese mes: treinta casillas, no noventa', () => {
    expect(dondeVa(PROGRAMA, '2026-08-10')!.diasDelMes).toHaveLength(30);
  });

  it('antes de empezar no se enseña nada', () => {
    expect(dondeVa(PROGRAMA, '2026-07-31')).toBeUndefined();
  });

  it('y al pasarse de los días, el programa se cierra', () => {
    expect(dondeVa(PROGRAMA, '2026-11-30')!.terminado).toBe(true);
  });
});

/**
 * Los días que aún no han llegado no cuentan como fallados: marcarle en rojo
 * el futuro es la app riñendo por algo que todavía no ha pasado.
 */
describe('Cómo va el mes', () => {
  it('cuenta sólo los días que ya han pasado', () => {
    const donde = dondeVa(PROGRAMA, '2026-08-03')!;
    const mes = comoVaElMes(donde, [cerrado('2026-08-01')], '2026-08-03', () => DIA);

    expect(mes.posibles).toBe(3);
    expect(mes.cerrados).toBe(1);
  });
});

/**
 * El mensaje celebra lo que hizo. Si felicitara por kilos, el mes que no baje
 * se leería como un suspenso.
 */
describe('La felicitación de mes', () => {
  it('habla de días cerrados y de su racha, no de peso', () => {
    const texto = felicitacionDeMes(2, 24, 11);
    expect(texto).toContain('24 días');
    expect(texto).toContain('11');
    expect(texto).not.toMatch(/kilo|peso|adelgaz/i);
  });

  it('y sin días cerrados no inventa un logro', () => {
    expect(felicitacionDeMes(2, 0, 0)).toBe('Empiezas el mes 2.');
  });
});
