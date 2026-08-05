import type { Client } from '../../types/client';
import type { Plan } from '../../types/plan';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';
import { PlanPDF } from './PlanPDF';
import { RecipeSheetPDF } from './RecipeSheetPDF';

/**
 * Documento imprimible del cliente. Vive oculto en pantalla (`print-only`) y
 * es lo único que sale al imprimir, así el PDF no arrastra la interfaz.
 * La fase decide el formato; los intercambios pautados son los mismos (§10.5).
 */
export function PlanDocument({
  client,
  plan,
  recipes,
  foods,
}: {
  client: Client;
  plan: Plan;
  recipes: Receta[];
  foods: Alimento[];
}) {
  return (
    <div className="print-only">
      {plan.fase === 2 ? (
        <PlanPDF client={client} plan={plan} foods={foods} />
      ) : (
        <RecipeSheetPDF client={client} plan={plan} recipes={recipes} foods={foods} />
      )}
    </div>
  );
}
