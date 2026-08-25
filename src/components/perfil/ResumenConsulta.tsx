import { useMemo, useState } from "react";
import type { Client } from "../../types/client";
import type { Gasto } from "../../types/finanzas";
import {
  añoDeConsulta,
  descuentos,
  sesionesDelMes,
  sumarMeses,
  type MesDeConsulta,
} from "../../utils/consulta";
import { nombreDelMes } from "../../utils/finanzas";
import { Card, EmptyState, fmt } from "../common/ui";

/**
 * LA MIRADA GLOBAL
 *
 * La hoja de cálculo que llevaba a mano, calculada sola. Un mes por fila y el
 * año entero de un vistazo.
 *
 * La columna que de verdad importa es la pareja **cobrado / devengado**: lo
 * que entró en caja y el trabajo que hiciste. No son lo mismo y confundirlos
 * engaña en las dos direcciones — un mes con mucha caja puede ser el peor mes
 * de trabajo del año, porque cobraste por delante un bono que aún no has dado.
 */

const dinero = (n: number, moneda: string) =>
  `${fmt(n, n % 1 ? 2 : 0)} ${moneda}`;

export function ResumenConsulta({
  clients,
  gastos,
  moneda,
}: {
  clients: Client[];
  gastos: Gasto[];
  moneda: string;
}) {
  const esteAño = new Date().getFullYear();
  const [año, setAño] = useState(esteAño);

  const meses = useMemo(
    () => añoDeConsulta(clients, gastos, año),
    [clients, gastos, año],
  );
  const total = useMemo(() => sumarMeses(meses), [meses]);
  const conDescuento = useMemo(() => descuentos(clients), [clients]);

  const hayAlgo = meses.some((m) => m.consultas || m.cobrado || m.gastos);

  /**
   * QUE SE PUEDA RASTREAR
   *
   * En el resumen aparecía un «trabajo hecho» en euros que no salía de ningún
   * sitio visible. Un número que no se puede comprobar no se puede creer, así
   * que cada mes se abre y enseña sus consultas una a una, con lo que devenga
   * cada una y de qué bono sale.
   */
  const [abierto, setAbierto] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card
        title={`El año ${año}`}
        subtitle="Lo que has hecho y lo que ha entrado"
        actions={
          <div className="flex gap-1">
            <button
              onClick={() => setAño(año - 1)}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50"
            >
              ←
            </button>
            <button
              onClick={() => setAño(año + 1)}
              disabled={año >= esteAño}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-30"
            >
              →
            </button>
          </div>
        }
      >
        {!hayAlgo ? (
          <EmptyState title={`Sin movimiento en ${año}`}>
            Las consultas salen de las sesiones que marcas como hechas en cada
            ficha, y lo cobrado de los pagos. Los gastos se apuntan en la pestaña
            de al lado.
          </EmptyState>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Cifra titulo="Consultas hechas" valor={String(total.consultas)} />
              <Cifra titulo="Entró en caja" valor={dinero(total.cobrado, moneda)} />
              <Cifra titulo="Trabajo hecho" valor={dinero(total.devengado, moneda)} />
              <Cifra
                titulo="Ganancia neta"
                valor={dinero(total.neto, moneda)}
                tono={total.neto < 0 ? "mal" : "bien"}
              />
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-[10px] tracking-wide text-slate-400 uppercase">
                    <th className="py-2 pr-3 text-left font-medium">Mes</th>
                    <th className="px-2 py-2 text-right font-medium">Consultas</th>
                    <th className="px-2 py-2 text-right font-medium">Online</th>
                    <th className="px-2 py-2 text-right font-medium">Presencial</th>
                    <th className="px-2 py-2 text-right font-medium">Programa</th>
                    <th className="px-2 py-2 text-right font-medium">Trabajo hecho</th>
                    <th className="px-2 py-2 text-right font-medium">Entró en caja</th>
                    <th className="px-2 py-2 text-right font-medium">Diferencia</th>
                    <th className="px-2 py-2 text-right font-medium">Gastos</th>
                    <th className="px-2 py-2 text-right font-medium">Neto</th>
                    <th className="py-2 pl-2 text-right font-medium">Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {meses.map((m) => (
                    <Fila
                      key={m.mes}
                      m={m}
                      moneda={moneda}
                      abierta={abierto === m.mes}
                      onAbrir={() => setAbierto(abierto === m.mes ? null : m.mes)}
                      sesiones={abierto === m.mes ? sesionesDelMes(clients, m.mes) : []}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-semibold">
                    <td className="py-2 pr-3 text-left">Total</td>
                    <td className="tnum px-2 py-2 text-right">{total.consultas}</td>
                    <td className="tnum px-2 py-2 text-right">{total.online}</td>
                    <td className="tnum px-2 py-2 text-right">{total.presencial}</td>
                    <td className="tnum px-2 py-2 text-right">{total.programa}</td>
                    <td className="tnum px-2 py-2 text-right">{dinero(total.devengado, moneda)}</td>
                    <td className="tnum px-2 py-2 text-right">{dinero(total.cobrado, moneda)}</td>
                    <td className="tnum px-2 py-2 text-right">{dinero(total.diferencia, moneda)}</td>
                    <td className="tnum px-2 py-2 text-right">{dinero(total.gastos, moneda)}</td>
                    <td className="tnum px-2 py-2 text-right">{dinero(total.neto, moneda)}</td>
                    <td className="tnum py-2 pl-2 text-right">{dinero(total.ticket, moneda)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/*
              Los dos huecos que pueden falsear la tabla se dicen, en vez de
              dejar que ella descubra sola que los números no le cuadran.
            */}
            {total.sinModalidad > 0 && (
              <p className="mt-3 text-xs leading-snug text-amber-700">
                {total.sinModalidad === 1
                  ? "Una consulta sin decir si fue online o presencial"
                  : `${total.sinModalidad} consultas sin decir si fueron online o presenciales`}
                : por eso las dos columnas no suman el total. Se arregla poniendo
                la modalidad en la ficha de esa clienta.
              </p>
            )}
            {total.sinValor > 0 && (
              <p className="mt-1 text-xs leading-snug text-amber-700">
                {total.sinValor === 1
                  ? "Una consulta suelta sin precio"
                  : `${total.sinValor} consultas sueltas sin precio`}
                : no suman en «trabajo hecho». Ponle lo que cobraste en su ficha,
                en «Bonos y consultas», y contarán.
              </p>
            )}

            <p className="mt-3 text-xs leading-snug text-slate-400">
              <strong>Entró en caja</strong> es el dinero que te pagaron ese mes.{" "}
              <strong>Trabajo hecho</strong> es lo que devengaste: el precio del bono
              repartido entre las sesiones que incluye. Si alguien paga 270 € en
              enero y hace sus tres consultas en enero, febrero y marzo, enero cobra
              270 y trabaja 90.
            </p>
          </>
        )}
      </Card>

      {conDescuento.bonos > 0 && (
        <Card
          title="Bonos con descuento"
          subtitle="Los que van por debajo de tu tarifa"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Cifra titulo="Clientas" valor={String(conDescuento.clientas)} />
            <Cifra titulo="Bonos" valor={String(conDescuento.bonos)} />
            <Cifra
              titulo="Has dejado de cobrar"
              valor={dinero(conDescuento.dejadoDeCobrar, moneda)}
              tono="neutro"
            />
          </div>
          {conDescuento.motivos.length > 0 && (
            <p className="mt-3 text-xs leading-snug text-slate-500">
              Por: {conDescuento.motivos.join(" · ")}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function Fila({
  m,
  moneda,
  abierta,
  onAbrir,
  sesiones,
}: {
  m: MesDeConsulta;
  moneda: string;
  abierta: boolean;
  onAbrir: () => void;
  sesiones: ReturnType<typeof sesionesDelMes>;
}) {
  const vacio = !m.consultas && !m.cobrado && !m.gastos;
  return (
    <>
    <tr
      onClick={m.consultas ? onAbrir : undefined}
      className={`border-t border-slate-100 ${vacio ? "text-slate-300" : ""} ${
        m.consultas ? "cursor-pointer hover:bg-brand-50/50" : ""
      }`}
    >
      <td className="py-1.5 pr-3 text-left capitalize">
        {m.consultas > 0 && (
          <span className="mr-1 text-slate-300">{abierta ? "▾" : "▸"}</span>
        )}
        {nombreDelMes(m.mes).replace(` de ${m.mes.slice(0, 4)}`, "")}
      </td>
      <td className="tnum px-2 py-1.5 text-right">{m.consultas || "—"}</td>
      <td className="tnum px-2 py-1.5 text-right">{m.online || "—"}</td>
      <td className="tnum px-2 py-1.5 text-right">{m.presencial || "—"}</td>
      <td className="tnum px-2 py-1.5 text-right">{m.programa || "—"}</td>
      <td className="tnum px-2 py-1.5 text-right">
        {m.devengado ? dinero(m.devengado, moneda) : "—"}
      </td>
      <td className="tnum px-2 py-1.5 text-right">
        {m.cobrado ? dinero(m.cobrado, moneda) : "—"}
      </td>
      {/*
        La diferencia en rojo no es una alarma: significa que ese mes trabajaste
        más de lo que cobraste, que es exactamente lo que pasa cuando das las
        consultas de un bono que ya te habían pagado.
      */}
      <td
        className={`tnum px-2 py-1.5 text-right ${
          m.diferencia < 0 ? "text-rose-700" : "text-slate-700"
        }`}
      >
        {m.consultas || m.cobrado ? dinero(m.diferencia, moneda) : "—"}
      </td>
      <td className="tnum px-2 py-1.5 text-right">
        {m.gastos ? dinero(m.gastos, moneda) : "—"}
      </td>
      <td
        className={`tnum px-2 py-1.5 text-right font-medium ${
          m.neto < 0 ? "text-rose-700" : "text-slate-900"
        }`}
      >
        {vacio ? "—" : dinero(m.neto, moneda)}
      </td>
      <td className="tnum py-1.5 pl-2 text-right">
        {m.ticket ? dinero(m.ticket, moneda) : "—"}
      </td>
    </tr>

    {abierta && (
      <tr className="bg-brand-50/30">
        <td colSpan={11} className="px-3 py-2">
          <p className="mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
            Las {sesiones.length} consultas de este mes
          </p>
          <ul className="space-y-0.5">
            {sesiones.map((s) => (
              <li key={s.sesion.id} className="flex flex-wrap items-baseline gap-2 text-xs">
                <span className="w-20 shrink-0 text-slate-400">{s.sesion.fecha}</span>
                <span className="font-medium text-slate-800">{s.client.nombre}</span>
                <span className="text-slate-500">
                  {s.concepto ?? "Consulta"}
                  {s.modalidad ? ` · ${s.modalidad}` : ""}
                </span>
                <span className="flex-1" />
                {s.valor > 0 ? (
                  <span className="tnum text-slate-700">
                    {dinero(s.valor, moneda)}
                    <span className="text-slate-400">
                      {" "}
                      ({s.bono?.nombre}: {dinero(s.bono?.importe ?? 0, moneda)} ÷{" "}
                      {s.bono?.incluye.reduce((a, l) => a + l.cuantas, 0)} sesiones)
                    </span>
                  </span>
                ) : (
                  <span className="text-amber-700">sin precio puesto</span>
                )}
              </li>
            ))}
          </ul>
        </td>
      </tr>
    )}
    </>
  );
}

function Cifra({
  titulo,
  valor,
  tono = "bien",
}: {
  titulo: string;
  valor: string;
  tono?: "bien" | "mal" | "neutro";
}) {
  const color = {
    bien: "text-brand-900",
    mal: "text-rose-700",
    neutro: "text-slate-700",
  }[tono];
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/40 px-3 py-2.5">
      <p className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
        {titulo}
      </p>
      <p className={`tnum mt-0.5 text-lg font-semibold ${color}`}>{valor}</p>
    </div>
  );
}
