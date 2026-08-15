import { describe, it, expect } from 'vitest';
import {
  avisosDeSolicitud,
  hayQueHablarlo,
  solicitudCompleta,
  type Solicitud,
} from '../../types/solicitud';
import { clienteDeSolicitud, comidasDelPlan, notasDeSolicitud } from '../altaDeSolicitud';

const SOLICITUD = (patch: Partial<Solicitud> = {}): Solicitud => ({
  id: 'sl1',
  retoId: 'rt1',
  creada: '2026-08-20T10:00:00.000Z',
  nombre: 'Marta Ruiz',
  email: 'marta@correo.com',
  fechaNacimiento: '1992-03-15',
  sexo: 'mujer',
  peso: 68,
  altura: 165,
  comidasDia: 4,
  activityFactorId: 'sed_3',
  objetivo: 'perder_peso',
  embarazoLactancia: false,
  antecedenteTca: false,
  ...patch,
});

/**
 * SÓLO SE PIDE LO QUE HACE FALTA PARA CALCULAR
 *
 * Cada campo obligatorio de más es gente que abandona el formulario. Todo lo
 * demás —cintura, % de grasa, teléfono, alergias— es opcional.
 */
describe('Cuándo se puede enviar', () => {
  it('con lo imprescindible, sí', () => {
    expect(solicitudCompleta(SOLICITUD())).toBe(true);
  });

  it('sin peso o sin altura, no hay nada que calcular', () => {
    expect(solicitudCompleta({ ...SOLICITUD(), peso: undefined })).toBe(false);
    expect(solicitudCompleta({ ...SOLICITUD(), altura: undefined })).toBe(false);
  });

  it('un correo sin arroba no es un correo', () => {
    expect(solicitudCompleta({ ...SOLICITUD(), email: 'marta.correo.com' })).toBe(false);
  });

  it('lo opcional se queda opcional', () => {
    const s = SOLICITUD();
    delete s.cintura;
    delete s.grasaPct;
    delete s.telefono;
    expect(solicitudCompleta(s)).toBe(true);
  });

  it('un peso imposible no pasa', () => {
    expect(solicitudCompleta({ ...SOLICITUD(), peso: 8 })).toBe(false);
    expect(solicitudCompleta({ ...SOLICITUD(), altura: 16 })).toBe(false);
  });
});

/**
 * EL PASO MANUAL EXISTE POR ESTO
 *
 * Un reto de 30 días no le va bien a todo el mundo, y hay pesos con los que
 * los g/kg de peso total se disparan.
 */
describe('Lo que hay que mirar antes de dar de alta', () => {
  it('una ficha corriente no dice nada', () => {
    expect(avisosDeSolicitud(SOLICITUD())).toEqual([]);
    expect(hayQueHablarlo(SOLICITUD())).toBe(false);
  });

  it('un antecedente de trastorno alimentario para el proceso', () => {
    const s = SOLICITUD({ antecedenteTca: true });
    expect(hayQueHablarlo(s)).toBe(true);
    expect(avisosDeSolicitud(s)[0].texto).toMatch(/Háblalo antes/);
  });

  it('el embarazo o la lactancia, también', () => {
    expect(hayQueHablarlo(SOLICITUD({ embarazoLactancia: true }))).toBe(true);
  });

  /** Ámbar, no rojo: no hay que hablar nada, sólo calcular distinto. */
  it('un peso alto avisa, pero no para', () => {
    const s = SOLICITUD({ peso: 96, altura: 160 });
    const avisos = avisosDeSolicitud(s);
    expect(avisos.some((a) => a.texto.includes('peso ajustado'))).toBe(true);
    expect(hayQueHablarlo(s)).toBe(false);
  });

  it('un peso muy bajo sí merece una conversación', () => {
    expect(hayQueHablarlo(SOLICITUD({ peso: 44, altura: 170 }))).toBe(true);
  });

  it('lo que haya escrito de salud sale tal cual', () => {
    const avisos = avisosDeSolicitud(SOLICITUD({ salud: 'Hipotiroidismo' }));
    expect(avisos.some((a) => a.texto.includes('Hipotiroidismo'))).toBe(true);
  });
});

/**
 * Cuántas veces come al día decide las comidas de su plan. Al bajar se quitan
 * los picoteos y se quedan las grandes: quien come dos veces al día hace
 * desayuno y comida, no desayuno y recena.
 */
describe('Las comidas del plan', () => {
  it('cuatro comidas son las de siempre', () => {
    expect(comidasDelPlan(4).map((m) => m.id)).toEqual([
      'desayuno',
      'comida',
      'merienda',
      'cena',
    ]);
  });

  it('con dos se quedan las dos grandes', () => {
    expect(comidasDelPlan(2).map((m) => m.id)).toEqual(['desayuno', 'comida']);
  });

  it('con seis entra hasta la recena', () => {
    expect(comidasDelPlan(6)).toHaveLength(6);
  });

  it('un número raro no rompe nada', () => {
    expect(comidasDelPlan(99)).toHaveLength(6);
    expect(comidasDelPlan(0)).toHaveLength(2);
  });

  it('el orden se renumera para que no queden huecos', () => {
    expect(comidasDelPlan(3).map((m) => m.orden)).toEqual([1, 2, 3]);
  });
});

describe('De solicitud a ficha de clienta', () => {
  it('se traslada lo que hace falta para calcular', () => {
    const c = clienteDeSolicitud(SOLICITUD());
    expect(c.nombre).toBe('Marta Ruiz');
    expect(c.email).toBe('marta@correo.com');
    expect(c.peso).toBe(68);
    expect(c.fechaNacimiento).toBe('1992-03-15');
  });

  it('el correo se guarda en minúsculas: es lo que le da acceso', () => {
    expect(clienteDeSolicitud(SOLICITUD({ email: 'Marta@Correo.COM' })).email).toBe(
      'marta@correo.com',
    );
  });

  /**
   * Con un peso alto, los g/kg sobre el total darían una proteína que no
   * necesita nadie. Se deja puesto el peso ajustado desde el minuto uno.
   */
  it('con peso alto, el plan se calcula sobre peso ajustado', () => {
    expect(clienteDeSolicitud(SOLICITUD({ peso: 96, altura: 160 })).basePeso).toBe('ajustado');
  });

  it('con el peso en su sitio, sobre el total', () => {
    expect(clienteDeSolicitud(SOLICITUD()).basePeso).toBe('total');
  });

  it('lo que escribió no se tira: va a sus notas', () => {
    const notas = notasDeSolicitud(
      SOLICITUD({ salud: 'Migrañas', noComo: 'Pescado', cintura: 78, comidasDia: 3 }),
    );
    expect(notas).toMatch(/Migrañas/);
    expect(notas).toMatch(/Pescado/);
    expect(notas).toMatch(/78 cm/);
    expect(notas).toMatch(/3 veces al día/);
  });

  it('y lo que marcó en el cribado queda apuntado', () => {
    const notas = notasDeSolicitud(SOLICITUD({ antecedenteTca: true }));
    expect(notas).toMatch(/antecedente de trastorno/i);
  });
});
