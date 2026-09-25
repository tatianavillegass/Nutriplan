// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AgendaPage } from '../../pages/AgendaPage';
import { useAppStore } from '../../store/useAppStore';
import type { Bono, Cita, Client } from '../../types/client';
import { comoVaElBono } from '../../utils/bonos';
import { ingresosDelMes } from '../../utils/finanzas';
import { mesDeConsulta } from '../../utils/consulta';

afterEach(cleanup);

/**
 * LA AGENDA
 *
 * La semana delante y conectada a las fichas: marcar una cita como realizada
 * es lo que descuenta la sesión del bono, y cobrar apunta el pago colgado de
 * ese bono. Ésas son las dos cosas que se quedaban sin hacer.
 */

const hoy = new Date();
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const HOY = iso(hoy);
const HACE_DOS_DIAS = iso(new Date(hoy.getTime() - 2 * 86_400_000));

const BONO: Bono = {
  id: 'bn_1',
  nombre: 'Bono 6',
  importe: 420,
  inicio: '2026-01-01',
  incluye: [{ id: 'ln_c', concepto: 'Consultas', cuantas: 3 }],
};

const cita = (p: Partial<Cita> & { fecha: string; id: string }): Cita => ({
  modo: 'consulta',
  hora: '10:00',
  ...p,
});

const clienta = (p: Partial<Client> = {}): Client =>
  ({
    id: 'c1',
    nombre: 'Ana García',
    bonos: [BONO],
    sesiones: [],
    pagos: [],
    ...p,
  }) as unknown as Client;

const pintar = (clients: Client[]) => {
  useAppStore.setState({ clients, gastos: [] });
  return render(
    <MemoryRouter>
      <AgendaPage />
    </MemoryRouter>,
  );
};

beforeEach(() => useAppStore.setState({ clients: [], gastos: [] }));

describe('La semana', () => {
  it('enseña los siete días y la cita de hoy con su hora', () => {
    pintar([clienta({ citas: [cita({ fecha: HOY, id: 'ci_1' })] })]);
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getAllByText('10:00').length).toBeGreaterThan(0);
    expect(screen.getByText(/1 cita esta semana/)).toBeTruthy();
  });

  it('una clienta sin citas no ocupa ningún hueco de la semana', () => {
    /* Sale en el aviso de «sin la siguiente puesta», pero en la rejilla no. */
    pintar([clienta()]);
    expect(screen.queryByText('Ana')).toBeNull();
    expect(screen.getByText(/0 citas esta semana/)).toBeTruthy();
  });

  it('cada media hora libre es un botón para agendar ahí', () => {
    pintar([clienta()]);
    /* De ocho a nueve de la noche, de media en media: 26 huecos por día. */
    expect(screen.getAllByLabelText(/Agendar el .* a las 11:00/)).toHaveLength(7);
  });
});

describe('Agendar desde el hueco', () => {
  const abrirElHueco = () => {
    pintar([clienta()]);
    fireEvent.click(screen.getByLabelText(`Agendar el ${HOY} a las 11:00`));
  };

  it('abre la ficha con ese día y esa hora ya puestos', () => {
    abrirElHueco();
    expect(screen.getByText(new RegExp(`Agendar · ${HOY} a las 11:00`))).toBeTruthy();
  });

  it('se busca a la clienta por su nombre y al elegirla dice cómo va su bono', () => {
    abrirElHueco();
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/), {
      target: { value: 'ana' },
    });
    fireEvent.click(screen.getAllByText('Ana García').pop()!);
    expect(screen.getByText(/0 de 3 consultas/)).toBeTruthy();
    expect(screen.getByText(/faltan 420/)).toBeTruthy();
    /* Y se puede ir a su ficha sin perder lo que llevas escrito. */
    expect(screen.getByText('Abrir su ficha')).toBeTruthy();
  });

  it('al agendarla queda puesta con su hora y su duración', () => {
    abrirElHueco();
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/), {
      target: { value: 'ana' },
    });
    fireEvent.click(screen.getAllByText('Ana García').pop()!);
    fireEvent.click(screen.getByText('Agendar'));

    const puesta = useAppStore.getState().clients[0].citas![0];
    expect(puesta.fecha).toBe(HOY);
    expect(puesta.hora).toBe('11:00');
    /* Una consulta son 30 minutos sin tener que escribirlo. */
    expect(puesta.duracionMin).toBe(30);
  });

  it('sin elegir a nadie no se puede agendar', () => {
    abrirElHueco();
    expect((screen.getByText('Agendar') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Marcarla realizada descuenta su bono', () => {
  it('al pulsarla se abre, y marcarla crea la sesión del bono', () => {
    pintar([clienta({ citas: [cita({ fecha: HOY, id: 'ci_1' })] })]);

    fireEvent.click(screen.getByText('Ana'));
    /* La tarjeta abierta trae lo que lleva de su bono. */
    expect(screen.getByText(/0 de 3 · quedan 3/)).toBeTruthy();

    fireEvent.click(screen.getByText('Marcar realizada'));

    const guardada = useAppStore.getState().clients[0];
    expect(guardada.sesiones).toHaveLength(1);
    expect(guardada.sesiones![0].bonoId).toBe('bn_1');
    expect(guardada.citas!.find((c) => c.id === 'ci_1')!.estado).toBe('realizada');
  });

  it('y se puede deshacer, que quita esa misma sesión', () => {
    pintar([clienta({ citas: [cita({ fecha: HOY, id: 'ci_1' })] })]);
    fireEvent.click(screen.getByText('Ana'));
    fireEvent.click(screen.getByText('Marcar realizada'));
    fireEvent.click(screen.getByText('Deshacer'));
    expect(useAppStore.getState().clients[0].sesiones).toHaveLength(0);
  });
});

describe('Cobrar desde la cita', () => {
  it('propone lo que falta del bono y apunta el pago colgado de él', () => {
    pintar([clienta({ citas: [cita({ fecha: HOY, id: 'ci_1' })] })]);
    fireEvent.click(screen.getByText('Ana'));

    fireEvent.click(screen.getByText(/Cobrar · faltan 420/));
    fireEvent.click(screen.getByText('Apuntar el pago'));

    const pagos = useAppStore.getState().clients[0].pagos!;
    expect(pagos).toHaveLength(1);
    expect(pagos[0].importe).toBe(420);
    expect(pagos[0].bonoId).toBe('bn_1');
  });
});

describe('Lo que se olvida', () => {
  it('avisa de las citas que ya pasaron y siguen sin marcar', () => {
    pintar([clienta({ citas: [cita({ fecha: HACE_DOS_DIAS, id: 'ci_v' })] })]);
    expect(screen.getByText(/ya pasó y sigue sin marcar|ya pasaron y siguen sin marcar/)).toBeTruthy();
  });

  it('y de quién se fue sin la siguiente puesta', () => {
    pintar([clienta()]);
    expect(screen.getByText(/no tiene la siguiente cita puesta/)).toBeTruthy();
  });

  it('quien ya tiene cita no sale en ese aviso', () => {
    pintar([clienta({ citas: [cita({ fecha: HOY, id: 'ci_1' })] })]);
    expect(screen.queryByText(/no tiene la siguiente cita puesta/)).toBeNull();
  });
});

describe('El mes', () => {
  it('cuenta las consultas marcadas y lo que entró en caja', () => {
    const mes = HOY.slice(0, 7);
    pintar([
      clienta({
        sesiones: [{ id: 's1', fecha: `${mes}-02`, bonoId: 'bn_1', lineaId: 'ln_c' }],
        pagos: [{ id: 'p1', fecha: `${mes}-02`, importe: 210, bonoId: 'bn_1' }],
      }),
    ]);
    expect(screen.getByText('Consultas hechas')).toBeTruthy();
    expect(screen.getByText('210 €')).toBeTruthy();
  });
});

describe('Agendar a la hora que sea, y avisar si se dobla', () => {
  const otra = (p: Partial<Client>): Client =>
    ({ id: 'c2', nombre: 'Nicolás Pérez', bonos: [], sesiones: [], pagos: [], ...p }) as unknown as Client;

  it('la hora del hueco se puede afinar a y tres cuartos', () => {
    pintar([clienta()]);
    fireEvent.click(screen.getByLabelText(`Agendar el ${HOY} a las 15:30`));
    fireEvent.change(screen.getByLabelText('A las'), { target: { value: '15:45' } });
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/), {
      target: { value: 'ana' },
    });
    fireEvent.click(screen.getAllByText('Ana García').pop()!);
    fireEvent.click(screen.getByText('Agendar'));

    expect(useAppStore.getState().clients[0].citas![0].hora).toBe('15:45');
  });

  it('avisa con nombre si a esa hora ya hay alguien, pero deja agendar', () => {
    pintar([
      clienta(),
      otra({ citas: [cita({ fecha: HOY, hora: '15:00', duracionMin: 60, id: 'ci_n' })] }),
    ]);
    fireEvent.click(screen.getByLabelText(`Agendar el ${HOY} a las 15:30`));
    expect(screen.getByText(/ya tienes a Nicolás Pérez/)).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/), {
      target: { value: 'ana' },
    });
    fireEvent.click(screen.getAllByText('Ana García').pop()!);
    /* No bloquea: a veces se dobla. */
    expect((screen.getByText('Agendar') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('El bono y los pagos, al desplegar la cita', () => {
  it('enseña por cuántas va, lo que ha pagado y lo que debe', () => {
    pintar([
      clienta({
        citas: [cita({ fecha: HOY, id: 'ci_1' })],
        sesiones: [{ id: 's1', fecha: '2026-01-10', bonoId: 'bn_1', lineaId: 'ln_c' }],
        pagos: [{ id: 'p1', fecha: '2026-01-05', importe: 210, bonoId: 'bn_1' }],
      }),
    ]);
    fireEvent.click(screen.getByText('Ana'));

    expect(screen.getByText('Consultas')).toBeTruthy();
    expect(screen.getByText(/1 de 3 · quedan 2/)).toBeTruthy();
    expect(screen.getByText('2026-01-05')).toBeTruthy();
    expect(screen.getByText('Total')).toBeTruthy();
    /* El pago y el «pagado» de abajo dicen lo mismo: los dos son 210. */
    expect(screen.getAllByText(/210 €/).length).toBeGreaterThan(1);
  });
});

describe('Lo que se cobra en la cita es lo mismo que la ficha y la caja', () => {
  const mes = HOY.slice(0, 7);

  it('el pago entra en su bono y cuenta en el mes, sin apuntarlo dos veces', () => {
    pintar([clienta({ citas: [cita({ fecha: HOY, id: 'ci_1' })] })]);
    fireEvent.click(screen.getByText('Ana'));

    fireEvent.click(screen.getByText(/Cobrar · faltan 420/));
    fireEvent.change(screen.getByLabelText(/Cuánto cobras/), { target: { value: '210' } });
    fireEvent.click(screen.getByText('Apuntar el pago'));

    const guardada = useAppStore.getState().clients[0];

    /* 1 · En su ficha: el pago cuelga del bono, así que el «faltan» se entera. */
    expect(comoVaElBono(BONO, guardada).pagado).toBe(210);
    expect(comoVaElBono(BONO, guardada).pendiente).toBe(210);

    /* 2 · En la caja del mes: es el mismo número, leído de los mismos pagos. */
    expect(ingresosDelMes([guardada], mes)).toBe(210);
    expect(mesDeConsulta([guardada], [], mes).cobrado).toBe(210);
  });

  it('y marcar la consulta cuenta como trabajo hecho, aunque no se cobre nada', () => {
    pintar([clienta({ citas: [cita({ fecha: HOY, id: 'ci_1' })] })]);
    fireEvent.click(screen.getByText('Ana'));
    fireEvent.click(screen.getByText('Marcar realizada'));

    const guardada = useAppStore.getState().clients[0];
    const delMes = mesDeConsulta([guardada], [], mes);
    expect(delMes.consultas).toBe(1);
    /* Lo cobrado y lo trabajado son dos cosas: una consulta de un bono ya
       pagado no mete nada en caja ese mes, pero sí es trabajo hecho. */
    expect(delMes.devengado).toBeGreaterThan(0);
    expect(delMes.cobrado).toBe(0);
  });
});

describe('Llegar a la clienta desde su cita', () => {
  it('hay un botón a su ficha, no un nombre subrayado que no se ve', () => {
    pintar([clienta({ citas: [cita({ fecha: HOY, id: 'ci_1' })] })]);
    fireEvent.click(screen.getByText('Ana'));

    const ir = screen.getByText(/Abrir su ficha/) as HTMLAnchorElement;
    expect(ir.getAttribute('href')).toBe('/clientes/c1');
  });

  it('se busca por palabras: «ana gar» la encuentra igual que el nombre entero', () => {
    pintar([clienta()]);
    fireEvent.click(screen.getByLabelText(`Agendar el ${HOY} a las 11:00`));
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/), {
      target: { value: 'ana gar' },
    });
    expect(screen.getAllByText('Ana García').length).toBeGreaterThan(0);
  });
});
