import { describe, it, expect } from 'vitest';
import { calcularRacha, diaAnterior, diaCerrado, inicioDeMes, libresDesde } from '../racha';
import { registroVacio } from '../../types/diary';
import type { RegistroDia } from '../../types/diary';
import type { DayType } from '../../types/plan';

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'comida', nombre: 'Comida', slot: 'comida', orden: 2 },
    { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 3 },
  ],
  grid: {
    desayuno: { almidones: 2 },
    comida: { proteicos_magros: 4 },
    cena: { proteicos_magros: 3 },
    // Una merienda sin nada pautado no cuenta: no existe ese día.
    merienda: {},
  },
  notas: {},
};

const dia = (
  fecha: string,
  cumplidas: string[] = [],
  libres: Record<string, { nota?: string }> = {},
): RegistroDia => ({
  ...registroVacio('cl1', fecha, `rg_${fecha}`),
  dayTypeId: 'dt',
  cumplidas,
  libres,
});

const TODAS = ['desayuno', 'comida', 'cena'];

describe('Cuándo se da un día por cerrado', () => {
  it('con las tres comidas marcadas', () => {
    expect(diaCerrado(dia('2026-08-14', TODAS), DIA)).toBe(true);
  });

  /**
   * Una cena fuera no rompe nada. Si veinte días se van al traste por salir a
   * cenar, lo que enseña la app es que salir a cenar es un fallo.
   */
  it('una comida libre cierra igual que una hecha', () => {
    expect(diaCerrado(dia('2026-08-14', ['desayuno', 'comida'], { cena: {} }), DIA)).toBe(true);
  });

  it('si falta una, no', () => {
    expect(diaCerrado(dia('2026-08-14', ['desayuno', 'comida']), DIA)).toBe(false);
  });

  it('las comidas sin nada pautado no se piden', () => {
    // La merienda está en la grilla pero vacía: no cuenta para cerrar el día.
    expect(diaCerrado(dia('2026-08-14', TODAS), DIA)).toBe(true);
  });

  it('un día sin registro no está cerrado', () => {
    expect(diaCerrado(undefined, DIA)).toBe(false);
  });
});

describe('La racha cuenta hacia atrás desde hoy', () => {
  it('tres días seguidos son tres', () => {
    const rs = ['2026-08-12', '2026-08-13', '2026-08-14'].map((f) => dia(f, TODAS));
    expect(calcularRacha(rs, [DIA], '2026-08-14').actual).toBe(3);
  });

  /**
   * A las once de la mañana el día todavía está por hacer. Si eso rompiera la
   * racha, cada mañana empezaría a cero.
   */
  it('que hoy esté a medias no rompe la de ayer', () => {
    const rs = [dia('2026-08-13', TODAS), dia('2026-08-14', ['desayuno'])];
    const r = calcularRacha(rs, [DIA], '2026-08-14');
    expect(r.actual).toBe(1);
    expect(r.hoyCerrado).toBe(false);
  });

  it('y al cerrarlo se suma', () => {
    const rs = [dia('2026-08-13', TODAS), dia('2026-08-14', TODAS)];
    const r = calcularRacha(rs, [DIA], '2026-08-14');
    expect(r.actual).toBe(2);
    expect(r.hoyCerrado).toBe(true);
  });

  it('un día sin marcar nada la corta', () => {
    const rs = [dia('2026-08-11', TODAS), dia('2026-08-13', TODAS), dia('2026-08-14', TODAS)];
    // Falta el 12 entero: la racha viva son el 13 y el 14.
    expect(calcularRacha(rs, [DIA], '2026-08-14').actual).toBe(2);
  });

  it('guarda la mejor aunque ya se haya perdido', () => {
    const rs = [
      ...['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04'].map((f) => dia(f, TODAS)),
      dia('2026-08-14', TODAS),
    ];
    const r = calcularRacha(rs, [DIA], '2026-08-14');
    expect(r.actual).toBe(1);
    expect(r.mejor).toBe(4);
  });

  it('sin nada marcado nunca, cero y sin reventar', () => {
    expect(calcularRacha([], [DIA], '2026-08-14')).toEqual({
      actual: 0,
      mejor: 0,
      hoyCerrado: false,
    });
  });
});

describe('Las comidas fuera se cuentan, no se juzgan', () => {
  const rs = [
    dia('2026-07-30', TODAS, { cena: {} }),
    dia('2026-08-02', ['desayuno'], { comida: { nota: 'Boda' }, cena: {} }),
    dia('2026-08-11', TODAS, { comida: {} }),
  ];

  it('sólo las del periodo que se mira', () => {
    expect(libresDesde(rs, '2026-08-01').total).toBe(3);
  });

  it('con su fecha y su nota, para hablarlo en consulta', () => {
    const { detalle } = libresDesde(rs, '2026-08-01');
    expect(detalle[0].fecha).toBe('2026-08-11');
    expect(detalle.find((d) => d.nota === 'Boda')).toBeTruthy();
  });

  it('el mes empieza el uno', () => {
    expect(inicioDeMes('2026-08-14')).toBe('2026-08-01');
  });
});

describe('Restar un día no se lía con los meses', () => {
  it('el primero de mes va al último del anterior', () => {
    expect(diaAnterior('2026-08-01')).toBe('2026-07-31');
    expect(diaAnterior('2026-01-01')).toBe('2025-12-31');
    expect(diaAnterior('2028-03-01')).toBe('2028-02-29');
  });
});
