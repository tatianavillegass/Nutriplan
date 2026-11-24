import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Client } from '../../types/client';
import type { Gasto } from '../../types/finanzas';
import {
  cobrosRepetidos,
  mesesConMovimiento,
  movimientosDelMes,
  totalesDelMes,
} from '../../utils/caja';
import { nombreDelMes } from '../../utils/finanzas';
import { Card, EmptyState, Select, fmt } from '../common/ui';

const dinero = (n: number, moneda: string) => `${fmt(n, n % 1 ? 2 : 0)} ${moneda}`;

const diaDelMes = (iso: string) => iso.slice(8, 10);

/**
 * CAJA: QUIÉN PAGÓ, CUÁNTO Y CUÁNDO
 * =================================
 * «Dice que en noviembre han ingresado 9k pero no me suena que esté bien.
 * Deberíamos tener una hoja donde yo pueda ver quiénes han pagado y cuánto,
 * con fecha. Así veo de dónde vienen esos ingresos.»
 *
 * El resumen daba un total por mes y nada más. Un número que no se puede abrir
 * no se puede comprobar: sólo se puede creer o desconfiar, y desconfiar de tu
 * propia caja es peor que no tenerla.
 *
 * Es la planilla que ella ya llevaba aparte: una línea por movimiento, en
 * orden de fecha, con el nombre, cómo pagó y cuánto. **Y el total de abajo es
 * la suma de estas líneas**, así que si no cuadra con lo que esperaba, la
 * línea que sobra está a la vista.
 *
 * LOS GASTOS VAN EN LA MISMA TABLA
 * ================================
 * Es una caja, no dos listas: lo que entra y lo que sale se leen juntos y en
 * orden, que es como se repasa contra el banco. Se distinguen por el color y
 * por la columna en la que cae el número, como en su hoja.
 */
export function LibroDeCaja({
  clients,
  gastos,
  moneda,
}: {
  clients: Client[];
  gastos: Gasto[];
  moneda: string;
}) {
  const meses = useMemo(() => mesesConMovimiento(clients, gastos), [clients, gastos]);
  const [mes, setMes] = useState(meses[0] ?? '');

  const movimientos = useMemo(
    () => (mes ? movimientosDelMes(clients, gastos, mes) : []),
    [clients, gastos, mes],
  );
  const total = useMemo(() => totalesDelMes(movimientos), [movimientos]);
  const repetidos = useMemo(() => cobrosRepetidos(movimientos), [movimientos]);

  if (!meses.length)
    return (
      <Card title="Caja — ingresos y gastos">
        <EmptyState title="Todavía no hay movimientos">
          Cuando apuntes un cobro o un gasto, aquí verás quién pagó, cuánto y cuándo.
        </EmptyState>
      </Card>
    );

  return (
    <Card
      title="Caja — ingresos y gastos"
      subtitle="Cada cobro y cada gasto del mes, en orden. El total de abajo es la suma de estas líneas"
      actions={
        <Select value={mes} onChange={(e) => setMes(e.target.value)} className="text-sm">
          {meses.map((m) => (
            <option key={m} value={m}>
              {nombreDelMes(m)}
            </option>
          ))}
        </Select>
      }
    >
      {movimientos.length === 0 ? (
        <p className="text-sm text-slate-500">Ese mes no tiene ningún movimiento apuntado.</p>
      ) : (
        <>
          {repetidos.size > 0 && (
            /*
              Un pago se puede apuntar desde la cita, desde la ficha y desde el
              bono. No se descuenta nada —puede ser real— pero si el mes no
              cuadra, esto es lo primero que hay que mirar.
            */
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-900">
              Hay {repetidos.size} cobros que se repiten: misma persona, mismo importe y mismo
              día. Puede ser correcto, pero si el mes no te cuadra, empieza por ahí — un pago se
              puede apuntar desde la cita y desde la ficha, y entonces cuenta dos veces.
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                  <th className="py-1.5 pr-2 text-left font-medium">Día</th>
                  <th className="py-1.5 pr-2 text-left font-medium">Nombre</th>
                  <th className="py-1.5 pr-2 text-left font-medium">Método</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Ingreso</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Gasto</th>
                  <th className="py-1.5 text-left font-medium">Categoría</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {movimientos.map((m) => {
                  const dudoso = repetidos.has(m.id);
                  return (
                    <tr
                      key={`${m.tipo}-${m.id}`}
                      className={`border-b border-slate-50 ${dudoso ? 'bg-amber-50/60' : ''}`}
                    >
                      <td className="py-1.5 pr-2 text-xs text-slate-500">{diaDelMes(m.fecha)}</td>
                      <td className="py-1.5 pr-2 text-slate-800">
                        {m.clientId ? (
                          /* Desde la línea se salta a su ficha: si algo no cuadra,
                             lo siguiente que se hace siempre es abrirla. */
                          <Link
                            to={`/clientes/${m.clientId}`}
                            className="text-brand-800 hover:underline"
                          >
                            {m.nombre}
                          </Link>
                        ) : (
                          m.nombre
                        )}
                        {/*
                          En un gasto el concepto ES el nombre, así que
                          repetirlo sería escribir «Plicómetro Plicómetro».
                        */}
                        {m.concepto && m.concepto !== m.nombre && (
                          <span className="ml-1.5 text-[11px] text-slate-400">{m.concepto}</span>
                        )}
                        {dudoso && (
                          <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-900">
                            repetido
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-xs text-slate-500">{m.metodo ?? ''}</td>
                      <td className="py-1.5 pr-2 text-right font-medium text-emerald-800">
                        {m.tipo === 'ingreso' ? dinero(m.importe, moneda) : ''}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-medium text-rose-800">
                        {m.tipo === 'gasto' ? dinero(m.importe, moneda) : ''}
                      </td>
                      <td className="py-1.5 text-xs text-slate-500">{m.categoria ?? ''}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td className="py-2 pr-2 text-xs text-slate-500" colSpan={3}>
                    {movimientos.length} movimientos
                  </td>
                  <td className="tnum py-2 pr-2 text-right text-emerald-900">
                    {dinero(total.ingresos, moneda)}
                  </td>
                  <td className="tnum py-2 pr-2 text-right text-rose-900">
                    {dinero(total.gastos, moneda)}
                  </td>
                  <td className="tnum py-2 text-right text-slate-800">
                    {dinero(total.saldo, moneda)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
