import { useEffect, useMemo, useState } from "react";
import type { Client } from "../../types/client";
import { edadDe } from "../../types/client";
import type { FormulaGrasaId, Medicion } from "../../types/anthropometry";
import { useAppStore } from "../../store/useAppStore";
import { calcComposicion, calcularEvolucion } from "../../utils/anthropometry";
import { AnthroForm } from "./AnthroForm";
import { AnthroResults } from "./AnthroResults";
import { AnthroTimeline } from "./AnthroTimeline";
import { AnthroReportPDF } from "../export/AnthroReportPDF";
import { usePrintDocument } from "../export/printing";
import { Button, Card, EmptyState } from "../common/ui";

interface Props {
  client: Client;
  onClientChange: (patch: Partial<Client>) => void;
}

const hoy = () => new Date().toISOString().slice(0, 10);

/** Antropometría del cliente: medición actual, resultados y evolución. */
export function AnthroTab({ client, onClientChange }: Props) {
  const mediciones = useAppStore((s) => s.mediciones);
  const addMedicion = useAppStore((s) => s.addMedicion);
  const updateMedicion = useAppStore((s) => s.updateMedicion);
  const deleteMedicion = useAppStore((s) => s.deleteMedicion);

  const propias = useMemo(
    () =>
      mediciones
        .filter((m) => m.clientId === client.id)
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [mediciones, client.id],
  );

  const [seleccionada, setSeleccionada] = useState<string | undefined>(
    propias[propias.length - 1]?.id,
  );

  useEffect(() => {
    if (!seleccionada || !propias.some((m) => m.id === seleccionada)) {
      setSeleccionada(propias[propias.length - 1]?.id);
    }
  }, [propias, seleccionada]);

  const actual = propias.find((m) => m.id === seleccionada);
  const formula: FormulaGrasaId = client.formulaGrasa ?? "faulkner";

  const composicion = useMemo(
    () =>
      actual ? calcComposicion(actual, client.sexo, edadDe(client)) : undefined,
    [actual, client.sexo, edadDe(client)],
  );

  const evolucion = useMemo(
    () => calcularEvolucion(propias, client.sexo, edadDe(client), formula),
    [propias, client.sexo, edadDe(client), formula],
  );

  /**
   * El informe sale de la medición que esté abierta, no siempre de la última:
   * en consulta a veces se repasa una visita anterior y es justo ésa la que se
   * quiere imprimir.
   */
  const imprimir = usePrintDocument(
    `Antropometria ${client.nombre}${actual ? ` ${actual.fecha}` : ""}`,
  );

  const nueva = () => {
    const anterior = propias[propias.length - 1];
    const m = addMedicion({
      clientId: client.id,
      fecha: hoy(),
      peso: anterior?.peso ?? client.peso,
      talla: anterior?.talla ?? client.altura,
      pliegues: {},
      perimetros: {},
      diametros: anterior?.diametros ?? {},
    });
    setSeleccionada(m.id);
  };

  const cambiar = (patch: Partial<Medicion>) => {
    if (!actual) return;
    updateMedicion(actual.id, patch);
    // El peso de la última medición manda sobre la ficha del cliente.
    if (patch.peso && actual.id === propias[propias.length - 1]?.id) {
      onClientChange({ peso: patch.peso });
    }
    if (patch.talla) onClientChange({ altura: patch.talla });
  };

  if (!propias.length) {
    return (
      <Card
        title="Antropometría"
        subtitle="Perfil ISAK con seguimiento entre visitas"
      >
        <EmptyState title="Sin mediciones todavía">
          <p className="mb-3">
            Registra la primera medición para ver composición corporal,
            somatotipo y evolución.
          </p>
          <Button onClick={nueva}>Nueva medición</Button>
        </EmptyState>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4 screen-only">
        <Card
          title="Historial de mediciones"
          subtitle={`${propias.length} ${propias.length === 1 ? "visita registrada" : "visitas registradas"}`}
          actions={
            <div className="flex gap-2">
              {actual && composicion && (
                <Button variant="outline" onClick={imprimir}>
                  Exportar PDF
                </Button>
              )}
              <Button onClick={nueva}>Nueva medición</Button>
            </div>
          }
        >
          <AnthroTimeline
            evolucion={evolucion}
            mediciones={propias}
            seleccionada={seleccionada}
            onSeleccionar={setSeleccionada}
            onEliminar={(id) => {
              if (window.confirm("¿Eliminar esta medición?"))
                deleteMedicion(id);
            }}
          />
        </Card>

        {actual && composicion && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card
              title="Medidas"
              subtitle="Lo que no se mide se deja en blanco"
            >
              <AnthroForm medicion={actual} onChange={cambiar} />
            </Card>
            <Card
              title="Composición corporal"
              subtitle="Calculada con las medidas de esta visita"
            >
              <AnthroResults
                composicion={composicion}
                formula={formula}
                onFormula={(f) => onClientChange({ formulaGrasa: f })}
              />
            </Card>
          </div>
        )}
      </div>

      {/*
        La hoja que sale al imprimir. Va FUERA del bloque de pantalla, no
        dentro: la regla de impresión esconde `screen-only` entero, y un
        `print-only` metido ahí dentro se escondería con él.
      */}
      {actual && composicion && (
        <div className="print-only">
          <AnthroReportPDF
            client={client}
            medicion={actual}
            composicion={composicion}
            evolucion={evolucion}
            formula={formula}
            numeroVisita={propias.findIndex((m) => m.id === actual.id) + 1}
          />
        </div>
      )}
    </>
  );
}
