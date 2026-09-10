import { describe, it, expect } from 'vitest';
import { destinoDelEnlace, urlLimpia, vieneDeUnEnlace } from '../recuperacion';

/**
 * EL ENLACE DE «SE ME OLVIDÓ LA CONTRASEÑA»
 *
 * Le llegaba el correo, pulsaba el enlace y la app no le enseñaba nunca dónde
 * escribir la contraseña nueva. La causa era la almohadilla: la app usa rutas
 * con almohadilla y el enlace volvía a `…/#/`, así que Supabase colgaba su
 * `?code=` DENTRO del ancla, donde el navegador no lo ve como un parámetro.
 */

const sitio = { origin: 'https://app.tatiana-villegas.com', pathname: '/' };

describe('A dónde vuelve el enlace', () => {
  it('a la raíz limpia, sin almohadilla', () => {
    expect(destinoDelEnlace(sitio)).toBe('https://app.tatiana-villegas.com/?recuperar=1');
  });

  /** Así es como se rompía: el `?code=` acababa dentro del ancla. */
  it('y ya no acaba en «#/», que era lo que se comía el código', () => {
    expect(destinoDelEnlace(sitio)).not.toContain('#');
  });
});

describe('Cuándo la app sabe que viene de un enlace', () => {
  it('por la marca que ponemos nosotros', () => {
    expect(vieneDeUnEnlace('https://app.tatiana-villegas.com/?recuperar=1&code=abc')).toBe(true);
  });

  /** Los correos ya enviados llevan el formato viejo y siguen valiendo. */
  it('y también con el formato viejo de Supabase', () => {
    expect(
      vieneDeUnEnlace('https://app.tatiana-villegas.com/#access_token=x&type=recovery'),
    ).toBe(true);
  });

  /**
   * Si Supabase se salta la dirección que le pedimos —porque no está en su
   * lista de permitidas— la manda al dominio del proyecto con el código pero
   * sin nuestra marca. Ahí se le puede decir qué ha pasado en vez de dejarla
   * en un formulario de entrar que no le va a aceptar nada.
   */
  it('y con el código a secas, aunque se pierda la marca', () => {
    expect(vieneDeUnEnlace('https://nutriplan-fawn-three.vercel.app/?code=abc')).toBe(true);
  });

  it('pero no en una visita normal', () => {
    expect(vieneDeUnEnlace('https://app.tatiana-villegas.com/#/clientes')).toBe(false);
    expect(vieneDeUnEnlace('https://app.tatiana-villegas.com/')).toBe(false);
  });

  /** Alguien que llega desde el enlace de un reto no está cambiando nada. */
  it('ni con otros parámetros por medio', () => {
    expect(vieneDeUnEnlace('https://app.tatiana-villegas.com/?pago=ok#/apuntarse/r1')).toBe(
      false,
    );
  });

  it('y una URL rota no rompe nada', () => {
    expect(vieneDeUnEnlace('no soy una url')).toBe(false);
  });
});

/**
 * Un código se canjea UNA vez. Dejándolo escrito en la barra de direcciones,
 * recargar la página falla con un error en inglés que no dice nada.
 */
describe('La URL se limpia en cuanto se ha usado', () => {
  it('se van el código y la marca', () => {
    expect(urlLimpia('https://app.tatiana-villegas.com/?recuperar=1&code=abc')).toBe(
      'https://app.tatiana-villegas.com/',
    );
  });

  it('y también el formato viejo', () => {
    expect(urlLimpia('https://app.tatiana-villegas.com/#access_token=x&type=recovery')).toBe(
      'https://app.tatiana-villegas.com/',
    );
  });

  it('pero no se toca la ruta en la que esté', () => {
    expect(urlLimpia('https://app.tatiana-villegas.com/#/clientes')).toBe(
      'https://app.tatiana-villegas.com/#/clientes',
    );
  });

  it('ni los parámetros que no son suyos', () => {
    expect(urlLimpia('https://app.tatiana-villegas.com/?pago=ok&code=abc')).toBe(
      'https://app.tatiana-villegas.com/?pago=ok',
    );
  });
});
