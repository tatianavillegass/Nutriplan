// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ResumenTab } from '../client/ResumenTab';
import { RecursosTab } from '../client/RecursosTab';
import { registroVacio } from '../../types/diary';
import { recursosVisibles, recursoUtil } from '../../types/recursos';
import type { Client } from '../../types/client';
import type { DayType } from '../../types/plan';
import type { Medicion } from '../../types/anthropometry';
import type { RegistroDia } from '../../types/diary';
import type { Recurso } from '../../types/recursos';

afterEach(cleanup);

const CLIENTE = {
  id: 'cl1',
  nombre: 'Catalina',
  sexo: 'mujer',
  fechaNacimiento: '1990-05-01',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
} as unknown as Client;

const DIA: DayType = {
  id: 'dt',
  nombre: 'Día base',
  proteinaGkg: 2,
  hcGkg: 3,
  meals: [
    { id: 'desayuno', nombre: 'Desayuno', slot: 'desayuno', orden: 1 },
    { id: 'cena', nombre: 'Cena', slot: 'cena', orden: 2 },
  ],
  grid: { desayuno: { almidones: 2 }, cena: { proteicos_magros: 3 } },
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

const medicion = (fecha: string, peso: number): Medicion => ({
  id: `m_${fecha}`,
  clientId: 'cl1',
  fecha,
  peso,
  talla: 165,
  pliegues: { triceps: 15, subscapular: 12, supraespinal: 10, abdominal: 18, muslo: 20, medial_pierna: 12 },
  perimetros: {},
  diametros: {},
});

const pintar = (props: Partial<Parameters<typeof ResumenTab>[0]> = {}) =>
  render(
    <ResumenTab
      client={CLIENTE}
      dayTypes={[DIA]}
      registros={[]}
      mediciones={[]}
      fecha="2026-08-14"
      {...props}
    />,
  );

/**
 * EL RESUMEN DE LA CLIENTA
 *
 * Lo que mira cuando no está comiendo. A propósito no lleva un porcentaje de
 * adherencia ni una nota del día: el número que resume «qué tal lo haces»
 * invita a puntuarse, y eso no enseña a comer mejor.
 */
describe('Composición corporal', () => {
  it('enseña el peso de la última medición', () => {
    pintar({ mediciones: [medicion('2026-07-01', 68), medicion('2026-08-01', 66.5)] });
    // Los decimales van con coma, que es como se escriben aquí.
    expect(screen.getByText('66,5')).toBeTruthy();
  });

  it('y cuánto ha cambiado desde la anterior', () => {
    pintar({ mediciones: [medicion('2026-07-01', 68), medicion('2026-08-01', 66.5)] });
    expect(screen.getByText(/1,5 kg desde la anterior/)).toBeTruthy();
  });

  it('con una sola medición no inventa un cambio', () => {
    pintar({ mediciones: [medicion('2026-08-01', 66.5)] });
    expect(screen.queryByText(/desde la anterior/)).toBeNull();
  });

  /**
   * Esto es de la antropometría de consulta. Quien no ha pasado por consulta
   * —una participante del reto— no tiene ninguno de estos datos, y lo único
   * que salía era el peso, que ya está arriba en «Tus medidas». Dos veces el
   * mismo número no informa el doble: hace dudar de cuál es el bueno.
   */
  it('sin composición que enseñar, el apartado no sale', () => {
    pintar();
    expect(screen.queryByText('Tu composición')).toBeNull();
  });

  it('avisa de que un salto suelto no significa nada', () => {
    pintar({ mediciones: [medicion('2026-08-01', 66.5)] });
    expect(screen.getByText(/la dirección de varias/i)).toBeTruthy();
  });
});

describe('La racha', () => {
  it('cuenta los días cerrados seguidos', () => {
    pintar({
      registros: [
        dia('2026-08-12', ['desayuno', 'cena']),
        dia('2026-08-13', ['desayuno', 'cena']),
        dia('2026-08-14', ['desayuno', 'cena']),
      ],
    });
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText(/días seguidos/)).toBeTruthy();
  });

  it('con el día a medias no riñe, dice que se suma al cerrarlo', () => {
    pintar({ registros: [dia('2026-08-13', ['desayuno', 'cena']), dia('2026-08-14', ['desayuno'])] });
    expect(screen.getByText(/se suma en cuanto lo cierres/i)).toBeTruthy();
  });

  it('desde cero, invita a empezar hoy', () => {
    pintar();
    expect(screen.getByText(/Hoy puedes empezar/i)).toBeTruthy();
  });
});

describe('Comidas fuera', () => {
  it('las cuenta y las pinta en círculos', () => {
    const { container } = pintar({
      registros: [dia('2026-08-02', [], { cena: {} }), dia('2026-08-11', [], { desayuno: {} })],
    });
    expect(screen.getByText('2 comidas fuera')).toBeTruthy();
    // Ocho huecos como mínimo: dos por semana es lo corriente.
    expect(container.querySelectorAll('span[aria-hidden]').length).toBeGreaterThanOrEqual(8);
  });

  it('sólo las de este mes', () => {
    pintar({ registros: [dia('2026-07-30', [], { cena: {} })] });
    expect(screen.getByText('Ninguna todavía')).toBeTruthy();
  });

  it('sin medirlas ni restarlas de nada', () => {
    pintar({ registros: [dia('2026-08-02', [], { cena: {} })] });
    expect(screen.getByText(/No se miden ni restan de nada/i)).toBeTruthy();
    expect(screen.queryByText(/kcal/i)).toBeNull();
  });

  it('la nota que escribió sale, que es el material de consulta', () => {
    pintar({ registros: [dia('2026-08-02', [], { cena: { nota: 'Boda de mi prima' } })] });
    expect(screen.getByText(/Boda de mi prima/)).toBeTruthy();
  });
});

/**
 * RECURSOS
 *
 * Se escriben una vez y los ven todas. Aquí no hay nada que marcar.
 */
describe('Recursos', () => {
  const recurso = (id: string, titulo: string, orden: number): Recurso => ({
    id,
    titulo,
    descripcion: 'Para cuando no tienes báscula',
    orden,
    createdAt: '2026-08-01',
  });

  it('se ven en el orden que puso la nutricionista', () => {
    render(
      <RecursosTab
        recursos={[recurso('b', 'Productos recomendados', 1), recurso('a', 'Guía de raciones', 0)]}
      />,
    );
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titulos).toEqual(['Guía de raciones', 'Productos recomendados']);
  });

  it('el enlace se abre fuera y sin arrastrar la sesión', () => {
    render(
      <RecursosTab recursos={[{ ...recurso('a', 'Guía', 0), url: 'https://ejemplo.com' }]} />,
    );
    const enlace = screen.getByRole('link');
    expect(enlace.getAttribute('target')).toBe('_blank');
    expect(enlace.getAttribute('rel')).toContain('noopener');
  });

  it('sin recursos, se explica que todavía no hay nada', () => {
    render(<RecursosTab recursos={[]} />);
    expect(screen.getByText(/todavía no ha dejado nada/i)).toBeTruthy();
  });

  it('un recurso necesita título y algo más', () => {
    expect(recursoUtil({ titulo: 'Guía' })).toBe(false);
    expect(recursoUtil({ titulo: '', descripcion: 'algo' })).toBe(false);
    expect(recursoUtil({ titulo: 'Guía', url: 'https://x.com' })).toBe(true);
    expect(recursoUtil({ titulo: 'Guía', imagen: 'data:image/png;base64,x' })).toBe(true);
  });

  it('el orden empata por fecha, no se queda al azar', () => {
    const a = { ...recurso('a', 'Primero', 0), createdAt: '2026-01-01' };
    const b = { ...recurso('b', 'Segundo', 0), createdAt: '2026-02-01' };
    expect(recursosVisibles([b, a]).map((r) => r.id)).toEqual(['a', 'b']);
  });
});
