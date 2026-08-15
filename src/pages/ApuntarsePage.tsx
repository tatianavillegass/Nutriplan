import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ACTIVITY_FACTORS } from "../data/activityFactors";
import {
  COMIDAS_POSIBLES,
  solicitudCompleta,
  type Solicitud,
} from "../types/solicitud";
import {
  enviarSolicitud,
  leerRetoPublico,
  type RetoPublico,
} from "../utils/solicitudes";
import { diasEntre } from "../utils/retos";
import { uid, nowIso } from "../utils/storage";

const hoyIso = () => new Date().toISOString().slice(0, 10);

const fechaLarga = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
};

/** Campos sueltos, sin depender de la interfaz de la app: aquí no hay sesión. */
const campo =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

function Bloque({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
        {titulo}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/**
 * APUNTARSE A UN RETO
 *
 * La única pantalla de la app que se ve sin cuenta. Se llega desde Stripe al
 * terminar el pago, así que quien está aquí ya ha pagado — el texto lo dice, y
 * eso es la mitad de la tranquilidad de rellenar un formulario.
 *
 * Cuatro bloques cortos, sin pasos ni barra de progreso: en un móvil se bajan
 * de un tirón y no dan sensación de trámite. Lo único obligatorio es lo que
 * hace falta para calcular; cada campo obligatorio de más es gente que se va.
 */
export function ApuntarsePage() {
  const { retoId = "" } = useParams();
  const [reto, setReto] = useState<RetoPublico | null | undefined>(undefined);
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [f, setF] = useState<Partial<Solicitud>>({
    sexo: "mujer",
    comidasDia: 4,
    activityFactorId: ACTIVITY_FACTORS[2]?.id ?? ACTIVITY_FACTORS[0].id,
    objetivo: "perder_peso",
    embarazoLactancia: false,
    antecedenteTca: false,
  });

  useEffect(() => {
    let vivo = true;
    void leerRetoPublico(retoId).then((r) => vivo && setReto(r ?? null));
    return () => {
      vivo = false;
    };
  }, [retoId]);

  const editar = (patch: Partial<Solicitud>) => {
    setF((x) => ({ ...x, ...patch }));
    setError(null);
  };

  const numero = (v: string) => (v === "" ? undefined : Number(v));

  const faltan = useMemo(
    () => (reto ? Math.max(0, diasEntre(hoyIso(), reto.fechaInicio)) : 0),
    [reto],
  );

  const enviar = async () => {
    if (!solicitudCompleta(f) || !reto) return;
    setEnviando(true);
    const solicitud: Solicitud = {
      ...(f as Solicitud),
      id: uid("sl_"),
      retoId: reto.id,
      creada: nowIso(),
      nombre: f.nombre!.trim(),
      email: f.email!.trim(),
    };
    const r = await enviarSolicitud(solicitud);
    setEnviando(false);
    if (r.ok) setEnviada(true);
    else
      setError(
        r.error ?? "No se pudo guardar. Inténtalo otra vez en un momento.",
      );
  };

  // ── Cargando o enlace que no existe ─────────────────
  if (reto === undefined) {
    return (
      <p className="py-16 text-center text-sm text-slate-400">
        Abriendo el reto…
      </p>
    );
  }

  if (reto === null) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="text-lg font-semibold text-brand-900">
          Este enlace ya no vale
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Puede que el reto haya cambiado de fecha o que el enlace esté
          incompleto. Escríbele a tu nutricionista y te pasa el bueno.
        </p>
      </div>
    );
  }

  // ── Ya enviada: la cuenta atrás ─────────────────────
  if (enviada) {
    return (
      <div className="mx-auto max-w-md px-5 py-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
          ✓
        </div>
        <h1 className="text-lg font-semibold text-brand-900">
          Estás dentro, {f.nombre?.split(" ")[0]}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          Ahora se preparan tus porciones. Te avisamos por correo cuando tu plan
          esté listo.
        </p>

        <div className="mt-6 rounded-2xl bg-brand-50 px-5 py-6">
          <p className="tnum text-5xl leading-none font-semibold text-brand-900">
            {faltan}
          </p>
          <p className="mt-1 text-sm text-brand-700">
            {faltan === 1 ? "día para empezar" : "días para empezar"}
          </p>
          <p className="mt-2.5 text-xs text-brand-700">
            Arrancamos el {fechaLarga(reto.fechaInicio)}
          </p>
        </div>

        <div className="mt-5 border-t border-slate-200 pt-4 text-left">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
            Mientras tanto
          </p>
          <p className="mb-1.5 text-sm leading-snug text-slate-600">
            Hazte una foto y mídete la cintura el primer día: es con lo que vas
            a comparar.
          </p>
          <p className="text-sm leading-snug text-slate-600">
            El acceso a la app te llega unos días antes de empezar, al correo
            que has puesto.
          </p>
        </div>
      </div>
    );
  }

  // ── El formulario ───────────────────────────────────
  const listo = solicitudCompleta(f);

  return (
    <div className="mx-auto max-w-md px-5 pb-12">
      <header className="-mx-5 mb-1 bg-brand-700 px-5 py-4">
        <p className="text-[11px] tracking-wide text-brand-100 uppercase">
          Pago confirmado
        </p>
        <h1 className="mt-0.5 text-lg font-semibold text-white">
          {reto.nombre}
        </h1>
        <p className="mt-1 text-sm text-brand-100">
          Empieza el {fechaLarga(reto.fechaInicio)} · {reto.dias} días
        </p>
      </header>

      <p className="mt-4 text-sm leading-relaxed text-slate-600">
        Ya estás dentro. Sólo falta esto para calcular tus porciones — dos
        minutos.
      </p>

      <Bloque titulo="Quién eres">
        <input
          className={campo}
          placeholder="Nombre y apellidos"
          value={f.nombre ?? ""}
          onChange={(e) => editar({ nombre: e.target.value })}
        />
        <input
          className={campo}
          type="email"
          inputMode="email"
          placeholder="tu@correo.com"
          value={f.email ?? ""}
          onChange={(e) => editar({ email: e.target.value })}
        />
        <input
          className={campo}
          type="tel"
          placeholder="Teléfono (opcional)"
          value={f.telefono ?? ""}
          onChange={(e) => editar({ telefono: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">
              Fecha de nacimiento
            </span>
            <input
              className={campo}
              type="date"
              value={f.fechaNacimiento ?? ""}
              onChange={(e) => editar({ fechaNacimiento: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">Sexo</span>
            <select
              className={campo}
              value={f.sexo}
              onChange={(e) =>
                editar({ sexo: e.target.value as Solicitud["sexo"] })
              }
            >
              <option value="mujer">Mujer</option>
              <option value="hombre">Hombre</option>
            </select>
          </label>
        </div>
      </Bloque>

      <Bloque titulo="Tu cuerpo">
        <div className="grid grid-cols-2 gap-2">
          <input
            className={campo}
            type="number"
            inputMode="decimal"
            placeholder="Peso (kg)"
            value={f.peso ?? ""}
            onChange={(e) => editar({ peso: numero(e.target.value) })}
          />
          <input
            className={campo}
            type="number"
            inputMode="numeric"
            placeholder="Altura (cm)"
            value={f.altura ?? ""}
            onChange={(e) => editar({ altura: numero(e.target.value) })}
          />
          <input
            className={campo}
            type="number"
            inputMode="decimal"
            placeholder="Cintura (cm)"
            value={f.cintura ?? ""}
            onChange={(e) => editar({ cintura: numero(e.target.value) })}
          />
          <input
            className={campo}
            type="number"
            inputMode="decimal"
            placeholder="% grasa"
            value={f.grasaPct ?? ""}
            onChange={(e) => editar({ grasaPct: numero(e.target.value) })}
          />
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          La cintura, con un metro de costura a la altura del ombligo y sin
          apretar. El porcentaje de grasa sólo si tienes una báscula que lo mida
          — si no, déjalo en blanco.
        </p>
      </Bloque>

      <Bloque titulo="Tu día">
        <p className="text-sm text-slate-600">¿Cuántas veces comes al día?</p>
        <div className="flex gap-1.5">
          {COMIDAS_POSIBLES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => editar({ comidasDia: n })}
              aria-pressed={f.comidasDia === n}
              className={`flex-1 rounded-lg border py-2.5 text-base transition ${
                f.comidasDia === n
                  ? "border-brand-600 bg-brand-50 font-medium text-brand-900"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          Contando todo lo que comes sentada: desayuno, media mañana, comida,
          merienda, cena.
        </p>

        <label className="block pt-1">
          <span className="mb-1 block text-sm text-slate-600">
            ¿Cuánto te mueves?
          </span>
          <select
            className={campo}
            value={f.activityFactorId}
            onChange={(e) => editar({ activityFactorId: e.target.value })}
          >
            {ACTIVITY_FACTORS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            ¿Qué buscas con el reto?
          </span>
          <select
            className={campo}
            value={f.objetivo}
            onChange={(e) =>
              editar({ objetivo: e.target.value as Solicitud["objetivo"] })
            }
          >
            <option value="perder_peso">Bajar grasa</option>
            <option value="mantenimiento">Mantenerme y comer mejor</option>
            <option value="ganancia_muscular">Ganar músculo</option>
          </select>
        </label>
      </Bloque>

      <Bloque titulo="Antes de empezar">
        <label className="flex items-start gap-2.5 text-sm leading-snug text-slate-600">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
            checked={!!f.embarazoLactancia}
            onChange={(e) => editar({ embarazoLactancia: e.target.checked })}
          />
          Estoy embarazada o dando el pecho
        </label>
        <label className="flex items-start gap-2.5 text-sm leading-snug text-slate-600">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
            checked={!!f.antecedenteTca}
            onChange={(e) => editar({ antecedenteTca: e.target.checked })}
          />
          Tengo o he tenido un trastorno de la conducta alimentaria
        </label>
        <input
          className={campo}
          placeholder="Alergias, patologías, medicación"
          value={f.salud ?? ""}
          onChange={(e) => editar({ salud: e.target.value })}
        />
        <input
          className={campo}
          placeholder="Alimentos que no comes"
          value={f.noComo ?? ""}
          onChange={(e) => editar({ noComo: e.target.value })}
        />
        <p className="text-xs leading-relaxed text-slate-500">
          Si marcas alguna de las dos primeras no pasa nada: hablamos antes de
          empezar y vemos qué te viene bien.
        </p>
      </Bloque>

      {error && (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error} Si sigue fallando, escríbenos: tu pago está hecho y no se
          pierde.
        </p>
      )}

      <button
        onClick={() => void enviar()}
        disabled={!listo || enviando}
        className="mt-6 w-full rounded-xl bg-brand-700 py-3.5 text-base font-medium text-white transition disabled:opacity-40"
      >
        {enviando ? "Guardando…" : "Enviar y ver la cuenta atrás"}
      </button>

      {!listo && (
        <p className="mt-2 text-center text-xs text-slate-400">
          Faltan el nombre, el correo, la fecha de nacimiento, el peso y la
          altura.
        </p>
      )}
    </div>
  );
}
