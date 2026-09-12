import type { Client } from '../types/client';
import type { Alimento } from '../types/food';
import type { Plan } from '../types/plan';
import type { Receta } from '../types/recipe';
import type { Medicion } from '../types/anthropometry';
import type { RegistroDia } from '../types/diary';
import type { Recurso } from '../types/recursos';
import type { Reto } from '../types/reto';
import type { Gasto } from '../types/finanzas';

/**
 * LA COPIA DE SEGURIDAD
 *
 * El plan gratuito de Supabase no hace copias. Si un día algo se corrompe o se
 * borra, no hay de dónde tirar: se van las fichas, los planes y el registro de
 * todas las clientas. Esto es lo único que hay entre eso y perderlo todo.
 *
 * SIN SERVICIOS NI CLAVES
 * =======================
 * Se arma con lo que la app ya tiene cargado en pantalla y se descarga como un
 * archivo. No hace falta contratar nada, ni configurar nada, ni manejar ninguna
 * contraseña: si ella está dentro, es que tiene permiso para leer sus datos.
 *
 * LO QUE LLEVA DENTRO ES DELICADO
 * ===============================
 * Nombres, correos, pesos, medidas, fotos y patologías de personas reales. Es
 * una copia de verdad y por eso vale, pero también por eso el archivo hay que
 * guardarlo como se guarda un archivador de historias clínicas: no en el
 * escritorio, no en una carpeta compartida.
 *
 * NO HAY BOTÓN DE RESTAURAR, Y ES A PROPÓSITO
 * ===========================================
 * Restaurar es sobrescribir. Un botón que pisa treinta y siete fichas con lo
 * que había hace tres semanas hace más daño del que arregla el día que se pulsa
 * por error, y el día que de verdad hace falta se usa una vez en la vida. El
 * archivo tiene todo lo necesario para recuperar: se hace con calma y mirando.
 */

/** Sube cuando cambie la forma del archivo, para saber leerlo dentro de un año. */
export const VERSION_COPIA = 1;

export interface CopiaDeSeguridad {
  app: 'nutriplan';
  version: number;
  /** Cuándo se descargó. */
  fecha: string;
  /** De quién es, para no confundir dos copias. */
  correo?: string;
  datos: {
    clients: Client[];
    plans: Plan[];
    recipes: Receta[];
    foods: Alimento[];
    mediciones: Medicion[];
    registros: RegistroDia[];
    recursos: Recurso[];
    retos: Reto[];
    gastos: Gasto[];
    /**
     * Las plantillas viven en el navegador y no en el servidor, así que son
     * justo las que MÁS falta hacen en una copia: no están en ningún otro
     * sitio.
     */
    plantillas?: unknown;
  };
}

export function armarCopia(
  datos: CopiaDeSeguridad['datos'],
  correo?: string,
  ahora = new Date(),
): CopiaDeSeguridad {
  return {
    app: 'nutriplan',
    version: VERSION_COPIA,
    fecha: ahora.toISOString(),
    ...(correo ? { correo } : {}),
    datos,
  };
}

/** `nutriplan-copia-2026-09-12.json`, para que ordenen solos por fecha. */
export function nombreDelArchivo(ahora = new Date()): string {
  return `nutriplan-copia-${ahora.toISOString().slice(0, 10)}.json`;
}

export interface QueLleva {
  clientas: number;
  planes: number;
  recetas: number;
  mediciones: number;
  registros: number;
}

/**
 * Qué lleva la copia, para enseñarlo antes de descargar.
 *
 * Una copia vacía pesa dos kilobytes y parece que ha funcionado. Con los
 * números delante se ve de un vistazo si de verdad está todo.
 */
export function queLleva(datos: CopiaDeSeguridad['datos']): QueLleva {
  return {
    clientas: datos.clients.length,
    planes: datos.plans.length,
    recetas: datos.recipes.length,
    mediciones: datos.mediciones.length,
    registros: datos.registros.length,
  };
}

export function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Descarga el archivo.
 *
 * Va por `Blob` y no por una URL con el contenido dentro: las fotos de las
 * recetas y las de progreso viajan en el propio archivo, así que una copia con
 * unas cuantas clientas se va a varios megas y ahí las URL con datos dentro
 * dejan de funcionar en la mitad de los navegadores.
 */
export function descargarCopia(copia: CopiaDeSeguridad, nombre = nombreDelArchivo()): void {
  const texto = JSON.stringify(copia, null, 2);
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Sin esto el navegador se queda el archivo entero en memoria hasta recargar.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
