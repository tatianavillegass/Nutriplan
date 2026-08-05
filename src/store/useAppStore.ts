import { create } from 'zustand';
import type { Client } from '../types/client';
import type { Plan, DayType, Meal, Phase } from '../types/plan';
import { DEFAULT_MEALS } from '../types/plan';
import type { Receta } from '../types/recipe';
import type { Alimento } from '../types/food';
import type { ExchangeGroupId } from '../data/exchangeGroups';
import { FOOD_CATALOG } from '../data/foodCatalog';
import { SEED_RECIPES } from '../data/seedRecipes';
import { DEMO_CLIENT, DEMO_PLAN } from '../data/demoSeed';
import { storage, STORAGE_KEYS, uid, nowIso } from '../utils/storage';
import { snapHalf } from '../utils/macros';

interface AppState {
  clients: Client[];
  plans: Plan[];
  recipes: Receta[];
  foods: Alimento[];

  // Clientes
  addClient: (c: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Client;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  getClient: (id: string) => Client | undefined;

  // Planes
  getPlanByClient: (clientId: string) => Plan | undefined;
  ensurePlan: (clientId: string) => Plan;
  setPhase: (planId: string, fase: Phase) => void;
  addDayType: (planId: string, nombre: string) => void;
  updateDayType: (planId: string, dayTypeId: string, patch: Partial<DayType>) => void;
  deleteDayType: (planId: string, dayTypeId: string) => void;

  // Grilla
  setCell: (planId: string, dayTypeId: string, mealId: string, group: ExchangeGroupId, value: number) => void;
  bumpCell: (planId: string, dayTypeId: string, mealId: string, group: ExchangeGroupId, delta: number) => void;

  // Comidas
  addMeal: (planId: string, dayTypeId: string, meal: Omit<Meal, 'id'>) => void;
  renameMeal: (planId: string, dayTypeId: string, mealId: string, nombre: string) => void;
  removeMeal: (planId: string, dayTypeId: string, mealId: string) => void;

  // Recetas
  addRecipe: (r: Omit<Receta, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateRecipe: (id: string, patch: Partial<Receta>) => void;
  deleteRecipe: (id: string) => void;

  // Alimentos
  addFood: (a: Omit<Alimento, 'id'>) => void;
  updateFood: (id: string, patch: Partial<Alimento>) => void;
  deleteFood: (id: string) => void;
}

function hydrate<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  return storage.getSync<T>(key) ?? fallback;
}

function newDayType(nombre: string): DayType {
  return {
    id: uid('dt_'),
    nombre,
    proteinaGkg: 2,
    hcGkg: 3,
    meals: DEFAULT_MEALS.map((m) => ({ ...m })),
    grid: {},
    notas: {},
  };
}

export const useAppStore = create<AppState>((set, get) => {
  const persistClients = (clients: Client[]) => storage.set(STORAGE_KEYS.clients, clients);
  const persistPlans = (plans: Plan[]) => storage.set(STORAGE_KEYS.plans, plans);
  const persistRecipes = (recipes: Receta[]) => storage.set(STORAGE_KEYS.recipes, recipes);
  const persistFoods = (foods: Alimento[]) => storage.set(STORAGE_KEYS.foods, foods);

  const mutatePlans = (fn: (plans: Plan[]) => Plan[]) => {
    set((s) => {
      const plans = fn(s.plans).map((p) => ({ ...p }));
      persistPlans(plans);
      return { plans };
    });
  };

  const mutatePlan = (planId: string, fn: (p: Plan) => Plan) =>
    mutatePlans((plans) =>
      plans.map((p) => (p.id === planId ? { ...fn(p), updatedAt: nowIso() } : p)),
    );

  const mutateDayType = (planId: string, dayTypeId: string, fn: (d: DayType) => DayType) =>
    mutatePlan(planId, (p) => ({
      ...p,
      dayTypes: p.dayTypes.map((d) => (d.id === dayTypeId ? fn(d) : d)),
    }));

  return {
    // La primera vez que se abre la app se carga un cliente de ejemplo para
    // poder ver el flujo completo sin tener que introducir datos.
    clients: hydrate<Client[]>(STORAGE_KEYS.clients, [DEMO_CLIENT]),
    plans: hydrate<Plan[]>(STORAGE_KEYS.plans, [DEMO_PLAN]),
    recipes: hydrate<Receta[]>(STORAGE_KEYS.recipes, SEED_RECIPES),
    foods: hydrate<Alimento[]>(STORAGE_KEYS.foods, FOOD_CATALOG),

    addClient: (c) => {
      const client: Client = { ...c, id: uid('cl_'), createdAt: nowIso(), updatedAt: nowIso() };
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

    deleteClient: (id) =>
      set((s) => {
        const clients = s.clients.filter((c) => c.id !== id);
        const plans = s.plans.filter((p) => p.clientId !== id);
        persistClients(clients);
        persistPlans(plans);
        return { clients, plans };
      }),

    getClient: (id) => get().clients.find((c) => c.id === id),

    getPlanByClient: (clientId) => get().plans.find((p) => p.clientId === clientId),

    ensurePlan: (clientId) => {
      const existing = get().plans.find((p) => p.clientId === clientId);
      if (existing) return existing;
      const plan: Plan = {
        id: uid('pl_'),
        clientId,
        nombre: 'Plan',
        fase: 1,
        dayTypes: [newDayType('Día base')],
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
      mutatePlan(planId, (p) => ({ ...p, dayTypes: [...p.dayTypes, newDayType(nombre)] })),

    updateDayType: (planId, dayTypeId, patch) =>
      mutateDayType(planId, dayTypeId, (d) => ({ ...d, ...patch })),

    deleteDayType: (planId, dayTypeId) =>
      mutatePlan(planId, (p) => ({
        ...p,
        dayTypes: p.dayTypes.length > 1 ? p.dayTypes.filter((d) => d.id !== dayTypeId) : p.dayTypes,
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
        meals: [...d.meals, { ...meal, id: uid('m_') }].sort((a, b) => a.orden - b.orden),
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

    addRecipe: (r) =>
      set((s) => {
        const recipes = [...s.recipes, { ...r, id: uid('rc_'), createdAt: nowIso(), updatedAt: nowIso() }];
        persistRecipes(recipes);
        return { recipes };
      }),

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

    addFood: (a) =>
      set((s) => {
        const foods = [...s.foods, { ...a, id: uid('f_'), custom: true }];
        persistFoods(foods);
        return { foods };
      }),

    updateFood: (id, patch) =>
      set((s) => {
        const foods = s.foods.map((f) => (f.id === id ? { ...f, ...patch } : f));
        persistFoods(foods);
        return { foods };
      }),

    deleteFood: (id) =>
      set((s) => {
        const foods = s.foods.filter((f) => f.id !== id);
        persistFoods(foods);
        return { foods };
      }),
  };
});
