import { useMemo, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import { hayNube } from "../utils/supabase";
import { uid } from "../utils/storage";
import {
  CATEGORIAS_GASTO,
  LABEL_CADA,
  LABEL_CATEGORIA,
  type Cada,
  type CategoriaGasto,
  type Gasto,
} from "../types/finanzas";
import {
  hayVariasMonedas,
  monedaDeLaConsulta,
  nombreDelMes,
  porMes,
} from "../utils/finanzas";
import { Button, Card, Field, Input, Select } from "../components/common/ui";
import { ResumenConsulta } from "../components/perfil/ResumenConsulta";
import { gastosPorCategoria } from "../utils/consulta";

/**
 * MI CUENTA
 *
 * Dos cosas que no tenían sitio en ninguna pantalla:
 *
 *   · **Los datos de acceso.** El correo con el que entra —que es el que hay
 *     que dar cuando algo falla— y poder cambiar la contraseña sin tener que
 *     fingir que se le ha olvidado y esperar un correo.
 *   · **Cómo va la consulta.** Lo que entra, lo que sale y lo que queda.
 *
 * Los ingresos NO se apuntan aquí: salen de los pagos de cada ficha, que es
 * donde ella los mira cuando habla con esa clienta. Duplicar el sitio donde se
 * apunta un pago es garantizar que los dos sitios acaben diciendo cosas
 * distintas.
 */

const hoyIso = () => new Date().toISOString().slice(0, 10);

const dinero = (n: number, moneda: string) =>
  `${n.toLocaleString("es-ES", { maximumFractionDigits: 2 })} ${moneda}`;

export function PerfilPage() {
  const cuenta = useAuthStore((s) => s.actual());
  const cambiarContrasena = useAuthStore((s) => s.cambiarContrasena);
  const clients = useAppStore((s) => s.clients);
  const gastos = useAppStore((s) => s.gastos);
  const upsertGasto = useAppStore((s) => s.upsertGasto);
  const borrarGasto = useAppStore((s) => s.borrarGasto);

  const moneda = monedaDeLaConsulta(clients);
  const variasMonedas = hayVariasMonedas(clients);

  const fijos = gastos.filter((g) => g.cada && !g.hasta);
  const alMes = fijos.reduce((s, g) => s + porMes(g.importe, g.cada), 0);

  /**
   * TRES PESTAÑAS
   *
   * La mirada global y el detalle no se miran a la vez ni con la misma cabeza:
   * el resumen es para saber cómo va el año, y los gastos para teclear. Todo
   * junto en una sola página era una pantalla que había que recorrer entera
   * para llegar a lo de abajo.
   */
  const [tab, setTab] = useState<"resumen" | "gastos" | "acceso">("resumen");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-brand-900">Mi cuenta</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Cómo va la consulta y tus datos de acceso.
        </p>
      </div>

      <nav className="flex gap-1 border-b border-brand-100">
        {(
          [
            ["resumen", "Resumen"],
            ["gastos", "Gastos"],
            ["acceso", "Acceso"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
              tab === id
                ? "border-brand-700 font-medium text-brand-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "resumen" && (
        <>
          <ResumenConsulta clients={clients} gastos={gastos} moneda={moneda} />
          {variasMonedas && (
            <p className="text-xs leading-snug text-amber-700">
              Tienes tarifas en más de una moneda. Las cifras están sumadas en{" "}
              {moneda}, así que no cuadran con lo que cobras de verdad.
            </p>
          )}
        </>
      )}

      {tab === "gastos" && (
        <>
          <DesgloseDeGastos gastos={gastos} moneda={moneda} />
          <GastosFijos
            gastos={fijos}
            alMes={alMes}
            moneda={moneda}
            onGuardar={upsertGasto}
            onBorrar={borrarGasto}
          />
          <GastosSueltos
            gastos={gastos}
            moneda={moneda}
            onGuardar={upsertGasto}
            onBorrar={borrarGasto}
          />
        </>
      )}

      {tab === "acceso" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Acceso" subtitle="Con lo que entras en la app">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Correo</dt>
                <dd className="font-medium text-slate-900">{cuenta?.email ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Nombre</dt>
                <dd className="font-medium text-slate-900">{cuenta?.nombre ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Tus datos</dt>
                <dd className="font-medium text-slate-900">
                  {hayNube ? "En el servidor" : "Sólo en este navegador"}
                </dd>
              </div>
            </dl>
            {!hayNube && (
              <p className="mt-3 text-xs leading-snug text-amber-700">
                Sin servidor, todo vive en este navegador: si lo borras o cambias
                de ordenador, no está en ningún otro sitio.
              </p>
            )}
          </Card>

          <CambiarClave onCambiar={cambiarContrasena} />
        </div>
      )}
    </div>
  );
}

/**
 * LOS GASTOS, MES A MES Y POR CATEGORÍA
 *
 * Un total no dice nada. Lo que hace falta ver es que el consultorio sube
 * cuando subes de clientas, y eso sólo se nota comparando el mismo concepto de
 * un mes al siguiente.
 */
function DesgloseDeGastos({ gastos, moneda }: { gastos: Gasto[]; moneda: string }) {
  const hoy = new Date();
  /** Los últimos seis meses: un año entero no cabe a lo ancho y no se lee. */
  const meses = useMemo(() => {
    const out: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  }, [hoy.getFullYear(), hoy.getMonth()]);

  const filas = useMemo(() => gastosPorCategoria(gastos, meses), [gastos, meses]);
  if (!filas.length) return null;

  const totalPorMes = meses.map((_, i) =>
    filas.reduce((s, f) => s + f.porMes[i], 0),
  );

  return (
    <Card title="En qué se te va" subtitle="Los últimos seis meses, por categoría">
      <div className="overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="text-[10px] tracking-wide text-slate-400 uppercase">
              <th className="py-2 pr-3 text-left font-medium">Categoría</th>
              {meses.map((m) => (
                <th key={m} className="px-2 py-2 text-right font-medium capitalize">
                  {nombreDelMes(m).split(" de ")[0].slice(0, 3)}
                </th>
              ))}
              <th className="py-2 pl-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.categoria} className="border-t border-slate-100">
                <td className="py-1.5 pr-3 text-slate-700">
                  {LABEL_CATEGORIA[f.categoria]}
                </td>
                {f.porMes.map((n, i) => (
                  <td key={i} className="tnum px-2 py-1.5 text-right text-slate-600">
                    {n ? dinero(n, moneda) : "—"}
                  </td>
                ))}
                <td className="tnum py-1.5 pl-2 text-right font-medium text-slate-900">
                  {dinero(f.total, moneda)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-semibold">
              <td className="py-2 pr-3">Total</td>
              {totalPorMes.map((n, i) => (
                <td key={i} className="tnum px-2 py-2 text-right">
                  {n ? dinero(n, moneda) : "—"}
                </td>
              ))}
              <td className="tnum py-2 pl-2 text-right">
                {dinero(totalPorMes.reduce((s, n) => s + n, 0), moneda)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}


/**
 * Cambiar la contraseña sin pasar por «se me olvidó».
 *
 * Con servidor, Supabase no pide la actual —basta con tener la sesión abierta—
 * así que no se enseña esa casilla: pedir un dato que no se comprueba es
 * teatro. Sin servidor sí hace falta, porque es lo único que hay.
 */
function CambiarClave({
  onCambiar,
}: {
  onCambiar: (actual: string, nueva: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [estado, setEstado] = useState<string | null>(null);
  const [yendo, setYendo] = useState(false);

  const enviar = async () => {
    setEstado(null);
    if (nueva !== repetida) {
      setEstado("Las dos contraseñas nuevas no coinciden.");
      return;
    }
    setYendo(true);
    const r = await onCambiar(actual, nueva);
    setYendo(false);
    if (!r.ok) {
      setEstado(r.error ?? "No se pudo cambiar.");
      return;
    }
    setActual("");
    setNueva("");
    setRepetida("");
    setEstado("Hecho: tu contraseña nueva ya vale.");
  };

  return (
    <Card title="Contraseña" subtitle="Mínimo 8 caracteres, y que no sean sólo números">
      <div className="space-y-3">
        {!hayNube && (
          <Field label="Contraseña actual">
            <Input
              type="password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
        )}
        <Field label="Contraseña nueva">
          <Input
            type="password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Repítela">
          <Input
            type="password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Button onClick={() => void enviar()} disabled={yendo || !nueva || !repetida}>
          {yendo ? "Cambiando…" : "Cambiar contraseña"}
        </Button>
        {estado && (
          <p
            className={`text-xs ${estado.startsWith("Hecho") ? "text-emerald-700" : "text-rose-700"}`}
          >
            {estado}
          </p>
        )}
      </div>
    </Card>
  );
}

/** El formulario compartido por los dos tipos de gasto. */
function FormularioGasto({
  fijo,
  onGuardar,
  onCerrar,
}: {
  fijo: boolean;
  onGuardar: (g: Gasto) => void;
  onCerrar: () => void;
}) {
  const [concepto, setConcepto] = useState("");
  const [importe, setImporte] = useState("");
  const [fecha, setFecha] = useState(hoyIso());
  const [categoria, setCategoria] = useState<CategoriaGasto>("otros");
  const [cada, setCada] = useState<Cada>("mes");

  const guardar = () => {
    const n = Number(importe.replace(",", "."));
    if (!concepto.trim() || !Number.isFinite(n) || n <= 0) return;
    onGuardar({
      id: uid("ga_"),
      fecha,
      concepto: concepto.trim(),
      importe: n,
      categoria,
      ...(fijo ? { cada } : {}),
    });
    onCerrar();
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-brand-100 bg-brand-50/30 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Concepto">
          <Input
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder={fijo ? "Supabase, cuota de autónoma…" : "Báscula, curso…"}
          />
        </Field>
        <Field label="Importe">
          <Input
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            inputMode="decimal"
            placeholder="25"
          />
        </Field>
        <Field label={fijo ? "Desde cuándo lo pagas" : "Fecha"}>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        {fijo ? (
          <Field label="Cada cuánto">
            <Select value={cada} onChange={(e) => setCada(e.target.value as Cada)}>
              {(Object.keys(LABEL_CADA) as Cada[]).map((c) => (
                <option key={c} value={c}>
                  {LABEL_CADA[c]}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Categoría">
            <Select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaGasto)}
            >
              {CATEGORIAS_GASTO.map((c) => (
                <option key={c} value={c}>
                  {LABEL_CATEGORIA[c]}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      {fijo && (
        <Field label="Categoría">
          <Select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaGasto)}
          >
            {CATEGORIAS_GASTO.map((c) => (
              <option key={c} value={c}>
                {LABEL_CATEGORIA[c]}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="flex gap-2">
        <Button onClick={guardar}>Guardar</Button>
        <Button variant="outline" onClick={onCerrar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function GastosFijos({
  gastos,
  alMes,
  moneda,
  onGuardar,
  onBorrar,
}: {
  gastos: Gasto[];
  alMes: number;
  moneda: string;
  onGuardar: (g: Gasto) => void;
  onBorrar: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <Card
      title="Gastos fijos"
      subtitle={
        gastos.length
          ? `Te cuestan ${dinero(alMes, moneda)} al mes`
          : "Lo que pagas todos los meses, aunque no atiendas a nadie"
      }
      actions={
        <Button variant="outline" onClick={() => setAbierto(!abierto)}>
          {abierto ? "Cancelar" : "+ Gasto fijo"}
        </Button>
      }
    >
      {abierto && (
        <FormularioGasto fijo onGuardar={onGuardar} onCerrar={() => setAbierto(false)} />
      )}

      {!gastos.length && !abierto ? (
        <p className="text-sm text-slate-400">
          Se apuntan una vez y se cuentan solos cada mes. Son los que nadie se
          acuerda de teclear, y son los que están siempre.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {[...gastos]
            .sort((a, b) => porMes(b.importe, b.cada) - porMes(a.importe, a.cada))
            .map((g) => (
              <li key={g.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1 text-slate-800">{g.concepto}</span>
                <span className="text-xs text-slate-400">
                  {LABEL_CATEGORIA[g.categoria]}
                </span>
                <span className="tnum text-slate-700">
                  {dinero(g.importe, moneda)}
                  <span className="text-xs text-slate-400">
                    {" "}
                    / {g.cada === "año" ? "año" : g.cada}
                  </span>
                </span>
                {/*
                  Dar de baja, no borrar: borrarlo se lleva por delante los meses
                  en que sí se pagó y el flujo de caja del año pasado dejaría de
                  cuadrar.
                */}
                <button
                  onClick={() => onGuardar({ ...g, hasta: hoyIso() })}
                  className="text-xs text-slate-400 underline hover:text-slate-700"
                  title="Dejo de pagarlo: cuenta hasta este mes y ya no más"
                >
                  Dar de baja
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`¿Borrar «${g.concepto}»? Deja de contar también en los meses pasados.`))
                      onBorrar(g.id);
                  }}
                  className="text-xs text-rose-400 underline hover:text-rose-700"
                >
                  Borrar
                </button>
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}

function GastosSueltos({
  gastos,
  moneda,
  onGuardar,
  onBorrar,
}: {
  gastos: Gasto[];
  moneda: string;
  onGuardar: (g: Gasto) => void;
  onBorrar: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const sueltos = gastos.filter((g) => !g.cada).sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <Card
      title="Gastos sueltos"
      subtitle="Lo que pagas una vez: una báscula, un curso, la imprenta"
      actions={
        <Button variant="outline" onClick={() => setAbierto(!abierto)}>
          {abierto ? "Cancelar" : "+ Gasto"}
        </Button>
      }
    >
      {abierto && (
        <FormularioGasto
          fijo={false}
          onGuardar={onGuardar}
          onCerrar={() => setAbierto(false)}
        />
      )}

      {!sueltos.length && !abierto ? (
        <p className="text-sm text-slate-400">Todavía no has apuntado ninguno.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {sueltos.map((g) => (
            <li key={g.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-24 shrink-0 text-xs text-slate-400">{g.fecha}</span>
              <span className="flex-1 text-slate-800">{g.concepto}</span>
              <span className="text-xs text-slate-400">{LABEL_CATEGORIA[g.categoria]}</span>
              <span className="tnum text-slate-700">{dinero(g.importe, moneda)}</span>
              <button
                onClick={() => onBorrar(g.id)}
                className="text-xs text-rose-400 underline hover:text-rose-700"
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
