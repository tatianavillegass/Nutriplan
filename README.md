# NutriPlan

App de planes nutricionales por intercambios: cálculo del GET, reparto de
porciones por comida y tres formas de entregárselo al cliente según su
autonomía.

## Qué hace

- **Cálculo GET** — TMB por Harris-Benedict, Owen y Mifflin-St. Jeor, factor de
  actividad, termogénesis y objetivo.
- **Antropometría ISAK** — pliegues, perímetros y diámetros; % graso por
  Faulkner, Yuhasz y Durnin-Womersley, masa muscular, somatotipo y evolución.
- **Cálculo del plan** — g/kg de proteína e hidrato, grasa por diferencia, y
  reparto en intercambios comida a comida con validación por semáforo.
- **Tres fases de entrega**
  - Fase 1 · recetas cerradas, con cambio de ingredientes por equivalentes.
  - Fase 2 · combinaciones con las cantidades ya hechas.
  - Fase 3 · el cliente marca porciones alimento a alimento.
- **Base de 280 alimentos** con nutrientes por 100 g; las porciones se derivan
  solas del macro ancla de cada subgrupo.
- **Seguimiento** — adherencia, evolución corporal y qué alimentos elige de
  verdad.
- **Cuentas** — la nutricionista se registra e invita a sus clientes.

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 492 tests
npm run lint
npm run build        # dist/ — lo que despliega Vercel
npm run build:file   # dist-file/index.html — un solo archivo, sin servidor
```

## Desplegar en Vercel

El repositorio ya trae `vercel.json` con el build configurado, así que Vercel
lo detecta solo.

1. Crea el repositorio en GitHub (sin README ni .gitignore, ya los hay aquí).
2. Conéctalo y sube la rama:

   ```bash
   git remote add origin https://github.com/TU-USUARIO/nutriplan.git
   git push -u origin main
   ```

3. En [vercel.com](https://vercel.com) → **Add New… → Project** → importa el
   repositorio. Framework *Vite*, build `npm run build`, salida `dist`.
4. **Deploy**. A partir de ahí, cada `git push` publica sola la versión nueva.

## Dónde viven los datos

Hoy todo se guarda en el navegador (LocalStorage): clientes, planes, recetas,
alimentos y cuentas. Esto tiene dos consecuencias que conviene tener claras:

- Cada navegador tiene sus propios datos. Lo que crees en el ordenador no
  aparece en el móvil.
- **Las contraseñas no están cifradas de verdad.** Se guardan con un hash
  simple; sirve para separar sesiones y probar el flujo, no para proteger
  datos reales.

Toda la persistencia pasa por `src/utils/storage.ts` y toda la lógica de
cuentas por `src/utils/auth.ts`. Migrar a Supabase es reimplementar esos dos
módulos: las pantallas no cambian.

## Estructura

```
src/
  data/         tabla de intercambios, catálogo de alimentos, plantillas
  types/        modelos: cliente, plan, receta, alimento, cuenta
  utils/        cálculos puros — GET, macros, porciones, combinaciones…
  components/   por fase (phase1, phase2, phase3) y por área
  pages/        clientes, ficha, vista del cliente, recetas, plantillas
  store/        estado (zustand) de datos y de sesión
```

Los cálculos están en funciones puras y con tests: cambiar una fórmula es
tocar un archivo de `utils/` y ver qué test se rompe.
