import { useMemo } from "react";
import type { Client } from "../../types/client";
import { edadDe, metasActivas } from "../../types/client";
import type { DayType } from "../../types/plan";
import type { RegistroDia } from "../../types/diary";
import type { Medicion } from "../../types/anthropometry";
import { calcComposicion, ordenarMediciones } from "../../utils/anthropometry";
import {
  calcularRacha,
  calcularRachaMetas,
  diaCerrado,
  diaDeMetasCerrado,
  diasDelMes,
  inicioDeMes,
  libresDesde,
  type DiaDelMes,
} from "../../utils/racha";
import { Card, fmt } from "../common/ui";

interface Props {
  client: Client;
  dayTypes: DayType[];
  registros: RegistroDia[];
  mediciones: Medicion[];
  /** Hoy, AAAA-MM-DD. Se pasa para poder probarlo. */
  hoy?: string;
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const diaMes = (iso: string) =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]?.slice(0, 3)}`;

/** Los días del mes en círculos, igual que los ve la clienta. */
function Circulos({ dias, tono }: { dias: DiaDelMes[]; tono: string }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {dias.map((d) => (
        <span
          key={d.fecha}
          title={diaMes(d.fecha)}
          className={`flex h-4 w-4 items-center justify-center rounded-full border text-[8px] ${
            d.cerrado
              ? tono
              : "border-dashed border-slate-200 bg-white text-transparent"
          }`}
        >
          ✓
        </span>
      ))}
    </div>
  );
}

/** Un número con su cambio, cuando hay dos mediciones que comparar. */
function Fila({
  etiqueta,
  valor,
  unidad,
  antes,
}: {
  etiqueta: string;
  valor?: number;
  unidad: string;
  antes?: number;
}) {
  if (valor == null) return null;
  const cambio = antes != null ? valor - antes : undefined;
  const hay = cambio != null && Math.abs(cambio) >= 0.05;

  return (
    <li className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs text-slate-600">{etiqueta}</span>
      <span className="tnum shrink-0 text-sm font-medium text-brand-900">
        {fmt(valor, 1)} {unidad}
        {hay && (
          <span
            className={`ml-1.5 text-[11px] font-normal ${cambio > 0 ? "text-amber-700" : "text-emerald-700"}`}
          >
            {cambio > 0 ? "+" : "−"}
            {fmt(Math.abs(cambio), 1)}
          </span>
        )}
      </span>
    </li>
  );
}

/**
 * EL SEGUIMIENTO, DE UN VISTAZO
 *
 * Lo que hace falta antes de una consulta: si aparece, si cumple sus metas,
 * cuántas veces ha comido fuera y qué ha escrito de esas veces, y cómo se ha
 * movido su cuerpo.
 *
 * De la composición se enseña **lo que haya**: hay clientas con perfil ISAK
 * completo, otras con la báscula de bioimpedancia y otras sólo con el peso.
 * Pedir siempre lo mismo llenaría la pantalla de huecos.
 *
 * El % de grasa de los pliegues y el de la báscula van en filas distintas a
 * propósito: cada aparato usa su fórmula y juntarlos daría un número que no es
 * de nadie.
 */
export function SeguimientoResumen({
  client,
  dayTypes,
  registros,
  mediciones,
  hoy,
}: Props) {
  const fecha = hoy ?? new Date().toISOString().slice(0, 10);
  const metas = useMemo(() => metasActivas(client), [client]);

  const racha = useMemo(
    () => calcularRacha(registros, dayTypes, fecha),
    [registros, dayTypes, fecha],
  );
  const rachaMetas = useMemo(
    () => calcularRachaMetas(registros, metas, fecha),
    [registros, metas, fecha],
  );

  const diasComidas = useMemo(
    () =>
      diasDelMes(registros, fecha, (r) =>
        diaCerrado(
          r,
          dayTypes.find((d) => d.id === r?.dayTypeId) ?? dayTypes[0],
        ),
      ),
    [registros, fecha, dayTypes],
  );
  const diasMetas = useMemo(
    () => diasDelMes(registros, fecha, (r) => diaDeMetasCerrado(r, metas)),
    [registros, fecha, metas],
  );

  const libres = useMemo(
    () => libresDesde(registros, inicioDeMes(fecha)),
    [registros, fecha],
  );

  const cuerpo = useMemo(() => {
    const orden = ordenarMediciones(mediciones);
    const ultima = orden[orden.length - 1];
    const previa = orden[orden.length - 2];
    if (!ultima) return undefined;

    const de = (m?: Medicion) =>
      m ? calcComposicion(m, client.sexo, edadDe(client)) : undefined;
    const formula = client.formulaGrasa ?? "faulkner";
    const c = de(ultima)!;
    const p = de(previa);

    return {
      fecha: ultima.fecha.slice(0, 10),
      fechaAntes: previa?.fecha.slice(0, 10),
      peso: ultima.peso,
      pesoAntes: previa?.peso,
      grasaPliegues: c.grasaPct[formula],
      grasaPlieguesAntes: p?.grasaPct[formula],
      musculoLee: c.masaMuscularKg,
      musculoLeeAntes: p?.masaMuscularKg,
      bio: ultima.bioimpedancia,
      bioAntes: previa?.bioimpedancia,
      cintura: ultima.perimetros.cintura,
      cinturaAntes: previa?.perimetros.cintura,
      cadera: ultima.perimetros.cadera,
      caderaAntes: previa?.perimetros.cadera,
      icc: c.ratioCinturaCadera,
      iccAntes: p?.ratioCinturaCadera,
    };
  }, [mediciones, client]);

  const diasConRegistro = registros.filter((r) =>
    r.fecha.startsWith(fecha.slice(0, 7)),
  ).length;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ── Constancia ─────────────────────────────────── */}
      <Card
        title="Constancia"
        subtitle={`${diasComidas.filter((d) => d.cerrado).length} días cerrados este mes · ${diasConRegistro} con algo marcado`}
      >
        <p className="tnum text-2xl font-semibold text-brand-900">
          {racha.actual}
          <span className="ml-1.5 text-sm font-normal text-brand-700">
            {racha.actual === 1 ? "día seguido" : "días seguidos"}
          </span>
        </p>
        <Circulos
          dias={diasComidas}
          tono="border-brand-300 bg-brand-600 text-white"
        />
        <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
          Un día se cierra con todas sus comidas marcadas. Una comida libre
          cierra igual que una hecha
          {racha.mejor > racha.actual
            ? `. Su mejor racha son ${racha.mejor} días`
            : ""}
          .
        </p>
      </Card>

      {/* ── Metas ──────────────────────────────────────── */}
      <Card
        title="Metas diarias"
        subtitle={
          metas.length
            ? metas.map((m) => m.texto).join(" · ")
            : "No le has puesto ninguna todavía"
        }
      >
        {metas.length ? (
          <>
            <p className="tnum text-2xl font-semibold text-sky-800">
              {rachaMetas.actual}
              <span className="ml-1.5 text-sm font-normal text-sky-700">
                {rachaMetas.actual === 1 ? "día seguido" : "días seguidos"}
              </span>
            </p>
            <Circulos
              dias={diasMetas}
              tono="border-sky-300 bg-sky-500 text-white"
            />
            <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
              {diasMetas.filter((d) => d.cerrado).length} días con todas
              marcadas este mes. Van aparte de las comidas.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            Se ponen en la pestaña de entrega. Las marca ella cada día y hacen
            racha aparte.
          </p>
        )}
      </Card>

      {/* ── Comidas fuera ──────────────────────────────── */}
      <Card
        title="Comidas fuera"
        subtitle={`${libres.total} este mes${libres.total ? ` · ${(libres.total / Math.max(1, Number(fecha.slice(8, 10)) / 7)).toFixed(1)} por semana` : ""}`}
      >
        {libres.total === 0 ? (
          <p className="text-sm text-slate-500">Ninguna este mes.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {libres.detalle.slice(0, 8).map((d, i) => (
              <li
                key={`${d.fecha}-${d.mealId}-${i}`}
                className="flex gap-3 py-1.5"
              >
                <span className="tnum w-14 shrink-0 text-xs text-slate-400">
                  {diaMes(d.fecha)}
                </span>
                <span className="w-20 shrink-0 text-xs text-slate-600 capitalize">
                  {d.mealId}
                </span>
                <span className="min-w-0 flex-1 text-xs text-slate-700">
                  {d.nota ? (
                    `«${d.nota}»`
                  ) : (
                    <span className="text-slate-300">sin nota</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          No se miden ni restan del plan: el dato de consulta es la frecuencia y
          lo que escriba.
        </p>
      </Card>

      {/* ── Composición ────────────────────────────────── */}
      <Card
        title="Composición"
        subtitle={
          cuerpo
            ? cuerpo.fechaAntes
              ? `${diaMes(cuerpo.fecha)}, comparado con ${diaMes(cuerpo.fechaAntes)}`
              : `${diaMes(cuerpo.fecha)} · primera medición`
            : "Sin mediciones todavía"
        }
      >
        {cuerpo ? (
          <ul className="divide-y divide-slate-100">
            <Fila
              etiqueta="Peso"
              valor={cuerpo.peso}
              unidad="kg"
              antes={cuerpo.pesoAntes}
            />
            <Fila
              etiqueta="Grasa (pliegues)"
              valor={cuerpo.grasaPliegues}
              unidad="%"
              antes={cuerpo.grasaPlieguesAntes}
            />
            <Fila
              etiqueta="Músculo (Lee)"
              valor={cuerpo.musculoLee}
              unidad="kg"
              antes={cuerpo.musculoLeeAntes}
            />
            <Fila
              etiqueta="Grasa (báscula)"
              valor={cuerpo.bio?.grasaPct}
              unidad="%"
              antes={cuerpo.bioAntes?.grasaPct}
            />
            <Fila
              etiqueta="Músculo (báscula)"
              valor={cuerpo.bio?.musculoPct}
              unidad="%"
              antes={cuerpo.bioAntes?.musculoPct}
            />
            <Fila
              etiqueta="Agua (báscula)"
              valor={cuerpo.bio?.aguaPct}
              unidad="%"
              antes={cuerpo.bioAntes?.aguaPct}
            />
            <Fila
              etiqueta="Grasa visceral"
              valor={cuerpo.bio?.visceral}
              unidad=""
              antes={cuerpo.bioAntes?.visceral}
            />
            <Fila
              etiqueta="Cintura"
              valor={cuerpo.cintura}
              unidad="cm"
              antes={cuerpo.cinturaAntes}
            />
            <Fila
              etiqueta="Cadera"
              valor={cuerpo.cadera}
              unidad="cm"
              antes={cuerpo.caderaAntes}
            />
            <Fila
              etiqueta="Índice cintura/cadera"
              valor={cuerpo.icc}
              unidad=""
              antes={cuerpo.iccAntes}
            />
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            En cuanto le tomes la primera medición aparece aquí, con lo que
            hayas medido.
          </p>
        )}
      </Card>
    </div>
  );
}
