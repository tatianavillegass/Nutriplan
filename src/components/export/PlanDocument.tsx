import type { Client } from '../../types/client';
import type { Plan } from '../../types/plan';
import type { Receta } from '../../types/recipe';
import type { Alimento } from '../../types/food';
import { HojaNeveraPDF } from './HojaNeveraPDF';
import { PlanPDF } from './PlanPDF';
import { RecipeSheetPDF } from './RecipeSheetPDF';

/**
 * Documento imprimible del cliente. Vive oculto en pantalla (`print-only`) y
 * es lo único que sale al imprimir, así el PDF no arrastra la interfaz.
 * La fase decide el formato; los intercambios pautados son los mismos (§10.5).
 *
 * EN FASE 2 SÓLO HAY UNA HOJA, Y ES LA DE LA NEVERA
 * =================================================
 * Antes salía el mismo tablero de la pantalla en blanco y negro. Se ha
 * sustituido, no añadido: dos botones que dan dos PDF parecidos es el lío de
 * las dos tarjetas de pagos otra vez, y el documento de trabajo no lo
 * necesitaba nadie — la nutricionista tiene esos datos en su ficha y la clienta
 * lo que quiere es algo que se pueda colgar.
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
      {plan.fase === 1 ? (
        <RecipeSheetPDF client={client} plan={plan} recipes={recipes} foods={foods} />
      ) : plan.fase === 2 ? (
        <HojaNeveraPDF client={client} plan={plan} recipes={recipes} foods={foods} />
      ) : (
        <PlanPDF client={client} plan={plan} foods={foods} />
      )}
    </div>
  );
}
