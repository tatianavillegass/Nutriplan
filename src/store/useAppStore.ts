import { create } from "zustand";
import type { Client } from "../types/client";
import type { Plan, DayType, Meal, Phase } from "../types/plan";
import { DEFAULT_MEALS } from "../types/plan";
import type { Receta } from "../types/recipe";
import type { Alimento } from "../types/food";
import type { Medicion } from "../types/anthropometry";
import type { RegistroDia } from "../types/diary";
import type { Recurso } from "../types/recursos";
import type { Reto } from "../types/reto";
import type { Gasto } from "../types/finanzas";
import { registroVacio } from "../types/diary";
import { EXCHANGE_GROUPS, type ExchangeGroupId } from "../data/exchangeGroups";
import { FOOD_CATALOG } from "../data/foodCatalog";
import { SEED_RECIPES } from "../data/seedRecipes";
import { DEMO_CLIENT, DEMO_PLAN } from "../data/demoSeed";
import { storage, STORAGE_KEYS, uid, nowIso } from "../utils/storage";
import { snapHalf } from "../utils/macros";

interface AppState {
  clients: Client[];
  plans: Plan[];
  recipes: Receta[];
  foods: Alimento[];
  mediciones: Medicion[];
  registros: RegistroDia[];
  recursos: Recurso[];
  retos: Reto[];
  /** Los gastos de la consulta: sueltos y fijos. No son de ninguna clienta. */
  gastos: Gasto[];

  // Clientes
  addClient: (c: Omit<Client, "id" | "createdAt" | "updatedAt">) => Client;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  getClient: (id: string) => Client | undefined;

  // Planes
  /** La planificación en uso del cliente. */
  getPlanByClient: (clientId: string) => Plan | undefined;
  ensurePlan: (clientId: string) => Plan;
  /** Todas las del cliente, la más reciente primero. */
  planesDe: (clientId: string) => Plan[];
  /** Archiva la actual y abre una copia editable con la fecha de hoy. */
  nuevaPlanificacion: (clientId: string, kcalObjetivo?: number) => Plan;
  /** Vuelve a poner en uso una planificación archivada. */
  reactivarPlan: (planId: string) => void;
  updatePlan: (planId: string, patch: Partial<Plan>) => void;
  deletePlan: (planId: string) => void;
  setPhase: (planId: string, fase: Phase) => void;
  addDayType: (planId: string, nombre: string) => void;
  updateDayType: (
    planId: string,
    dayTypeId: string,
    patch: Partial<DayType>,
  ) => void;
  deleteDayType: (planId: string, dayTypeId: string) => void;

  // Grilla
  setCell: (
    planId: string,
    dayTypeId: string,
    mealId: string,
    group: ExchangeGroupId,
    value: number,
  ) => void;
  bumpCell: (
    planId: string,
    dayTypeId: string,
    mealId: string,
    group: ExchangeGroupId,
    delta: number,
  ) => void;

  // Comidas
  addMeal: (planId: string, dayTypeId: string, meal: Omit<Meal, "id">) => void;
  renameMeal: (
    planId: string,
    dayTypeId: string,
    mealId: string,
    nombre: string,
  ) => void;
  removeMeal: (planId: string, dayTypeId: string, mealId: string) => void;

  // Recetas
  addRecipe: (r: Omit<Receta, "id" | "createdAt" | "updatedAt">) => Receta;
  updateRecipe: (id: string, patch: Partial<Receta>) => void;
  deleteRecipe: (id: string) => void;

  // Alimentos
  addFood: (a: Omit<Alimento, "id">) => Alimento;
  updateFood: (id: string, patch: Partial<Alimento>) => void;
  deleteFood: (id: string) => void;

  // Diario del cliente
  registroDe: (clientId: string, fecha: string) => RegistroDia | undefined;
  /** Crea el registro si no existe y devuelve el resultante. */
  upsertRegistro: (
    clientId: string,
    fecha: string,
    patch: Partial<RegistroDia>,
  ) => RegistroDia;
  registrosDe: (clientId: string) => RegistroDia[];
  /**
   * Un registro que llega del servidor mientras la app está abierta: lo que
   * la clienta acaba de marcar en su móvil. Sustituye al que hubiera de ese
   * mismo día sin tocar nada más.
   */
  aplicarRegistroRemoto: (registro: RegistroDia) => void;

  // Antropometría
  medicionesDe: (clientId: string) => Medicion[];
  addMedicion: (m: Omit<Medicion, "id">) => Medicion;
  updateMedicion: (id: string, patch: Partial<Medicion>) => void;
  deleteMedicion: (id: string) => void;

  /**
   * Sustituye el estado por el que viene del servidor. Se usa al entrar,
   * cuando lo que manda es la nube y no lo que hubiera en este navegador.
   */
  // Retos: grupos que empiezan el mismo día
  upsertReto: (r: Reto) => void;
  borrarReto: (id: string) => void;

  /** Trae lo que la nutricionista haya cambiado, sin pisar el día del cliente. */
  aplicarPlanRemoto: (clients: Client[], plans: Plan[]) => void;

  // Recursos: material de consulta que ven todas las clientas
  upsertRecurso: (r: Recurso) => void;
  borrarRecurso: (id: string) => void;
  moverRecurso: (id: string, delta: number) => void;

  // Gastos de la consulta
  upsertGasto: (g: Gasto) => void;
  borrarGasto: (id: string) => void;

  hidratar: (datos: {
    clients: Client[];
    plans: Plan[];
    recipes: Receta[];
    foods: Alimento[];
    mediciones: Medicion[];
    registros: RegistroDia[];
    recursos?: Recurso[];
    retos?: Reto[];
    gastos?: Gasto[];
  }) => void;
}

function hydrate<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return storage.getSync<T>(key) ?? fallback;
}

/**
 * Migración: antes había dos fases y la 2 era "intercambios abiertos".
 * Ahora esa es la 3, porque en medio entra la de cantidades ya hechas.
 */
const FASES_MIGRADAS_KEY = "fases_v2_a_v3";

/**
 * VERSIÓN DEL CATÁLOGO
 *
 * El catálogo se guarda en el navegador para que la nutricionista pueda
 * añadir y editar alimentos. El efecto secundario es que, al actualizar la
 * app, la copia guardada tapa la nueva: por eso la versión.
 *
 * Cuando sube, se rehace el catálogo con el nuevo y se conservan los
 * alimentos que haya dado de alta ella (los que no vienen de la app).
 */
const CATALOGO_VERSION = 2;
const CATALOGO_VERSION_KEY = "catalogo_version";

/** Subgrupos que ya no existen y a cuál corresponden ahora. */
const GRUPOS_RENOMBRADOS: Record<string, ExchangeGroupId> = {
  lacteos: "lacteos_semi",
  proteicos: "proteicos_magros",
  cereales: "almidones",
  frutas: "fruta",
};

function migrarCatalogo(guardados: Alimento[] | null): Alimento[] {
  if (!guardados?.length) return FOOD_CATALOG;
  if (
    typeof window !== "undefined" &&
    (storage.getSync<number>(CATALOGO_VERSION_KEY) ?? 1) >= CATALOGO_VERSION
  ) {
    return sanearGrupos(guardados);
  }

  // Alimentos propios: los que no están en el catálogo que trae la app.
  const deLaApp = new Set(FOOD_CATALOG.map((f) => f.id));
  const nombresApp = new Set(FOOD_CATALOG.map((f) => f.nombre.toLowerCase()));
  const propios = sanearGrupos(
    guardados.filter(
      (f) => !deLaApp.has(f.id) && !nombresApp.has(f.nombre.toLowerCase()),
    ),
  );

  const fusionado = [...FOOD_CATALOG, ...propios];
  if (typeof window !== "undefined") {
    storage.set(STORAGE_KEYS.foods, fusionado);
    storage.set(CATALOGO_VERSION_KEY, CATALOGO_VERSION);
  }
  return fusionado;
}

/**
 * Los planes guardados también pueden llevar subgrupos viejos en la grilla
 * ("lacteos"). Sin traducirlos, las kcal de ese día no se podían calcular.
 */
function migrarGruposPlanes(plans: Plan[]): Plan[] {
  let cambiado = false;
  // Antes había un plan por cliente sin fecha ni nombre propio. Al pasar al
  // historial, el que ya existía es la primera planificación y queda en uso.
  const vistos = new Set<string>();
  const migrados = plans.map((p) => ({
    ...p,
    nombre: p.nombre && p.nombre !== "Plan" ? p.nombre : "Planificación 1",
    fecha: p.fecha ?? p.createdAt,
    archivado:
      p.archivado ??
      (vistos.has(p.clientId) ? true : (vistos.add(p.clientId), false)),
    dayTypes: p.dayTypes.map((d) => {
      const grid: typeof d.grid = {};
      for (const [mealId, celdas] of Object.entries(d.grid ?? {})) {
        const nuevas: Record<string, number> = {};
        for (const [g, v] of Object.entries(celdas ?? {})) {
          const destino = g in EXCHANGE_GROUPS ? g : GRUPOS_RENOMBRADOS[g];
          if (!destino || typeof v !== "number") {
            cambiado = true;
            continue;
          }
          if (destino !== g) cambiado = true;
          nuevas[destino] = (nuevas[destino] ?? 0) + v;
        }
        grid[mealId] = nuevas as (typeof d.grid)[string];
      }
      return { ...d, grid };
    }),
  }));
  if (cambiado && typeof window !== "undefined")
    storage.set(STORAGE_KEYS.plans, migrados);
  return migrados;
}

/** Un subgrupo que ya no existe dejaba el alimento invisible en toda la app. */
export function sanearGrupos(foods: Alimento[]): Alimento[] {
  return foods.map((f) => {
    if (!f.grupo || f.grupo in EXCHANGE_GROUPS) return f;
    const nuevo = GRUPOS_RENOMBRADOS[f.grupo as string];
    return {
      ...f,
      grupo: nuevo,
      bucket: nuevo ? EXCHANGE_GROUPS[nuevo].bucket : undefined,
    };
  });
}

function migrarFases(plans: Plan[]): Plan[] {
  if (typeof window === "undefined") return plans;
  if (storage.getSync<boolean>(FASES_MIGRADAS_KEY)) return plans;
  storage.set(FASES_MIGRADAS_KEY, true);
  const migrados = plans.map((p) =>
    p.fase === 2 ? { ...p, fase: 3 as const } : p,
  );
  if (migrados.some((p, i) => p !== plans[i]))
    storage.set(STORAGE_KEYS.plans, migrados);
  return migrados;
}

function newDayType(nombre: string): DayType {
  const meals = DEFAULT_MEALS.map((m) => ({ ...m }));
  return {
    id: uid("dt_"),
    nombre,
    proteinaGkg: 2,
    hcGkg: 3,
    meals,
    grid: {},
    // La despensa se construye añadiendo: cada comida arranca vacía y la
    // nutricionista escribe lo que quiere ofrecer.
    despensa: Object.fromEntries(meals.map((m) => [m.id, { seleccion: [] }])),
    notas: {},
  };
}

export const useAppStore = create<AppState>((set, get) => {
  const persistClients = (clients: Client[]) =>
    storage.set(STORAGE_KEYS.clients, clients);
  const persistPlans = (plans: Plan[]) =>
    storage.set(STORAGE_KEYS.plans, plans);
  const persistRecipes = (recipes: Receta[]) =>
    storage.set(STORAGE_KEYS.recipes, recipes);
  const persistFoods = (foods: Alimento[]) =>
    storage.set(STORAGE_KEYS.foods, foods);
  const persistMediciones = (ms: Medicion[]) =>
    storage.set(STORAGE_KEYS.mediciones, ms);
  const persistRegistros = (rs: RegistroDia[]) =>
    storage.set(STORAGE_KEYS.registros, rs);
  const persistRecursos = (rs: Recurso[]) =>
    storage.set(STORAGE_KEYS.recursos, rs);
  const persistRetos = (rs: Reto[]) => storage.set(STORAGE_KEYS.retos, rs);
  const persistGastos = (gs: Gasto[]) => storage.set(STORAGE_KEYS.gastos, gs);

  const mutatePlans = (fn: (plans: Plan[]) => Plan[]) => {
    set((s) => {
      const plans = fn(s.plans).map((p) => ({ ...p }));
      persistPlans(plans);
      return { plans };
    });
  };

  const mutatePlan = (planId: string, fn: (p: Plan) => Plan) =>
    mutatePlans((plans) =>
      plans.map((p) =>
        p.id === planId ? { ...fn(p), updatedAt: nowIso() } : p,
      ),
    );

  const mutateDayType = (
    planId: string,
    dayTypeId: string,
    fn: (d: DayType) => DayType,
  ) =>
    mutatePlan(planId, (p) => ({
      ...p,
      dayTypes: p.dayTypes.map((d) => (d.id === dayTypeId ? fn(d) : d)),
    }));

  return {
    // La primera vez que se abre la app se carga un cliente de ejemplo para
    // poder ver el flujo completo sin tener que introducir datos.
    clients: hydrate<Client[]>(STORAGE_KEYS.clients, [DEMO_CLIENT]),
    plans: migrarGruposPlanes(
      migrarFases(hydrate<Plan[]>(STORAGE_KEYS.plans, [DEMO_PLAN])),
    ),
    recipes: hydrate<Receta[]>(STORAGE_KEYS.recipes, SEED_RECIPES),
    foods: migrarCatalogo(
      typeof window === "undefined"
        ? null
        : storage.getSync<Alimento[]>(STORAGE_KEYS.foods),
    ),
    mediciones: hydrate<Medicion[]>(STORAGE_KEYS.mediciones, []),
    registros: hydrate<RegistroDia[]>(STORAGE_KEYS.registros, []),
    recursos: hydrate<Recurso[]>(STORAGE_KEYS.recursos, []),
    retos: hydrate<Reto[]>(STORAGE_KEYS.retos, []),
    gastos: hydrate<Gasto[]>(STORAGE_KEYS.gastos, []),

    addClient: (c) => {
      const client: Client = {
        ...c,
        id: uid("cl_"),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      set((s) => {
        const clients = [...s.clients, client];
        persistClients(clients);
        return { clients };
      });
      return client;
    },

    updateClient: (id, patch) =>
      set((s) => {
        const clients = s.clients.map((c) =>
          c.id === id ? { ...c, ...patch, updatedAt: nowIso() } : c,
        );
        persistClients(clients);
        return { clients };
      }),

    /** Borrar un cliente se lleva todo lo suyo: no deja datos huérfanos. */
    deleteClient: (id) =>
      set((s) => {
        const clients = s.clients.filter((c) => c.id !== id);
        const plans = s.plans.filter((p) => p.clientId !== id);
        const mediciones = s.mediciones.filter((m) => m.clientId !== id);
        const registros = s.registros.filter((r) => r.clientId !== id);
        persistClients(clients);
        persistPlans(plans);
        persistMediciones(mediciones);
        persistRegistros(registros);
        return { clients, plans, mediciones, registros };
      }),

    getClient: (id) => get().clients.find((c) => c.id === id),

    getPlanByClient: (clientId) =>
      get().plans.find((p) => p.clientId === clientId && !p.archivado),

    planesDe: (clientId) => {
      const todos = get().plans;
      // Dos planificaciones creadas el mismo día empatan por fecha: entonces
      // manda el orden de creación, que es el de la lista.
      const orden = new Map(todos.map((p, i) => [p.id, i]));
      return todos
        .filter((p) => p.clientId === clientId)
        .sort(
          (a, b) =>
            (b.fecha ?? b.createdAt).localeCompare(a.fecha ?? a.createdAt) ||
            (orden.get(b.id) ?? 0) - (orden.get(a.id) ?? 0),
        );
    },

    nuevaPlanificacion: (clientId, kcalObjetivo) => {
      const anteriores = get().plans.filter((p) => p.clientId === clientId);
      const actual = anteriores.find((p) => !p.archivado);
      const hoy = nowIso();

      // La nueva parte de una copia de la actual: la grilla, las recetas y las
      // combinaciones ya están pensadas, sólo hay que retocarlas.
      const plan: Plan = {
        ...(actual ?? { fase: 1 as Phase, dayTypes: [newDayType("Día base")] }),
        id: uid("pl_"),
        clientId,
        nombre: `Planificación ${anteriores.length + 1}`,
        dayTypes: (actual?.dayTypes ?? [newDayType("Día base")]).map((d) => ({
          ...d,
          id: uid("dt_"),
        })),
        archivado: false,
        fecha: hoy,
        kcalObjetivo,
        notas: undefined,
        createdAt: hoy,
        updatedAt: hoy,
      };

      set((s) => {
        const plans = [
          ...s.plans.map((p) =>
            p.clientId === clientId && !p.archivado
              ? {
                  ...p,
                  archivado: true,
                  kcalObjetivo: p.kcalObjetivo ?? kcalObjetivo,
                }
              : p,
          ),
          plan,
        ];
        persistPlans(plans);
        return { plans };
      });
      return plan;
    },

    reactivarPlan: (planId) =>
      mutatePlans((plans) => {
        const objetivo = plans.find((p) => p.id === planId);
        if (!objetivo) return plans;
        return plans.map((p) =>
          p.clientId === objetivo.clientId
            ? { ...p, archivado: p.id !== planId }
            : p,
        );
      }),

    updatePlan: (planId, patch) =>
      mutatePlan(planId, (p) => ({ ...p, ...patch })),

    deletePlan: (planId) =>
      mutatePlans((plans) => {
        const resto = plans.filter((p) => p.id !== planId);
        const borrado = plans.find((p) => p.id === planId);
        // Nunca dejar al cliente sin planificación en uso.
        if (borrado && !borrado.archivado) {
          const suyas = resto.filter((p) => p.clientId === borrado.clientId);
          const siguiente = [...suyas].sort((a, b) =>
            (b.fecha ?? b.createdAt).localeCompare(a.fecha ?? a.createdAt),
          )[0];
          if (siguiente) {
            return resto.map((p) =>
              p.id === siguiente.id ? { ...p, archivado: false } : p,
            );
          }
        }
        return resto;
      }),

    ensurePlan: (clientId) => {
      const existing = get().plans.find(
        (p) => p.clientId === clientId && !p.archivado,
      );
      if (existing) return existing;
      const plan: Plan = {
        id: uid("pl_"),
        clientId,
        nombre: "Planificación 1",
        fase: 1,
        dayTypes: [newDayType("Día base")],
        fecha: nowIso(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      set((s) => {
        const plans = [...s.plans, plan];
        persistPlans(plans);
        return { plans };
      });
      return plan;
    },

    /** Regla §10.5: cambiar de fase NO toca los intercambios pautados. */
    setPhase: (planId, fase) => mutatePlan(planId, (p) => ({ ...p, fase })),

    addDayType: (planId, nombre) =>
      mutatePlan(planId, (p) => ({
        ...p,
        dayTypes: [...p.dayTypes, newDayType(nombre)],
      })),

    updateDayType: (planId, dayTypeId, patch) =>
      mutateDayType(planId, dayTypeId, (d) => ({ ...d, ...patch })),

    deleteDayType: (planId, dayTypeId) =>
      mutatePlan(planId, (p) => ({
        ...p,
        dayTypes:
          p.dayTypes.length > 1
            ? p.dayTypes.filter((d) => d.id !== dayTypeId)
            : p.dayTypes,
      })),

    setCell: (planId, dayTypeId, mealId, group, value) =>
      mutateDayType(planId, dayTypeId, (d) => {
        const v = Math.max(0, snapHalf(value));
        const meal = { ...(d.grid[mealId] ?? {}) };
        if (v === 0) delete meal[group];
        else meal[group] = v;
        return { ...d, grid: { ...d.grid, [mealId]: meal } };
      }),

    bumpCell: (planId, dayTypeId, mealId, group, delta) => {
      const plan = get().plans.find((p) => p.id === planId);
      const dt = plan?.dayTypes.find((d) => d.id === dayTypeId);
      const current = dt?.grid[mealId]?.[group] ?? 0;
      get().setCell(planId, dayTypeId, mealId, group, current + delta);
    },

    addMeal: (planId, dayTypeId, meal) =>
      mutateDayType(planId, dayTypeId, (d) => ({
        ...d,
        meals: [...d.meals, { ...meal, id: uid("m_") }].sort(
          (a, b) => a.orden - b.orden,
        ),
      })),

    renameMeal: (planId, dayTypeId, mealId, nombre) =>
      mutateDayType(planId, dayTypeId, (d) => ({
        ...d,
        meals: d.meals.map((m) => (m.id === mealId ? { ...m, nombre } : m)),
      })),

    removeMeal: (planId, dayTypeId, mealId) =>
      mutateDayType(planId, dayTypeId, (d) => {
        const grid = { ...d.grid };
        delete grid[mealId];
        return { ...d, meals: d.meals.filter((m) => m.id !== mealId), grid };
      }),

    addRecipe: (r) => {
      const receta: Receta = {
        ...r,
        id: uid("rc_"),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      set((s) => {
        const recipes = [...s.recipes, receta];
        persistRecipes(recipes);
        return { recipes };
      });
      // Se devuelve para poder abrirla al momento: al duplicar una receta, lo
      // siguiente que se hace siempre es editar la copia.
      return receta;
    },

    updateRecipe: (id, patch) =>
      set((s) => {
        const recipes = s.recipes.map((r) =>
          r.id === id ? { ...r, ...patch, updatedAt: nowIso() } : r,
        );
        persistRecipes(recipes);
        return { recipes };
      }),

    deleteRecipe: (id) =>
      set((s) => {
        const recipes = s.recipes.filter((r) => r.id !== id);
        persistRecipes(recipes);
        return { recipes };
      }),

    addFood: (a) => {
      const food: Alimento = { ...a, id: uid("f_"), custom: true };
      set((s) => {
        const foods = [...s.foods, food];
        persistFoods(foods);
        return { foods };
      });
      return food;
    },

    updateFood: (id, patch) =>
      set((s) => {
        const foods = s.foods.map((f) =>
          f.id === id ? { ...f, ...patch } : f,
        );
        persistFoods(foods);
        return { foods };
      }),

    deleteFood: (id) =>
      set((s) => {
        const foods = s.foods.filter((f) => f.id !== id);
        persistFoods(foods);
        return { foods };
      }),

    registroDe: (clientId, fecha) =>
      get().registros.find((r) => r.clientId === clientId && r.fecha === fecha),

    registrosDe: (clientId) =>
      get()
        .registros.filter((r) => r.clientId === clientId)
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),

    upsertRegistro: (clientId, fecha, patch) => {
      const existente = get().registros.find(
        (r) => r.clientId === clientId && r.fecha === fecha,
      );
      const actualizado: RegistroDia = existente
        ? { ...existente, ...patch }
        : { ...registroVacio(clientId, fecha, uid("rg_")), ...patch };
      set((s) => {
        const registros = existente
          ? s.registros.map((r) => (r.id === existente.id ? actualizado : r))
          : [...s.registros, actualizado];
        persistRegistros(registros);
        return { registros };
      });
      return actualizado;
    },

    aplicarRegistroRemoto: (registro) =>
      set((s) => {
        const i = s.registros.findIndex(
          (r) => r.clientId === registro.clientId && r.fecha === registro.fecha,
        );
        const registros =
          i >= 0
            ? s.registros.map((r, j) => (j === i ? registro : r))
            : [...s.registros, registro];
        persistRegistros(registros);
        return { registros };
      }),

    medicionesDe: (clientId) =>
      get()
        .mediciones.filter((m) => m.clientId === clientId)
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),

    addMedicion: (m) => {
      const medicion: Medicion = { ...m, id: uid("me_") };
      set((s) => {
        const mediciones = [...s.mediciones, medicion];
        persistMediciones(mediciones);
        return { mediciones };
      });
      return medicion;
    },

    updateMedicion: (id, patch) =>
      set((s) => {
        const mediciones = s.mediciones.map((m) =>
          m.id === id ? { ...m, ...patch } : m,
        );
        persistMediciones(mediciones);
        return { mediciones };
      }),

    deleteMedicion: (id) =>
      set((s) => {
        const mediciones = s.mediciones.filter((m) => m.id !== id);
        persistMediciones(mediciones);
        return { mediciones };
      }),

    upsertReto: (r) => {
      const retos = get().retos.some((x) => x.id === r.id)
        ? get().retos.map((x) => (x.id === r.id ? r : x))
        : [...get().retos, r];
      persistRetos(retos);
      set({ retos });
    },

    borrarReto: (id) => {
      const retos = get().retos.filter((r) => r.id !== id);
      persistRetos(retos);
      set({ retos });
    },

    upsertGasto: (g) => {
      const gastos = get().gastos.some((x) => x.id === g.id)
        ? get().gastos.map((x) => (x.id === g.id ? g : x))
        : [...get().gastos, g];
      persistGastos(gastos);
      set({ gastos });
    },

    /**
     * Borrar de verdad. Para dejar de pagar un fijo está `hasta`, que conserva
     * los meses en que sí se pagó; esto es para el que se apuntó mal.
     */
    borrarGasto: (id) => {
      const gastos = get().gastos.filter((g) => g.id !== id);
      persistGastos(gastos);
      set({ gastos });
    },

    /**
     * Crea o reemplaza un recurso. Se ordenan a mano porque el orden es del
     * criterio de la nutricionista: primero lo que quiere que se lea antes.
     */
    upsertRecurso: (r) => {
      const recursos = get().recursos.some((x) => x.id === r.id)
        ? get().recursos.map((x) => (x.id === r.id ? r : x))
        : [...get().recursos, r];
      persistRecursos(recursos);
      set({ recursos });
    },

    borrarRecurso: (id) => {
      const recursos = get().recursos.filter((r) => r.id !== id);
      persistRecursos(recursos);
      set({ recursos });
    },

    /** Subir o bajar uno en la lista: intercambia el orden con su vecino. */
    moverRecurso: (id, delta) => {
      const lista = [...get().recursos].sort((a, b) => a.orden - b.orden);
      const i = lista.findIndex((r) => r.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= lista.length) return;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      const recursos = lista.map((r, n) => ({ ...r, orden: n }));
      persistRecursos(recursos);
      set({ recursos });
    },

    /**
     * Lo que la nutricionista ha cambiado, aplicado sin tocar nada de lo que
     * el cliente lleve marcado hoy. Sólo la ficha y los planes.
     */
    aplicarPlanRemoto: (clients, plans) => {
      persistClients(clients);
      persistPlans(plans);
      set({ clients, plans: migrarGruposPlanes(plans) });
    },

    hidratar: (datos) => {
      // El catálogo del servidor puede venir vacío la primera vez (cuenta
      // recién creada): entonces se arranca con el que trae la app, que es
      // justo lo que se subirá a continuación.
      const foods = datos.foods.length
        ? sanearGrupos(datos.foods)
        : FOOD_CATALOG;
      const recipes = datos.recipes.length ? datos.recipes : SEED_RECIPES;

      persistClients(datos.clients);
      persistPlans(datos.plans);
      persistRecipes(recipes);
      persistFoods(foods);
      persistMediciones(datos.mediciones);
      persistRegistros(datos.registros);
      /**
       * COLUMNA QUE NO EXISTE NO ES «NO TIENES NADA»
       *
       * Mientras la columna no esté creada en Supabase, lo que baja no trae la
       * clave. Dándolo por una lista vacía se borraba lo que había aquí: se
       * creaba un reto, se subía —el envío ya sabe guardarse sin esa columna— y
       * al recargar volvía sin retos y se llevaba por delante el recién creado.
       *
       * Si el servidor no sabe de esto todavía, manda lo del navegador.
       */
      const recursos = datos.recursos ?? get().recursos;
      const retos = datos.retos ?? get().retos;
      const gastos = datos.gastos ?? get().gastos;

      persistRecursos(recursos);
      persistRetos(retos);
      persistGastos(gastos);

      set({
        clients: datos.clients,
        plans: migrarGruposPlanes(datos.plans),
        recipes,
        foods,
        mediciones: datos.mediciones,
        registros: datos.registros,
        recursos,
        retos,
        gastos,
      });
    },
  };
});
