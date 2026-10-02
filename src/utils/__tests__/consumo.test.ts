import { describe, it, expect } from 'vitest';
import {
  medicionesSinFotos,
  registrosSinFotos,
  sinLaFoto,
  sinLaImagen,
} from '../sinFotos';
import type { RegistroDia } from '../../types/diary';
import type { Medicion } from '../../types/anthropometry';

/**
 * LO QUE SE COMIÓ EL SERVIDOR Y LA MEMORIA DEL NAVEGADOR
 *
 * Las fotos de progreso viven dentro del registro del día, en texto. Cada
 * sesión son medio mega, y cuarenta clientas durante medio año son cientos.
 * Eso viajaba en cada consulta y se convertía a texto en cada cambio para
 * guardarlo en el navegador —donde no cabía, así que el guardado fallaba en
 * silencio y el trabajo se tiraba—. Es lo que acabó dejando la pestaña sin
 * memoria.
 *
 * Al navegador va todo menos las fotos. En el servidor y en la copia de
 * seguridad siguen enteras.
 */

const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRg';

const registro = (p: Partial<RegistroDia> = {}): RegistroDia =>
  ({
    id: 'r1',
    clientId: 'c1',
    fecha: '2026-09-01',
    cumplidas: ['desayuno'],
    ...p,
  }) as unknown as RegistroDia;

describe('Las fotos no van a la copia del navegador', () => {
  it('se quitan las de las medidas y se queda todo lo demás', () => {
    const [r] = registrosSinFotos([
      registro({
        medidas: { peso: 68, cintura: 74, fotos: { frente: FOTO, perfil: FOTO } },
      } as Partial<RegistroDia>),
    ]);
    expect(r.medidas?.fotos).toBeUndefined();
    expect(r.medidas?.peso).toBe(68);
    expect(r.medidas?.cintura).toBe(74);
    expect(r.cumplidas).toEqual(['desayuno']);
  });

  it('y la de la preparación del reto', () => {
    const [r] = registrosSinFotos([
      registro({ preparacion: { hechos: ['medidas'], foto: FOTO } } as Partial<RegistroDia>),
    ]);
    expect(r.preparacion?.foto).toBeUndefined();
    expect(r.preparacion?.hechos).toEqual(['medidas']);
  });

  /* Sin fotos no se copia nada: el día se devuelve tal cual, que con siete mil
     registros copiarlos todos por si acaso también cuesta. */
  it('un día sin fotos se devuelve tal cual', () => {
    const uno = registro();
    expect(registrosSinFotos([uno])[0]).toBe(uno);
  });

  it('las mediciones pierden sus fotos y conservan los pliegues', () => {
    const m = {
      id: 'm1',
      clientId: 'c1',
      fecha: '2026-09-01',
      peso: 68,
      pliegues: { triceps: 12 },
      foto: FOTO,
      fotos: { frente: FOTO },
    } as unknown as Medicion;
    const [sin] = medicionesSinFotos([m]);
    expect(sin.foto).toBeUndefined();
    expect(sin.fotos).toBeUndefined();
    expect(sin.peso).toBe(68);
    expect(sin.pliegues).toEqual({ triceps: 12 });
  });

  /* Las de receta y las de recurso sólo estorban si siguen en texto: cuando ya
     son un enlace al almacén pesan nada y se quedan. */
  it('una receta con la foto ya en el almacén la conserva', () => {
    const r = { id: 'r', foto_url: 'https://x.supabase.co/a.jpg' };
    expect(sinLaFoto([r])[0].foto_url).toBe('https://x.supabase.co/a.jpg');
  });

  it('y una que siga en texto la pierde', () => {
    expect(sinLaFoto([{ id: 'r', foto_url: FOTO }])[0].foto_url).toBeUndefined();
  });

  it('lo mismo con la imagen de un recurso', () => {
    expect(sinLaImagen([{ id: 'x', imagen: FOTO }])[0].imagen).toBeUndefined();
    expect(sinLaImagen([{ id: 'x', imagen: 'https://x/y.jpg' }])[0].imagen).toBe(
      'https://x/y.jpg',
    );
  });

  it('y no se toca el original: lo de memoria sigue con sus fotos', () => {
    const con = registro({
      medidas: { peso: 68, fotos: { frente: FOTO } },
    } as Partial<RegistroDia>);
    registrosSinFotos([con]);
    expect(con.medidas?.fotos?.frente).toBe(FOTO);
  });
});
