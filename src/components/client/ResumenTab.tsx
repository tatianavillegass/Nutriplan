import { useMemo } from "react";
import type { Client } from "../../types/client";
import { edadDe } from "../../types/client";
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
  type Racha,
} from "../../utils/racha";
import { metasActivas } from "../../types/client";
import { fmt } from "../common/ui";

interface Props {
  client: Client;
  dayTypes: DayType[];
  registros: RegistroDia[];
  mediciones: Medicion[];
  /** Hoy, en formato AAAA-MM-DD. */
  fecha: string;
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
  `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}`;

/**
 * UN NÚMERO Y SU CAMBIO
 *
 * El cambio va con signo y en el color de la dirección, no del juicio: bajar
 * de peso no es «bueno» por sí solo. Verde para lo que se mueve hacia el
 * objetivo lo decidiría la app por ella, y eso no le toca.
 */
function Dato({
  etiqueta,
  valor,
  unidad,
  cambio,
}: {
  etiqueta: string;
  valor?: number;
  unidad: string;
  cambio?: number;
}) {
  if (valor == null) return null;
  const hayCambio = cambio != null && Math.abs(cambio) >= 0.05;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">
        {etiqueta}
      </p>
      <p className="tnum mt-0.5 text-xl font-semibold text-brand-900">
        {fmt(valor, 1)}
        <span className="ml-1 text-sm font-normal text-slate-400">
          {unidad}
        </span>
      </p>
      {hayCambio && (
        <p className="tnum mt-0.5 text-[11px] text-slate-500">
          {cambio > 0 ? "▲" : "▼"} {fmt(Math.abs(cambio), 1)} {unidad} desde la
          anterior
        </p>
      )}
    </div>
  );
}

/**
 * LOS DÍAS DEL MES, EN CÍRCULOS
 *
 * Un círculo por día, lleno cuando está cumplido. Sólo hasta hoy: pintar el
 * resto del mes vacío por delante se lee como deuda, y todavía no ha pasado
 * nada.
 */
function CirculosDelMes({
  dias,
  tono,
}: {
  dias: DiaDelMes[];
  tono: { lleno: string; vacio: string };
}) {
  if (!dias.length) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {dias.map((d) => (
        <span
          key={d.fecha}
          title={`Día ${Number(d.fecha.slice(8, 10))}`}
          className={`flex h-5 w-5 items-center justify-center rounded-full border text-[9px] ${
            d.cerrado ? tono.lleno : tono.vacio
          }`}
        >
          {d.cerrado ? "✓" : ""}
        </span>
      ))}
    </div>
  );
}

/** La tarjeta de una racha: el número grande, la frase y los círculos. */
function TarjetaDeRacha({
  titulo,
  racha,
  dias,
  tono,
  frase,
}: {
  titulo: string;
  racha: Racha;
  dias: DiaDelMes[];
  tono: { caja: string; texto: string; lleno: string; vacio: string };
  frase: string;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold tracking-widest text-brand-800 uppercase">
        {titulo}
      </h2>
      <div className={`rounded-xl px-4 py-3 ${tono.caja}`}>
        <p className={`tnum text-2xl font-semibold ${tono.texto}`}>
          {racha.actual}{" "}
          <span className="text-sm font-normal">
            {racha.actual === 1 ? "día seguido" : "días seguidos"}
          </span>
        </p>
        <p className="mt-0.5 text-xs leading-snug text-slate-600">{frase}</p>
        <CirculosDelMes dias={dias} tono={tono} />
        {racha.mejor > racha.actual && (
          <p className={`tnum mt-1.5 text-[11px] ${tono.texto}`}>
            Tu mejor racha son {racha.mejor} días.
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * RESUMEN DE LA CLIENTA
 *
 * Lo que quiere ver cuando entra y no está comiendo: cómo va su cuerpo, cuánto
 * lleva siendo constante y cuántas veces ha comido fuera este mes.
 *
 * Deliberadamente NO hay porcentaje de adherencia ni nota del día. El número
 * que resume «cómo lo estás haciendo» invita a compararse consigo misma cada
 * día, y eso no ayuda a nadie a comer mejor. La racha cuenta presencia y las
 * comidas fuera se cuentan sin adjetivos.
 */
export function ResumenTab({
  client,
  dayTypes,
  registros,
  mediciones,
  fecha,
}: Props) {
  const propias = useMemo(() => ordenarMediciones(mediciones), [mediciones]);
  const formula = client.formulaGrasa ?? "faulkner";

  const composicion = useMemo(() => {
    const ultima = propias[propias.length - 1];
    const previa = propias[propias.length - 2];
    if (!ultima) return undefined;
    const de = (m: Medicion) => calcComposicion(m, client.sexo, edadDe(client));
    const hoy = de(ultima);
    const antes = previa ? de(previa) : undefined;
    return {
      fecha: ultima.fecha.slice(0, 10),
      peso: ultima.peso,
      pesoAntes: previa?.peso,
      grasa: hoy.grasaPct[formula],
      grasaAntes: antes?.grasaPct[formula],
    };
  }, [propias, client, formula]);

  const racha = useMemo(
    () => calcularRacha(registros, dayTypes, fecha),
    [registros, dayTypes, fecha],
  );

  const libres = useMemo(
    () => libresDesde(registros, inicioDeMes(fecha)),
    [registros, fecha],
  );

  /** Las metas que hay que marcar hoy: las jubiladas ya no cuentan. */
  const metas = useMemo(() => metasActivas(client), [client]);

  const rachaMetas = useMemo(
    () => calcularRachaMetas(registros, metas, fecha),
    [registros, metas, fecha],
  );

  /**
   * Un círculo por día del mes hasta hoy. El tipo de día que se mira es el que
   * la clienta tenía puesto ese día, no el de hoy.
   */
  const diasComidas = useMemo(
    () =>
      diasDelMes(registros, fecha, (r) =>
        diaCerrado(r, dayTypes.find((d) => d.id === r?.dayTypeId) ?? dayTypes[0]),
      ),
    [registros, fecha, dayTypes],
  );

  const diasMetas = useMemo(
    () => diasDelMes(registros, fecha, (r) => diaDeMetasCerrado(r, metas)),
    [registros, fecha, metas],
  );

  const restaDe = (a?: number, b?: number) =>
    a != null && b != null ? a - b : undefined;

  return (
    <div className="space-y-5">
      {/* ── Composición corporal ───────────────────────── */}
      <section>
        <h2 className="mb-2 text-sm font-bold tracking-widest text-brand-800 uppercase">
          Tu composición
        </h2>

        {composicion ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <Dato
                etiqueta="Peso"
                valor={composicion.peso}
                unidad="kg"
                cambio={restaDe(composicion.peso, composicion.pesoAntes)}
              />
              <Dato
                etiqueta="Grasa corporal"
                valor={composicion.grasa}
                unidad="%"
                cambio={restaDe(composicion.grasa, composicion.grasaAntes)}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              De tu última medición, el {diaMes(composicion.fecha)}. Entre una y
              otra el cuerpo se mueve por muchas cosas —agua, sueño, el momento
              del ciclo—, así que lo que dice algo es la dirección de varias, no
              el salto de una.
            </p>
          </>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            Todavía no tienes mediciones. Aparecerán aquí en cuanto tu
            nutricionista te tome la primera.
          </p>
        )}
      </section>

      {/* ── Racha de comidas ───────────────────────────── */}
      <TarjetaDeRacha
        titulo="Tu constancia"
        racha={racha}
        dias={diasComidas}
        tono={{
          caja: "border border-brand-200 bg-brand-50/60",
          texto: "text-brand-800",
          lleno: "border-brand-300 bg-brand-600 text-white",
          vacio: "border-dashed border-brand-200 bg-white",
        }}
        frase={
          racha.actual === 0
            ? "Un día cuenta cuando marcas todas tus comidas. Hoy puedes empezar."
            : racha.hoyCerrado
              ? "Hoy ya está completo. Un día cuenta con todas las comidas marcadas — comer fuera también cuenta."
              : "Hoy todavía lo tienes a medias, y no pasa nada: se suma en cuanto lo cierres."
        }
      />

      {/*
        ── Racha de metas ───────────────────────────────
        Va aparte de la de comidas a propósito: un día de poca agua no puede
        tirar por tierra veinte días de comer bien, ni al revés.
      */}
      {metas.length > 0 && (
        <TarjetaDeRacha
          titulo="Tus metas"
          racha={rachaMetas}
          dias={diasMetas}
          tono={{
            caja: "border border-sky-200 bg-sky-50/60",
            texto: "text-sky-800",
            lleno: "border-sky-300 bg-sky-500 text-white",
            vacio: "border-dashed border-sky-200 bg-white",
          }}
          frase={
            rachaMetas.actual === 0
              ? `Un día cuenta con ${metas.length === 1 ? "tu meta marcada" : `tus ${metas.length} metas marcadas`}. Van por su cuenta: no tocan las comidas.`
              : rachaMetas.hoyCerrado
                ? "Hoy están todas. Esta racha va por su cuenta: no toca la de las comidas."
                : "Todavía te queda alguna por marcar hoy."
          }
        />
      )}

      {/* ── Comidas fuera ──────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-sm font-bold tracking-widest text-brand-800 uppercase">
          Comidas fuera este mes
        </h2>
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 px-4 py-3">
          {/*
            Círculos, no una lista de calorías: lo que informa es cuántas veces,
            no cuánto pesaba cada plato. Ocho huecos, que es más o menos dos por
            semana; si se pasa, se siguen pintando y ya está.
          */}
          <div className="flex flex-wrap items-center gap-1.5">
            {Array.from({ length: Math.max(8, libres.total) }).map((_, i) => (
              <span
                key={i}
                aria-hidden
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${
                  i < libres.total
                    ? "border-violet-300 bg-violet-500 text-white"
                    : "border-dashed border-violet-200 bg-white"
                }`}
              >
                {i < libres.total ? "✓" : ""}
              </span>
            ))}
          </div>

          <p className="tnum mt-2 text-sm font-medium text-violet-900">
            {libres.total === 0
              ? "Ninguna todavía"
              : libres.total === 1
                ? "1 comida fuera"
                : `${libres.total} comidas fuera`}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
            No se miden ni restan de nada. Están aquí porque la frecuencia es lo
            que sirve para hablarlo en consulta.
          </p>

          {libres.detalle.some((d) => d.nota) && (
            <ul className="mt-2 space-y-0.5">
              {libres.detalle
                .filter((d) => d.nota)
                .slice(0, 4)
                .map((d, i) => (
                  <li
                    key={`${d.fecha}-${d.mealId}-${i}`}
                    className="text-[11px] text-slate-600"
                  >
                    {diaMes(d.fecha)} · «{d.nota}»
                  </li>
                ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
