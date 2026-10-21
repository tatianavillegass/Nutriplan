// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClientView } from '../../pages/ClientView';
import { AccesoTerminado } from '../client/AccesoTerminado';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DEMO_CLIENT, DEMO_PLAN } from '../../data/demoSeed';
import { FOOD_CATALOG } from '../../data/foodCatalog';

afterEach(cleanup);

/**
 * CUANDO SE LE ACABA EL ACCESO
 *
 * Esto no existía, y ése era el problema: «Acceso hasta» era una nota en la
 * tabla de la nutricionista y nada más. Nadie comprobaba la fecha, así que una
 * clienta dada de baja en marzo seguía entrando en octubre y marcando comidas.
 */

const CADUCADA = { ...DEMO_CLIENT, accesoHasta: '2026-03-01' };

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore.setState({
    clients: [CADUCADA],
    plans: [DEMO_PLAN],
    foods: FOOD_CATALOG,
    recipes: [],
    registros: [],
    mediciones: [],
    recursos: [],
  });
  useAuthStore.setState({ perfil: null });
});

const comoLaClienta = () =>
  useAuthStore.setState({
    perfil: { rol: 'cliente', clientId: DEMO_CLIENT.id } as never,
  });

const abrir = () =>
  render(
    <MemoryRouter initialEntries={[`/clientes/${DEMO_CLIENT.id}/vista`]}>
      <Routes>
        <Route path="/clientes/:id/vista" element={<ClientView />} />
      </Routes>
    </MemoryRouter>,
  );

describe('A ella se le dice, y se le para', () => {
  it('no ve su plan', () => {
    comoLaClienta();
    abrir();
    expect(screen.queryByText(/Hola,/)).toBeNull();
    expect(screen.getByText(/Tu plan ha terminado/)).toBeTruthy();
  });

  /*
   * El mensaje es suyo, en primera persona: una pantalla de sistema («su
   * acceso ha expirado») convierte un final normal en un portazo.
   */
  it('con su voz, y con la salida delante', () => {
    comoLaClienta();
    abrir();
    expect(screen.getByText(/ponte en contacto conmigo/i)).toBeTruthy();
  });

  /** La fecha no es el mensaje, pero sin ella se piensa que la app se rompió. */
  it('se le dice cuándo terminó, en pequeño', () => {
    comoLaClienta();
    abrir();
    expect(screen.getByText(/Terminó el 1 de marzo de 2026/)).toBeTruthy();
  });

  /*
   * Lo primero que se piensa al ver esta pantalla es «¿he perdido mis medidas
   * de seis meses?». Contestarlo antes de que lo pregunte es la mitad del
   * mensaje.
   */
  it('y que lo suyo sigue guardado', () => {
    comoLaClienta();
    abrir();
    expect(screen.getByText(/se queda guardado/i)).toBeTruthy();
  });

  /*
   * Un plan que se ve pero no se puede tocar es una tienda con la persiana a
   * medias: se intenta, no funciona, y escribe preguntando si está roto.
   */
  it('nada del día queda a medio camino', () => {
    comoLaClienta();
    abrir();
    expect(screen.queryByText('Marcar hecha')).toBeNull();
    expect(screen.queryByText(/Cómo va tu día/)).toBeNull();
  });
});

/**
 * La nutricionista entra en esta misma pantalla para repasar cómo le fue y
 * para preparar la vuelta: si le saltara el cartel no podría ver a quien tiene
 * de baja, que es justo a quien va a llamar.
 */
describe('A la nutricionista no se le cierra', () => {
  it('sigue viendo el plan de una clienta caducada', () => {
    abrir();
    expect(screen.getByText(/Hola,/)).toBeTruthy();
    expect(screen.queryByText(/Tu plan ha terminado/)).toBeNull();
  });
});

describe('Con el acceso al día no cambia nada', () => {
  it('entra como siempre', () => {
    useAppStore.setState({ clients: [{ ...DEMO_CLIENT, accesoHasta: '2099-01-01' }] });
    comoLaClienta();
    abrir();
    expect(screen.getByText(/Hola,/)).toBeTruthy();
  });

  /** Sin fecha de fin el acceso es abierto: la misma regla que en el servidor. */
  it('y sin fecha de fin, también', () => {
    useAppStore.setState({ clients: [{ ...DEMO_CLIENT, accesoHasta: undefined }] });
    comoLaClienta();
    abrir();
    expect(screen.getByText(/Hola,/)).toBeTruthy();
  });
});

describe('La pantalla, por dentro', () => {
  it('sin correo configurado no inventa un botón que escriba a nadie', () => {
    render(<AccesoTerminado nombre="Sofía Murgueitio" termino="2026-03-01" />);
    expect(screen.queryByText('Escríbeme')).toBeNull();
    expect(screen.getByText(/Escríbele a tu nutricionista/)).toBeTruthy();
  });

  it('con correo, el botón lleva a escribirle', () => {
    render(
      <AccesoTerminado
        nombre="Sofía Murgueitio"
        termino="2026-03-01"
        emailNutri="tats@ejemplo.com"
      />,
    );
    expect(screen.getByText('Escríbeme')).toBeTruthy();
    expect(screen.getByText('tats@ejemplo.com')).toBeTruthy();
  });

  /** Una fecha que no se entiende no se pinta: mejor sin fecha que con basura. */
  it('con una fecha ilegible, lo dice sin fecha', () => {
    render(<AccesoTerminado nombre="Sofía" termino="no-es-una-fecha" />);
    // Sin fecha legible, el mensaje se queda sin la línea de abajo y ya.
    expect(screen.getByText(/Tu plan ha terminado/)).toBeTruthy();
    expect(screen.queryByText(/Terminó el/)).toBeNull();
  });
});
