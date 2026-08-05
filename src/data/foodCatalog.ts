import type { Alimento } from '../types/food';

/**
 * CATÁLOGO DE ALIMENTOS — precargado con todas las opciones de §6.2.
 * Ampliable desde la interfaz (los añadidos llevan `custom: true`).
 */
export const FOOD_CATALOG: Alimento[] = [
  // ─────────────────────────── PROTEÍNA — desayuno / merienda
  { id: 'p-huevo', nombre: 'Huevo', grupo: 'proteicos_semigrasos', medida_casera: '1 huevo', gramos: 60, intercambios: 1, comidas_sugeridas: ['desayuno', 'almuerzo', 'merienda', 'cena'], alergenos: ['huevo'], apto: ['vegetariano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'p-claras', nombre: 'Claras de huevo', grupo: 'proteicos_magros', medida_casera: '2 claras', gramos: 60, unidad: 'ml', intercambios: 1, comidas_sugeridas: ['desayuno', 'almuerzo', 'merienda', 'cena'], alergenos: ['huevo'], apto: ['vegetariano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'p-yogur-prot', nombre: 'Yogur proteínas', grupo: 'proteicos_magros', medida_casera: '1/2 taza yogur proteínas', gramos: 70, intercambios: 1, comidas_sugeridas: ['desayuno', 'merienda'], alergenos: ['lactosa'], apto: ['vegetariano', 'sin_gluten'] },
  { id: 'p-jamon-cocido', nombre: 'Jamón cocido', grupo: 'proteicos_magros', medida_casera: '2 lonchas jamón cocido', gramos: 40, intercambios: 1, comidas_sugeridas: ['desayuno', 'almuerzo', 'merienda', 'cena'], alergenos: [], apto: ['sin_gluten', 'sin_lactosa'] },
  { id: 'p-queso-fresco-desn', nombre: 'Queso fresco desnatado', grupo: 'proteicos_magros', medida_casera: '1 tarrina peq. queso fresco desnatado', gramos: 62.5, intercambios: 1, comidas_sugeridas: ['desayuno', 'merienda'], alergenos: ['lactosa'], apto: ['vegetariano', 'sin_gluten'] },
  { id: 'p-cottage', nombre: 'Queso cottage', grupo: 'proteicos_magros', medida_casera: '1/4 tarrina queso cottage', gramos: 60, intercambios: 1, comidas_sugeridas: ['desayuno', 'merienda'], alergenos: ['lactosa'], apto: ['vegetariano', 'sin_gluten'] },
  { id: 'p-proteina-polvo', nombre: 'Proteína en polvo', grupo: 'proteicos_magros', medida_casera: '1 cuch. sopera proteína en polvo', gramos: 10, intercambios: 1, comidas_sugeridas: ['desayuno', 'merienda', 'extra'], alergenos: ['lactosa'], apto: ['vegetariano', 'sin_gluten'] },
  { id: 'p-leche-prot', nombre: 'Leche proteínas', grupo: 'proteicos_magros', medida_casera: '1/2 taza leche proteínas', gramos: 120, unidad: 'ml', intercambios: 1, comidas_sugeridas: ['desayuno', 'merienda', 'extra'], alergenos: ['lactosa'], apto: ['vegetariano', 'sin_gluten'] },

  // ─────────────────────────── PROTEÍNA — comida / cena
  { id: 'p-pollo', nombre: 'Pechuga de pollo', grupo: 'proteicos_magros', medida_casera: 'Filete pequeño', gramos: 30, equivalencia_cocido: 22, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['sin_gluten', 'sin_lactosa'] },
  { id: 'p-pavo', nombre: 'Pechuga de pavo', grupo: 'proteicos_magros', medida_casera: 'Filete pequeño', gramos: 30, equivalencia_cocido: 22, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['sin_gluten', 'sin_lactosa'] },
  { id: 'p-merluza', nombre: 'Merluza', grupo: 'proteicos_magros', medida_casera: 'Porción', gramos: 35, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: ['pescado'], apto: ['sin_gluten', 'sin_lactosa'] },
  { id: 'p-atun-nat', nombre: 'Atún al natural', grupo: 'proteicos_magros', medida_casera: '1/2 lata', gramos: 30, intercambios: 1, comidas_sugeridas: ['almuerzo', 'comida', 'cena'], alergenos: ['pescado'], apto: ['sin_gluten', 'sin_lactosa'] },
  { id: 'p-ternera', nombre: 'Ternera magra', grupo: 'proteicos_semigrasos', medida_casera: 'Porción', gramos: 30, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['sin_gluten', 'sin_lactosa'] },
  { id: 'p-salmon', nombre: 'Salmón', grupo: 'proteicos_grasos', medida_casera: 'Porción', gramos: 30, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: ['pescado'], apto: ['sin_gluten', 'sin_lactosa'] },
  { id: 'p-tofu', nombre: 'Tofu firme', grupo: 'proteicos_semigrasos', medida_casera: 'Porción', gramos: 50, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: ['soja'], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },

  // ─────────────────────────── CARBOHIDRATO — desayuno / merienda
  { id: 'c-avena', nombre: 'Avena', grupo: 'almidones', medida_casera: '1/4 taza avena', gramos: 25, intercambios: 1, comidas_sugeridas: ['desayuno', 'merienda', 'extra'], alergenos: ['gluten'], apto: ['vegetariano', 'vegano', 'sin_lactosa'] },
  { id: 'c-cereales-int', nombre: 'Cereales integrales', grupo: 'almidones', medida_casera: '1/4 taza cereales integrales', gramos: 20, intercambios: 1, comidas_sugeridas: ['desayuno', 'merienda'], alergenos: ['gluten'], apto: ['vegetariano', 'vegano', 'sin_lactosa'] },
  { id: 'c-pan-integral', nombre: 'Pan integral', grupo: 'almidones', medida_casera: '1 tajada pan integral (1 × 30 g)', gramos: 30, intercambios: 1, comidas_sugeridas: ['desayuno', 'almuerzo', 'merienda', 'cena'], alergenos: ['gluten'], apto: ['vegetariano', 'vegano', 'sin_lactosa'] },
  { id: 'c-tortilla-maiz', nombre: 'Tortilla de maíz', grupo: 'almidones', medida_casera: '1 tortilla de maíz', gramos: 32, intercambios: 1, comidas_sugeridas: ['desayuno', 'almuerzo', 'comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'c-wasa', nombre: 'Pan wasa', grupo: 'almidones', medida_casera: '1 unidad pan wasa', gramos: 22, intercambios: 1, comidas_sugeridas: ['desayuno', 'almuerzo', 'merienda'], alergenos: ['gluten'], apto: ['vegetariano', 'vegano', 'sin_lactosa'] },
  { id: 'c-tortitas-arroz', nombre: 'Tortitas de arroz', grupo: 'almidones', medida_casera: '2 tortitas de arroz (2 × 8.25 g)', gramos: 16.5, intercambios: 1, comidas_sugeridas: ['desayuno', 'merienda', 'extra'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'c-fruta-porcion', nombre: 'Porción de fruta', grupo: 'fruta', medida_casera: 'Porción de fruta (150–200 g)', gramos: 175, intercambios: 1, comidas_sugeridas: ['desayuno', 'almuerzo', 'merienda', 'extra'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },

  // ─────────────────────────── CARBOHIDRATO — comida / cena
  { id: 'c-arroz', nombre: 'Arroz', grupo: 'almidones', medida_casera: '1/4 taza arroz', gramos: 20, equivalencia_cocido: 45, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'c-pasta', nombre: 'Pasta', grupo: 'almidones', medida_casera: '1/2 taza pasta', gramos: 25, equivalencia_cocido: 75, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: ['gluten'], apto: ['vegetariano', 'vegano', 'sin_lactosa'] },
  { id: 'c-papa', nombre: 'Papa', grupo: 'almidones', medida_casera: '1 papa pequeña', gramos: 100, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'c-cuscus', nombre: 'Cuscús', grupo: 'almidones', medida_casera: '1/2 taza cuscús', gramos: 25, equivalencia_cocido: 56, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: ['gluten'], apto: ['vegetariano', 'vegano', 'sin_lactosa'] },
  { id: 'c-quinoa', nombre: 'Quinoa', grupo: 'almidones', medida_casera: '1/2 taza quinoa', gramos: 20, equivalencia_cocido: 60, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'c-legumbres', nombre: 'Legumbres', grupo: 'legumbres', medida_casera: '1/2 taza legumbres', gramos: 100, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'c-batata', nombre: 'Batata', grupo: 'almidones', medida_casera: '1 batata', gramos: 70, intercambios: 1, comidas_sugeridas: ['comida', 'cena', 'extra'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'c-wasa-2', nombre: 'Tostadas wasa', grupo: 'almidones', medida_casera: '2 tostadas wasa (2 × 11 g)', gramos: 22, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: ['gluten'], apto: ['vegetariano', 'vegano', 'sin_lactosa'] },
  { id: 'c-tortilla-integral', nombre: 'Tortilla integral', grupo: 'almidones', medida_casera: '1 tortilla integral', gramos: 36, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: ['gluten'], apto: ['vegetariano', 'vegano', 'sin_lactosa'] },
  { id: 'c-pita', nombre: 'Pan de pita', grupo: 'almidones', medida_casera: '1/2 pan de pita', gramos: 30, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: ['gluten'], apto: ['vegetariano', 'vegano', 'sin_lactosa'] },

  // ─────────────────────────── GRASA
  { id: 'g-aceite', nombre: 'Aceite de oliva', grupo: 'grasas', medida_casera: '1 cdta aceite de oliva', gramos: 5, intercambios: 1, comidas_sugeridas: ['desayuno', 'almuerzo', 'comida', 'merienda', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'g-aguacate', nombre: 'Aguacate hass', grupo: 'grasas', medida_casera: '1/2 aguacate hass', gramos: 40, intercambios: 1, comidas_sugeridas: ['desayuno', 'almuerzo', 'comida', 'merienda', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'g-chia', nombre: 'Semillas de chía', grupo: 'grasas', medida_casera: '1 cda semillas de chía', gramos: 20, intercambios: 1, comidas_sugeridas: ['desayuno', 'merienda', 'comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'g-cacao', nombre: 'Cacao', grupo: 'grasas', medida_casera: '1 cda sopera cacao', gramos: 10, intercambios: 1, comidas_sugeridas: ['desayuno', 'merienda'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'g-crema-cacahuete', nombre: 'Crema de cacahuete', grupo: 'grasas', medida_casera: '1/2 cuch. sopera crema de cacahuete', gramos: 10, intercambios: 1, comidas_sugeridas: ['desayuno', 'merienda'], alergenos: ['frutos_secos'], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'g-havarti', nombre: 'Queso Havarti light', grupo: 'grasas', medida_casera: '1 rebanada queso Havarti light', gramos: 20, intercambios: 1, comidas_sugeridas: ['desayuno', 'merienda'], alergenos: ['lactosa'], apto: ['vegetariano', 'sin_gluten'] },
  { id: 'g-feta', nombre: 'Queso feta', grupo: 'grasas', medida_casera: 'Porción queso feta', gramos: 15, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: ['lactosa'], apto: ['vegetariano', 'sin_gluten'] },
  { id: 'g-hummus', nombre: 'Hummus', grupo: 'grasas', medida_casera: '1 cda sopera hummus', gramos: 20, intercambios: 1, comidas_sugeridas: ['almuerzo', 'comida', 'merienda', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'], grasa_prot: true },

  // ─────────────────────────── MERIENDA "GRASA PROT"
  { id: 'gp-frutos-secos', nombre: 'Frutos secos', grupo: 'grasas', medida_casera: '1/4 taza frutos secos', gramos: 15, intercambios: 1, comidas_sugeridas: ['merienda', 'almuerzo', 'extra'], alergenos: ['frutos_secos'], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'], grasa_prot: true },
  { id: 'gp-queso-fresco', nombre: 'Queso fresco', grupo: 'proteicos_semigrasos', medida_casera: '1 vasito queso fresco', gramos: 60, intercambios: 1, comidas_sugeridas: ['merienda', 'almuerzo'], alergenos: ['lactosa'], apto: ['vegetariano', 'sin_gluten'], grasa_prot: true },

  // ─────────────────────────── VERDURAS (ilimitadas)
  { id: 'v-brocoli', nombre: 'Brócoli', grupo: 'verduras', medida_casera: '1 taza', gramos: 100, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-ensalada', nombre: 'Ensalada mixta', grupo: 'verduras', medida_casera: '1 plato', gramos: 100, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-calabacin', nombre: 'Calabacín', grupo: 'verduras', medida_casera: '1 taza', gramos: 100, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-pimiento', nombre: 'Pimiento', grupo: 'verduras', medida_casera: '1 unidad', gramos: 100, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-espinaca', nombre: 'Espinaca', grupo: 'verduras', medida_casera: '2 tazas', gramos: 100, intercambios: 1, comidas_sugeridas: ['comida', 'cena', 'desayuno'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-cebolla', nombre: 'Cebolla', grupo: 'verduras', medida_casera: '1/2 unidad', gramos: 100, intercambios: 1, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },

  // ─────────────────────────── AZÚCARES
  { id: 'a-miel', nombre: 'Miel', grupo: 'azucares', medida_casera: '1 cdta', gramos: 12, intercambios: 1, comidas_sugeridas: ['desayuno', 'merienda', 'extra'], alergenos: [], apto: ['vegetariano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'a-mermelada', nombre: 'Mermelada', grupo: 'azucares', medida_casera: '1 cdta', gramos: 15, intercambios: 1, comidas_sugeridas: ['desayuno', 'merienda'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'a-choco-negro', nombre: 'Chocolate negro 85%', grupo: 'azucares', medida_casera: '1 onza', gramos: 10, intercambios: 1, comidas_sugeridas: ['merienda', 'cena'], alergenos: ['lactosa'], apto: ['vegetariano', 'sin_gluten'] },
];

export const FOOD_BY_ID = Object.fromEntries(FOOD_CATALOG.map((f) => [f.id, f]));
