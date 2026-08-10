import type { User } from '@supabase/supabase-js';
import { nube } from './supabase';
import type { Client } from '../types/client';
import type { Plan } from '../types/plan';
import type { Receta } from '../types/recipe';
import type { Alimento } from '../types/food';
import type { Medicion } from '../types/anthropometry';
import type { RegistroDia } from '../types/diary';
import type { PlantillaDespensa, PlantillaDia } from './plantillas';

/**
 * SUBIR Y BAJAR
 *
 * La app sigue trabajando en memoria como siempre; esto sólo traduce ese
 * estado a filas y al revés.
 *
 * El reparto es el que dicta quién puede ver qué:
 *
 *   nutricionistas → lo que comparte con todos sus clientes
 *                    (recetas, catálogo de alimentos, plantillas)
 *   clientes       → una fila por persona, con su ficha, sus planes y
 *                    sus mediciones. Es lo que baja el cliente al entrar.
 *   registros      → lo que el cliente marca cada día. Es el único sitio
 *                    donde escribe él, y de aquí sale el seguimiento.
 *
 * Nadie tiene que fiarse de que la app haga lo correcto: las reglas están
 * en la base de datos (`supabase/esquema.sql`).
 */

/** Quién eres y de dónde cuelgan tus datos. */
export interface Perfil {
  rol: 'nutricionista' | 'cliente';
  /** Dueña de los datos: la propia nutricionista, o la del cliente. */
  nutriId: string;
  /** Sólo en clientes: qué ficha le toca. */
  clientId?: string;
  nombre: string;
  email: string;
}

/** El estado completo de la app, tal y como vive en los stores. */
export interface Foto {
  clients: Client[];
  plans: Plan[];
  recipes: Receta[];
  foods: Alimento[];
  mediciones: Medicion[];
  registros: RegistroDia[];
  plantillas: PlantillaDespensa[];
  plantillasDia: PlantillaDia[];
}

export interface FilaCliente {
  id: string;
  nutri_id: string;
  email: string | null;
  ficha: Client;
  planes: Plan[];
  mediciones: Medicion[];
}

interface FilaRegistro {
  id: string;
  cliente_id: string;
  fecha: string;
  datos: RegistroDia;
}

// ------------------------------------------------------------------
//  QUIÉN ERES
// ------------------------------------------------------------------

/**
 * Al entrar hay que averiguar si esta persona es una nutricionista o el
 * cliente de alguien. Manda el email: si la nutricionista ya dio de alta
 * ese correo en una ficha, entra como cliente y ve su plan. Si no, es una
 * nutricionista y se le crea su espacio.
 *
 * Se comprueba en cada acceso, no sólo al registrarse: así da igual que el
 * cliente se cree la cuenta antes de que le den de alta.
 */
export async function resolverPerfil(user: User): Promise<Perfil> {
  const email = (user.email ?? '').toLowerCase();
  const sb = nube();

  const { data: fichas } = await sb
    .from('clientes')
    .select('id, nutri_id, ficha')
    .eq('email', email)
    .limit(1);

  const ficha = fichas?.[0];
  if (ficha) {
    return {
      rol: 'cliente',
      nutriId: ficha.nutri_id,
      clientId: ficha.id,
      nombre: (ficha.ficha as Client)?.nombre ?? email,
      email,
    };
  }

  const nombre = (user.user_metadata?.nombre as string) || email.split('@')[0];

  const { data: mia } = await sb
    .from('nutricionistas')
    .select('id, nombre')
    .eq('id', user.id)
    .maybeSingle();

  if (!mia) {
    // Primera vez: se crea el espacio vacío. Si dos pestañas lo intentan a
    // la vez, `upsert` deja una sola fila en lugar de reventar.
    await sb.from('nutricionistas').upsert({ id: user.id, nombre }, { onConflict: 'id' });
  }

  return { rol: 'nutricionista', nutriId: user.id, nombre: mia?.nombre || nombre, email };
}

// ------------------------------------------------------------------
//  TRADUCIR: DE LA APP A LAS FILAS Y AL REVÉS
// ------------------------------------------------------------------
//  Estas dos no hablan con nadie: son las que se pueden comprobar.

/** Reparte el estado plano de la app en una fila por cliente. */
export function aFilas(nutriId: string, foto: Foto): FilaCliente[] {
  return foto.clients.map((c) => ({
    id: c.id,
    nutri_id: nutriId,
    email: c.email?.trim().toLowerCase() || null,
    ficha: c,
    planes: foto.plans.filter((p) => p.clientId === c.id),
    mediciones: foto.mediciones.filter((m) => m.clientId === c.id),
  }));
}

/** Y al revés: de las filas al estado plano que esperan los stores. */
export function deFilas(filas: FilaCliente[]): Pick<Foto, 'clients' | 'plans' | 'mediciones'> {
  return {
    // El email manda el de la fila: es el que da acceso, y si se cambió
    // desde otro dispositivo la ficha guardada podría ir atrasada.
    clients: filas.map((f) => ({ ...f.ficha, id: f.id, email: f.email ?? f.ficha?.email })),
    plans: filas.flatMap((f) => f.planes ?? []),
    mediciones: filas.flatMap((f) => f.mediciones ?? []),
  };
}

// ------------------------------------------------------------------
//  BAJAR
// ------------------------------------------------------------------

/** Todo lo que esta persona puede ver, montado como lo espera la app. */
export async function bajar(perfil: Perfil): Promise<Foto> {
  const sb = nube();

  const [compartido, fichas] = await Promise.all([
    sb
      .from('nutricionistas')
      .select('recetas, alimentos, plantillas')
      .eq('id', perfil.nutriId)
      .maybeSingle(),
    perfil.rol === 'cliente'
      ? sb.from('clientes').select('*').eq('id', perfil.clientId!)
      : sb.from('clientes').select('*').eq('nutri_id', perfil.nutriId),
  ]);

  const filas = (fichas.data ?? []) as FilaCliente[];
  const ids = filas.map((f) => f.id);

  const registros: RegistroDia[] = [];
  if (ids.length) {
    const { data } = await sb.from('registros').select('*').in('cliente_id', ids);
    for (const r of (data ?? []) as FilaRegistro[]) registros.push(r.datos);
  }

  const plantillas = (compartido.data?.plantillas ?? {}) as {
    comidas?: PlantillaDespensa[];
    dias?: PlantillaDia[];
  };

  return {
    ...deFilas(filas),
    registros,
    recipes: (compartido.data?.recetas ?? []) as Receta[],
    foods: (compartido.data?.alimentos ?? []) as Alimento[],
    plantillas: plantillas.comidas ?? [],
    plantillasDia: plantillas.dias ?? [],
  };
}

// ------------------------------------------------------------------
//  SUBIR
// ------------------------------------------------------------------

/**
 * La nutricionista sube todo lo suyo. Se manda entero en vez de ir
 * apuntando qué cambió: son unos pocos kilobytes y evita que un fallo de
 * red deje mitad de un plan arriba y mitad abajo.
 */
export async function subirTodo(perfil: Perfil, foto: Foto): Promise<void> {
  if (perfil.rol !== 'nutricionista') return;
  const sb = nube();

  await sb.from('nutricionistas').upsert(
    {
      id: perfil.nutriId,
      nombre: perfil.nombre,
      recetas: foto.recipes,
      alimentos: foto.foods,
      plantillas: { comidas: foto.plantillas, dias: foto.plantillasDia },
      actualizado: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  const filas = aFilas(perfil.nutriId, foto).map((f) => ({
    ...f,
    actualizado: new Date().toISOString(),
  }));

  if (filas.length) await sb.from('clientes').upsert(filas, { onConflict: 'id' });

  // Lo que ya no está en la app se va también del servidor: si no, un
  // cliente borrado seguiría entrando en su plan desde su móvil.
  const vivos = foto.clients.map((c) => c.id);
  const sobran = sb.from('clientes').delete().eq('nutri_id', perfil.nutriId);
  await (vivos.length ? sobran.not('id', 'in', `(${vivos.map(comillas).join(',')})`) : sobran);

  await subirRegistros(foto.registros);
}

/** Lo que el cliente marca. Es lo único que escribe él. */
export async function subirRegistros(registros: RegistroDia[]): Promise<void> {
  if (!registros.length) return;
  await nube()
    .from('registros')
    .upsert(
      registros.map((r) => ({
        id: r.id,
        cliente_id: r.clientId,
        fecha: r.fecha,
        datos: r,
        actualizado: new Date().toISOString(),
      })),
      { onConflict: 'cliente_id,fecha' },
    );
}

/** Los ids son nuestros (cl_xxxx), pero se citan igual por costumbre. */
function comillas(id: string): string {
  return `"${id.replace(/"/g, '')}"`;
}
