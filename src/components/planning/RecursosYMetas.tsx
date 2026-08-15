import { useState } from "react";
import type { Client, Meta } from "../../types/client";
import type { Recurso } from "../../types/recursos";
import { recursosVisibles } from "../../types/recursos";
import { Button, Card, Input } from "../common/ui";
import { uid, nowIso } from "../../utils/storage";

interface Props {
  client: Client;
  recursos: Recurso[];
  onChange: (patch: Partial<Client>) => void;
}

/**
 * QUÉ RECURSOS VE ESTA CLIENTA
 *
 * Los recursos se escriben una vez para toda la consulta, pero no se dan todos
 * el primer día: la guía de raciones al empezar, la de comer fuera cuando ya
 * hay costumbre. Aquí se abren de uno en uno.
 *
 * De entrada no ve ninguno. Es más trabajo, pero el error de dar de más no se
 * puede deshacer: ya lo ha visto.
 */
export function RecursosDeCliente({ client, recursos, onChange }: Props) {
  const lista = recursosVisibles(recursos);
  const dados = client.recursos ?? [];

  const alternar = (id: string) =>
    onChange({
      recursos: dados.includes(id)
        ? dados.filter((x) => x !== id)
        : [...dados, id],
    });

  if (!lista.length) {
    return (
      <Card title="Recursos para esta clienta">
        <p className="text-sm text-slate-500">
          Todavía no has escrito ninguno. Se crean en «Recursos», arriba, y
          desde aquí eliges cuáles ve cada persona.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Recursos para esta clienta"
      subtitle={`Ve ${dados.length} de ${lista.length}. Los que marques le aparecen en su pestaña «Recursos»`}
    >
      <ul className="space-y-1.5">
        {lista.map((r) => {
          const dado = dados.includes(r.id);
          return (
            <li key={r.id}>
              <label
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition ${
                  dado
                    ? "border-brand-300 bg-brand-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={dado}
                  onChange={() => alternar(r.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">
                    {r.titulo}
                  </span>
                  {r.descripcion && (
                    <span className="block truncate text-[11px] text-slate-500">
                      {r.descripcion}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/**
 * LAS METAS DIARIAS
 *
 * La comida es la mitad; la otra mitad es andar, beber agua y dormir. La
 * clienta las marca cada día y hacen racha propia.
 *
 * Pocas y concretas: el día se da por cerrado cuando están TODAS marcadas, así
 * que con seis metas nadie cierra un día nunca. Dos o tres.
 */
export function MetasDeCliente({
  client,
  onChange,
}: {
  client: Client;
  onChange: (p: Partial<Client>) => void;
}) {
  const metas = client.metas ?? [];
  const [texto, setTexto] = useState("");

  const guardar = (siguiente: Meta[]) => onChange({ metas: siguiente });

  const anadir = () => {
    const limpio = texto.trim();
    if (!limpio) return;
    guardar([
      ...metas,
      { id: uid("mt_"), texto: limpio, activa: true, createdAt: nowIso() },
    ]);
    setTexto("");
  };

  const activas = metas.filter((m) => m.activa).length;

  return (
    <Card
      title="Metas diarias"
      subtitle="Las marca ella cada día. Hacen racha aparte: un día de poca agua no rompe la de las comidas"
    >
      <div className="flex flex-wrap gap-2">
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && anadir()}
          placeholder="Beber 2 litros de agua"
          className="min-w-0 flex-1"
        />
        <Button onClick={anadir} disabled={!texto.trim()}>
          Añadir
        </Button>
      </div>

      {metas.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {metas.map((m) => (
            <li
              key={m.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                m.activa
                  ? "border-sky-200 bg-sky-50/50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  m.activa ? "text-slate-800" : "text-slate-400 line-through"
                }`}
              >
                {m.texto}
              </span>
              <button
                onClick={() =>
                  guardar(
                    metas.map((x) =>
                      x.id === m.id ? { ...x, activa: !x.activa } : x,
                    ),
                  )
                }
                className="shrink-0 rounded px-2 py-1 text-xs text-slate-500 hover:bg-white hover:text-slate-800"
              >
                {m.activa ? "Pausar" : "Reanudar"}
              </button>
              <button
                onClick={() => guardar(metas.filter((x) => x.id !== m.id))}
                className="shrink-0 rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}

      {/*
        Pausar en vez de borrar: borrar una meta se lleva por delante los días
        que ya estaban marcados con ella.
      */}
      {activas > 3 && (
        <p className="mt-2 text-[11px] leading-snug text-amber-700">
          Llevas {activas} metas activas. El día sólo cuenta cuando están todas
          marcadas, así que con muchas se vuelve inalcanzable — dos o tres
          funcionan mejor.
        </p>
      )}
    </Card>
  );
}
