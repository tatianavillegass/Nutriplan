// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClientView } from '../../pages/ClientView';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DEMO_CLIENT, DEMO_PLAN } from '../../data/demoSeed';
import { FOOD_CATALOG } from '../../data/foodCatalog';

afterEach(cleanup);

beforeEach(() => {
  // jsdom no trae ni scrollIntoView ni matchMedia, que usa el impreso.
  Element.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ perfil: null });
  useAppStore.setState({
    clients: [DEMO_CLIENT],
    plans: [DEMO_PLAN],
    foods: FOOD_CATALOG,
    recipes: [],
    registros: [],
    mediciones: [],
    recursos: [],
  });
});

/**
 * Hay dos juegos de pestañas: el de arriba para pantalla ancha y el de abajo
 * para el móvil. Sólo se ve uno cada vez —lo decide el CSS— pero en las
 * pruebas están los dos, así que se busca por posición.
 */
const pestana = (nombre: string) => screen.getAllByRole('button', { name: nombre })[0];
/** Si la pestaña no existe en esta fase, no hay botón que pulsar. */
const hayPestana = (nombre: string) =>
  screen.queryAllByRole('button', { name: nombre }).length > 0;

/** Entrar como la clienta: hay cosas que sólo se le enseñan a ella. */
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

/**
 * LA PANTALLA DEL CLIENTE TIENE QUE ABRIRSE
 *
 * Esta prueba existe porque se quedó en blanco: un selector del store que
 * filtraba dentro —`s.mediciones.filter(...)`— devolvía una lista nueva en
 * cada pintada, el store creía que había cambiado algo y volvía a pintar sin
 * parar hasta que React cortaba. No lo vio ningún test porque ninguno abría la
 * página entera.
 */
describe('El día de la clienta se abre', () => {
  it('sin quedarse en blanco', () => {
    abrir();
    expect(screen.getByText(/Hola,/)).toBeTruthy();
  });

  it('y empieza en el plan, que es lo que se abre todos los días', () => {
    abrir();
    expect(pestana('Plan').getAttribute('aria-current')).toBe('true');
  });
});

/**
 * FASE 4: LA MISMA APP, CONTANDO GRAMOS
 *
 * Se le van las comidas, las porciones y los extras, y se queda el contador
 * del día. Las recetas siguen ahí, plegadas: terminar el proceso no es perder
 * el material que ya conocía.
 */
describe('El día de quien cuenta macros', () => {
  const enFase4 = () => {
    useAppStore.setState({ plans: [{ ...DEMO_PLAN, fase: 4 }] });
    abrir();
  };

  it('lo que se abre es el contador del día, por comidas', () => {
    enFase4();
    expect(screen.getByText('Lo que llevas hoy')).toBeTruthy();
    // Cada comida del plan con su propio botón de añadir.
    expect(screen.getAllByText('+ Añadir').length).toBeGreaterThan(1);
  });

  it('sin comidas que marcar ni extras que apuntar aparte', () => {
    enFase4();
    expect(screen.queryByText('Marcar hecha')).toBeNull();
    expect(screen.queryByText(/Añadir extra/i)).toBeNull();
  });

  /** Sin recetas asignadas no se enseña una sección vacía. */
  it('y sin recetas asignadas no aparece el apartado', () => {
    enFase4();
    expect(screen.queryByText('Tus recetas')).toBeNull();
  });
});

/**
 * EL MENSAJE SE LEE Y SE CIERRA
 *
 * Es lo primero que hay que leer el día que llega el plan, y a partir de ahí
 * ocupa sitio en la única pantalla que se usa a diario.
 */
describe('El mensaje de la nutricionista', () => {
  const conMensaje = () => {
    useAppStore.setState({
      plans: [
        {
          ...DEMO_PLAN,
          envio: { fecha: '2026-08-16T09:00:00.000Z', mensaje: 'Ya tienes tu plan nuevo' },
        },
      ],
    });
    abrir();
  };

  it('sale cuando llega', () => {
    conMensaje();
    expect(screen.getByText('Ya tienes tu plan nuevo')).toBeTruthy();
  });

  it('y se puede cerrar para que no quite sitio', () => {
    conMensaje();
    fireEvent.click(screen.getByLabelText('Cerrar el mensaje'));
    expect(screen.queryByText('Ya tienes tu plan nuevo')).toBeNull();
  });
});

/**
 * LAS CINCO PESTAÑAS
 * ==================
 * Antes eran tres y se usaba una: lo de la semana —el menú, la compra, los
 * postres, la encuesta— estaba apilado dentro del día. Lo que se comprueba
 * aquí es que cada cosa está donde se dijo, que el plan sigue en el centro y
 * que ninguna pestaña aparece vacía.
 */
describe('Las cinco pestañas', () => {
  it('el resumen enseña constancia y comidas fuera', () => {
    abrir();
    fireEvent.click(pestana('Resumen'));
    expect(screen.getByText('Tu constancia')).toBeTruthy();
    expect(screen.getByText(/Comidas fuera este mes/i)).toBeTruthy();
  });

  /** La encuesta pregunta por la semana que acaba: va con lo de la semana. */
  it('y la encuesta semanal vive ahí, no dentro del día', () => {
    comoLaClienta();
    abrir();
    expect(screen.queryByText(/Tu semana/i)).toBeNull();
  });

  it('se vuelve al plan sin perder nada', () => {
    abrir();
    fireEvent.click(pestana('Resumen'));
    fireEvent.click(pestana('Plan'));
    expect(screen.queryByText('Tu constancia')).toBeNull();
    expect(screen.getByText(/Hola,/)).toBeTruthy();
  });

  /*
   * Es lo que pasó con «Recursos»: se entró dos veces, no había nada, y se
   * dejó de entrar — también cuando luego hubo algo.
   */
  it('sin nada que enseñar, la pestaña no aparece', () => {
    abrir();
    expect(hayPestana('Recetas')).toBe(false);
    // Y «Recursos» ya no es una pestaña: vive dentro de «Recetas».
    expect(hayPestana('Recursos')).toBe(false);
  });

  it('el menú y la compra son dos pestañas, no una tarjeta dentro del día', () => {
    comoLaClienta();
    abrir();
    expect(hayPestana('Reajustes')).toBe(true);
    expect(hayPestana('Compra')).toBe(true);
    // Y ya no están dentro del día.
    expect(screen.queryByText('Organiza tu semana')).toBeNull();
  });

  it('en reajustes se deja puesta la semana', () => {
    comoLaClienta();
    abrir();
    fireEvent.click(pestana('Reajustes'));
    expect(screen.getByText(/Di cuántas veces comes/i)).toBeTruthy();
  });

  it('y en compra se abre la lista, sin pasar por el menú', () => {
    comoLaClienta();
    abrir();
    fireEvent.click(pestana('Compra'));
    expect(screen.getByText(/Tu lista sale de lo que dejaste puesto/i)).toBeTruthy();
    expect(screen.queryByText(/Di cuántas veces comes/i)).toBeNull();
  });

  /*
   * En fase 3 y 4 elige alimentos sueltos: nadie sabe qué va a comer el
   * jueves, así que la lista de la compra sería un invento.
   */
  it('pero no en las fases en las que no hay nada que dejar puesto', () => {
    comoLaClienta();
    useAppStore.setState({ plans: [{ ...DEMO_PLAN, fase: 3 }] });
    abrir();
    expect(hayPestana('Reajustes')).toBe(false);
    expect(hayPestana('Compra')).toBe(false);
  });
});
