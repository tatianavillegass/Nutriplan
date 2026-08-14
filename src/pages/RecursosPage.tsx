import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { PhotoUpload } from "../components/common/PhotoUpload";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
} from "../components/common/ui";
import { recursoUtil, recursosVisibles, type Recurso } from "../types/recursos";
import { uid, nowIso } from "../utils/storage";

const VACIO = (orden: number): Recurso => ({
  id: uid("rc_"),
  titulo: "",
  descripcion: "",
  url: "",
  imagen: undefined,
  orden,
  createdAt: nowIso(),
});

/**
 * RECURSOS PARA TODAS LAS CLIENTAS
 *
 * Se escriben una vez y salen en la pestaña «Recursos» del perfil de cualquier
 * clienta. No van por persona a propósito: la guía de raciones o cómo leer una
 * etiqueta valen para todas, y mantener una lista distinta por clienta es
 * trabajo que no paga nadie.
 */
export function RecursosPage() {
  const recursos = useAppStore((s) => s.recursos);
  const upsertRecurso = useAppStore((s) => s.upsertRecurso);
  const borrarRecurso = useAppStore((s) => s.borrarRecurso);
  const moverRecurso = useAppStore((s) => s.moverRecurso);

  const lista = recursosVisibles(recursos);
  const [borrador, setBorrador] = useState<Recurso | null>(null);

  const editar = (patch: Partial<Recurso>) =>
    setBorrador((b) => (b ? { ...b, ...patch } : b));

  const guardar = () => {
    if (!borrador || !recursoUtil(borrador)) return;
    upsertRecurso({
      ...borrador,
      titulo: borrador.titulo.trim(),
      descripcion: borrador.descripcion?.trim() || undefined,
      url: borrador.url?.trim() || undefined,
    });
    setBorrador(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-900">
            Recursos
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Lo que quieres tener a mano en el perfil de tus clientas: la guía de
            raciones, marcas que recomiendas, cómo leer una etiqueta. Lo ven
            todas.
          </p>
        </div>
        {!borrador && (
          <Button onClick={() => setBorrador(VACIO(lista.length))}>
            + Añadir recurso
          </Button>
        )}
      </div>

      {borrador && (
        <Card>
          <div className="space-y-3">
            <Field label="Título">
              <Input
                value={borrador.titulo}
                onChange={(e) => editar({ titulo: e.target.value })}
                placeholder="Guía visual de raciones"
                className="w-full"
                autoFocus
              />
            </Field>

            <Field label="Para qué sirve (opcional)">
              <textarea
                value={borrador.descripcion ?? ""}
                onChange={(e) => editar({ descripcion: e.target.value })}
                placeholder="Cómo calcular una porción con la mano cuando no tienes báscula."
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              />
            </Field>

            <Field label="Enlace (opcional)">
              <Input
                value={borrador.url ?? ""}
                onChange={(e) => editar({ url: e.target.value })}
                placeholder="https://…"
                className="w-full"
              />
            </Field>

            <PhotoUpload
              value={borrador.imagen}
              onChange={(imagen) => editar({ imagen })}
              label="Imagen (opcional)"
            />

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setBorrador(null)}>
                Cancelar
              </Button>
              <Button onClick={guardar} disabled={!recursoUtil(borrador)}>
                Guardar recurso
              </Button>
            </div>

            {!recursoUtil(borrador) && (
              <p className="text-right text-[11px] text-slate-400">
                Hace falta un título y algo más: texto, enlace o imagen.
              </p>
            )}
          </div>
        </Card>
      )}

      {!lista.length && !borrador ? (
        <EmptyState title="Todavía no hay recursos">
          Lo que pongas aquí aparece en la pestaña «Recursos» del perfil de
          todas tus clientas.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {lista.map((r, i) => (
            <li
              key={r.id}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              {r.imagen && (
                <img
                  src={r.imagen}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-brand-900">
                  {r.titulo}
                </p>
                {r.descripcion && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                    {r.descripcion}
                  </p>
                )}
                {r.url && (
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">
                    {r.url}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => moverRecurso(r.id, -1)}
                  disabled={i === 0}
                  className="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                  aria-label={`Subir ${r.titulo}`}
                >
                  ↑
                </button>
                <button
                  onClick={() => moverRecurso(r.id, 1)}
                  disabled={i === lista.length - 1}
                  className="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                  aria-label={`Bajar ${r.titulo}`}
                >
                  ↓
                </button>
                <button
                  onClick={() => setBorrador(r)}
                  className="rounded px-2 py-1 text-xs text-brand-700 hover:bg-brand-50"
                >
                  Editar
                </button>
                <button
                  onClick={() => borrarRecurso(r.id)}
                  className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                >
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
