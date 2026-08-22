import { describe, it, expect } from 'vitest';
import { checkInPendiente, checkInQueToca, comoVaCambiando } from '../checkin';
import { dondeVa } from '../programa';
import { registroVacio } from '../../types/diary';
import type { CheckIn, RegistroDia } from '../../types/diary';

/**
 * EL CHECK-IN DE CADA DOS SEMANAS
 *
 * Un mes es demasiado para enterarse de que algo no va: si el hambre se
 * disparó la segunda semana, saberlo el día 30 es tarde. Y cada dos semanas no
 * cansa.
 */

const PROGRAMA = { nombre: 'RESET 90', inicio: '2026-08-01', dias: 90 };

const respuestas = (n: number): CheckIn['respuestas'] => ({
  energia: n,
  digestion: n,
  sueno: n,
  hambre: n,
  antojos: n,
});

const conCheckIn = (fecha: string, numero: number, valor: number): RegistroDia => ({
  ...registroVacio('c1', fecha, `r_${fecha}`),
  checkins: [{ numero, fecha, respuestas: respuestas(valor) }],
});

describe('Cuándo toca', () => {
  it('el primero a las dos semanas, no antes', () => {
    expect(checkInQueToca(dondeVa(PROGRAMA, '2026-08-10'))).toBeUndefined();
    expect(checkInQueToca(dondeVa(PROGRAMA, '2026-08-14'))).toBe(1);
  });

  it('y el segundo a las cuatro', () => {
    expect(checkInQueToca(dondeVa(PROGRAMA, '2026-08-28'))).toBe(2);
  });

  /**
   * Se queda disponible hasta el siguiente: si abre la app el día 16, sigue
   * pudiendo contestarlo. Perseguir a alguien con una encuesta no funciona,
   * pero hacerla desaparecer por un día tampoco.
   */
  it('sigue disponible los días siguientes', () => {
    expect(checkInPendiente(dondeVa(PROGRAMA, '2026-08-17'), [])).toBe(1);
  });

  it('y deja de pedirse en cuanto lo contesta', () => {
    const registros = [conCheckIn('2026-08-14', 1, 4)];
    expect(checkInPendiente(dondeVa(PROGRAMA, '2026-08-17'), registros)).toBeUndefined();
    // Pero el de la quincena siguiente sí vuelve a salir.
    expect(checkInPendiente(dondeVa(PROGRAMA, '2026-08-28'), registros)).toBe(2);
  });

  it('cuando el programa termina, ya no se pregunta nada', () => {
    expect(checkInQueToca(dondeVa(PROGRAMA, '2026-12-01'))).toBeUndefined();
  });
});

/**
 * En consulta lo que importa no es el número suelto sino hacia dónde va: un 3
 * después de un 1 es una buena noticia y después de un 5 es una conversación.
 */
describe('Cómo va cambiando', () => {
  it('compara el último con el anterior', () => {
    const t = comoVaCambiando([
      conCheckIn('2026-08-14', 1, 2),
      conCheckIn('2026-08-28', 2, 4),
    ]);

    expect(t[0].ahora).toBe(4);
    expect(t[0].antes).toBe(2);
    expect(t[0].cambio).toBe('sube');
  });

  it('y con uno solo no se inventa una comparación', () => {
    const t = comoVaCambiando([conCheckIn('2026-08-14', 1, 3)]);
    expect(t[0].antes).toBeUndefined();
    expect(t[0].cambio).toBe('igual');
  });
});
