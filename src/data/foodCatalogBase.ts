import type { Alimento } from '../types/food';

/**
 * COMPLEMENTOS DEL CATÁLOGO
 *
 * La hoja "APORTE ALIMENTOS" no incluye verduras (son ilimitadas, no hace
 * falta pautarlas) ni azúcares. La app sí los necesita: las verduras para la
 * nota de "medio plato" y para las recetas, y los azúcares para poder pautar
 * ese subgrupo. Estos no vienen de la hoja: revísalos cuando quieras.
 */
export const FOOD_CATALOG_COMPLEMENTOS: Alimento[] = [
  { id: 'v-brocoli', nombre: 'Brocoli', grupo: 'verduras', medida_casera: '1 taza', gramos: 100, intercambios: 1, nutrientes: { kcal: 34, hc: 7, proteina: 2.8, grasa: 0.4, fibra: 2.6 }, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-espinaca', nombre: 'Espinaca', grupo: 'verduras', medida_casera: '2 tazas', gramos: 100, intercambios: 1, nutrientes: { kcal: 23, hc: 3.6, proteina: 2.9, grasa: 0.4, fibra: 2.2 }, comidas_sugeridas: ['desayuno', 'comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-tomate', nombre: 'Tomate', grupo: 'verduras', medida_casera: '2 unidades', gramos: 100, intercambios: 1, nutrientes: { kcal: 18, hc: 3.9, proteina: 0.9, grasa: 0.2, fibra: 1.2 }, comidas_sugeridas: ['almuerzo', 'comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-lechuga', nombre: 'Lechuga', grupo: 'verduras', medida_casera: '3 tazas', gramos: 100, intercambios: 1, nutrientes: { kcal: 15, hc: 2.9, proteina: 1.4, grasa: 0.2, fibra: 1.3 }, comidas_sugeridas: ['almuerzo', 'comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-calabacin', nombre: 'Calabacin', grupo: 'verduras', medida_casera: '1 taza', gramos: 100, intercambios: 1, nutrientes: { kcal: 17, hc: 3.1, proteina: 1.2, grasa: 0.3, fibra: 1 }, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-pimiento', nombre: 'Pimiento', grupo: 'verduras', medida_casera: '1 unidad', gramos: 100, intercambios: 1, nutrientes: { kcal: 31, hc: 6, proteina: 1, grasa: 0.3, fibra: 2.1 }, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-cebolla', nombre: 'Cebolla', grupo: 'verduras', medida_casera: '1/2 unidad', gramos: 100, intercambios: 1, nutrientes: { kcal: 40, hc: 9, proteina: 1.1, grasa: 0.1, fibra: 1.7 }, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-zanahoria', nombre: 'Zanahoria', grupo: 'verduras', medida_casera: '2 unidades', gramos: 100, intercambios: 1, nutrientes: { kcal: 41, hc: 9.6, proteina: 0.9, grasa: 0.2, fibra: 2.8 }, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-judia-verde', nombre: 'Judia verde', grupo: 'verduras', medida_casera: '1 taza', gramos: 100, intercambios: 1, nutrientes: { kcal: 31, hc: 7, proteina: 1.8, grasa: 0.2, fibra: 3.4 }, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-champinon', nombre: 'Champinones', grupo: 'verduras', medida_casera: '1 taza', gramos: 100, intercambios: 1, nutrientes: { kcal: 22, hc: 3.3, proteina: 3.1, grasa: 0.3, fibra: 1 }, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-berenjena', nombre: 'Berenjena', grupo: 'verduras', medida_casera: '1 taza', gramos: 100, intercambios: 1, nutrientes: { kcal: 25, hc: 5.9, proteina: 1, grasa: 0.2, fibra: 3 }, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-pepino', nombre: 'Pepino', grupo: 'verduras', medida_casera: '1 unidad', gramos: 100, intercambios: 1, nutrientes: { kcal: 15, hc: 3.6, proteina: 0.7, grasa: 0.1, fibra: 0.5 }, comidas_sugeridas: ['almuerzo', 'comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-esparragos', nombre: 'Esparragos', grupo: 'verduras', medida_casera: '8 unidades', gramos: 100, intercambios: 1, nutrientes: { kcal: 20, hc: 3.9, proteina: 2.2, grasa: 0.1, fibra: 2.1 }, comidas_sugeridas: ['comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'v-ensalada', nombre: 'Ensalada mixta', grupo: 'verduras', medida_casera: '1 plato', gramos: 100, intercambios: 1, nutrientes: { kcal: 20, hc: 3, proteina: 1.4, grasa: 0.2, fibra: 1.8 }, comidas_sugeridas: ['almuerzo', 'comida', 'cena'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },

  { id: 'az-miel', nombre: 'Miel', grupo: 'azucares', medida_casera: '2 cdtas', gramos: 12, intercambios: 1, nutrientes: { kcal: 304, hc: 82, proteina: 0.3, grasa: 0, azucar: 82 }, comidas_sugeridas: ['desayuno', 'merienda', 'extra'], alergenos: [], apto: ['vegetariano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'az-mermelada', nombre: 'Mermelada', grupo: 'azucares', medida_casera: '1 cda', gramos: 14, intercambios: 1, nutrientes: { kcal: 278, hc: 69, proteina: 0.4, grasa: 0.1, azucar: 50 }, comidas_sugeridas: ['desayuno', 'merienda'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'az-azucar', nombre: 'Azucar', grupo: 'azucares', medida_casera: '2 cdtas', gramos: 10, intercambios: 1, nutrientes: { kcal: 387, hc: 100, proteina: 0, grasa: 0, azucar: 100 }, comidas_sugeridas: ['desayuno', 'merienda'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
  { id: 'az-sirope-arce', nombre: 'Sirope de arce', grupo: 'azucares', medida_casera: '1 cdta', gramos: 15, intercambios: 1, nutrientes: { kcal: 260, hc: 67, proteina: 0, grasa: 0.1, azucar: 60 }, comidas_sugeridas: ['desayuno', 'merienda'], alergenos: [], apto: ['vegetariano', 'vegano', 'sin_gluten', 'sin_lactosa'] },
];
