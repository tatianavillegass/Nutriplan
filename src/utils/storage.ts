/**
 * Capa de abstracción de persistencia.
 *
 * v1 → LocalStorage. Para migrar a Supabase basta con reimplementar
 * `StorageAdapter` y cambiar `storage` por el adaptador nuevo: ningún
 * componente importa LocalStorage directamente.
 */

export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  /** Versión síncrona para hidratar el store en el arranque. */
  getSync<T>(key: string): T | null;
}

const PREFIX = 'nutriplan:v1:';

export const localStorageAdapter: StorageAdapter = {
  getSync<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  async get<T>(key: string) {
    return localStorageAdapter.getSync<T>(key);
  },
  async set<T>(key: string, value: T) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error('[storage] no se pudo guardar', key, e);
    }
  },
  async remove(key: string) {
    localStorage.removeItem(PREFIX + key);
  },
};

export const storage: StorageAdapter = localStorageAdapter;

export const STORAGE_KEYS = {
  clients: 'clients',
  plans: 'plans',
  recipes: 'recipes',
  foods: 'foods',
  mediciones: 'mediciones',
  registros: 'registros',
  recursos: 'recursos',
  retos: 'retos',
} as const;

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function nowIso(): string {
  return new Date().toISOString();
}
