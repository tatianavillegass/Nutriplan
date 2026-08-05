# NutriPlan

App de planes de alimentación por intercambios (equivalencias) para nutricionistas.
React + TypeScript + Vite + Tailwind. Los datos se guardan en el navegador (LocalStorage).

## Verla funcionando

**Opción rápida — sin instalar nada:** abre `NutriPlan.html` (en la carpeta del proyecto)
haciendo doble clic. Es la app entera en un solo archivo.

**Opción desarrollo:**

```bash
cd nutriplan
npm install
npm run dev        # http://localhost:5173
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Compila a `dist/` (varios archivos) — para subir a un hosting |
| `npm run build:file` | Compila a `dist-file/index.html` — todo en un archivo |
| `npm test` | 47 tests de los cálculos y las reglas de negocio |
| `npm run lint` | Oxlint |

## Desplegar

La app es 100% estática (no necesita servidor ni base de datos).

- **Netlify / Vercel:** arrastra la carpeta `dist/` a su panel, o conecta el repo
  con `build: npm run build` y `publish: dist`.
- **GitHub Pages:** sube el contenido de `dist/`. Las rutas son relativas
  (`base: './'`) y el router es `HashRouter`, así que funciona en subdirectorios
  sin configurar redirecciones.
- **Compartir un archivo suelto:** manda `NutriPlan.html` por email o WeTransfer.

## Estructura

```
src/
  data/       exchangeGroups.ts  ← tabla de intercambios (fuente de verdad)
              activityFactors.ts · foodCatalog.ts · seedRecipes.ts · demoSeed.ts
  types/      client · plan · recipe · food · calculations
  utils/      bmr · energy · macros · exchanges · validation
              recipeScaling · recipeMatcher · substitutions · storage
  components/ common · planning · phase1 · phase2 · export
  pages/      Clients · ClientDetail · ClientView · RecipeBankPage · FoodCatalogPage
  store/      useAppStore.ts (Zustand + LocalStorage)
```

Todos los cálculos son funciones puras en `src/utils/`, separadas de la interfaz
y cubiertas por tests.

## Notas de cálculo

- Se calculan **tres fórmulas de TMB** (Harris-Benedict revisada, Owen,
  Mifflin-St. Jeor) y su media. La nutricionista elige cuál usar.
- El caso de referencia de la hoja original (hombre, 27 a, 69 kg, 185 cm →
  TMB 1686 · GET 2781 · ×1.2 → 3337 kcal) sólo se reproduce con la
  **Harris-Benedict de 1919**, que se incluye como opción. Con la revisada
  la media es 1682 y el objetivo 3330.
- El GET se **trunca** a entero antes de aplicar el ajuste de objetivo, igual
  que hacía la hoja de cálculo (`getRounding: 'truncate'` en `utils/energy.ts`).
- La **grasa nunca se introduce a mano**: es el residuo calórico tras proteína
  y carbohidratos.
- Los intercambios admiten medios (0.5).
- Redondeo de gramajes: múltiplos de 5 g a partir de 20 g; 1 g por debajo.

## Migrar a backend

`src/utils/storage.ts` es la única capa que toca LocalStorage. Para pasar a
Supabase basta reimplementar ese módulo; los componentes no cambian.

## Datos de ejemplo

La primera vez que se abre, la app carga un cliente de ejemplo con dos tipos de
día ya repartidos. Se puede borrar desde la lista de clientes.
