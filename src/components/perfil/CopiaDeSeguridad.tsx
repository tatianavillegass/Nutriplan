import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  armarCopia,
  descargarCopia,
  nombreDelArchivo,
  pesoLegible,
  queLleva,
} from '../../utils/copiaDeSeguridad';
import { leerPlantillas, leerPlantillasDia } from '../../utils/plantillas';
import { leerRepartos } from '../../utils/repartos';
import { Button, Card } from '../common/ui';

/**
 * DESCARGAR UNA COPIA
 *
 * El plan gratuito del servidor no hace copias. Si algo se corrompe o se borra,
 * no hay de dónde tirar: se van las fichas, los planes y el registro de todas
 * las clientas. Esto es lo único que hay entre eso y perderlo todo, y por eso
 * está en un botón y no escondido.
 *
 * SE DICE QUÉ LLEVA ANTES DE DESCARGAR
 * ====================================
 * Una copia vacía pesa dos kilobytes y parece que ha funcionado igual. Con los
 * números delante —treinta y siete clientas, ciento veinte planes— se ve de un
 * vistazo si de verdad está todo, que es lo único que importa el día que haga
 * falta usarla.
 *
 * Y SE DICE DÓNDE GUARDARLA
 * =========================
 * Lo que baja son nombres, correos, pesos, fotos y patologías de personas
 * reales. Es una copia de verdad y por eso vale; también por eso no va al
 * escritorio ni a una carpeta compartida.
 */
export function CopiaDeSeguridad({ correo }: { correo?: string }) {
  const clients = useAppStore((s) => s.clients);
  const plans = useAppStore((s) => s.plans);
  const recipes = useAppStore((s) => s.recipes);
  const foods = useAppStore((s) => s.foods);
  const mediciones = useAppStore((s) => s.mediciones);
  const registros = useAppStore((s) => s.registros);
  const recursos = useAppStore((s) => s.recursos);
  const retos = useAppStore((s) => s.retos);
  const gastos = useAppStore((s) => s.gastos);

  const [bajada, setBajada] = useState<string | undefined>();

  const datos = useMemo(
    () => ({
      clients,
      plans,
      recipes,
      foods,
      mediciones,
      registros,
      recursos,
      retos,
      gastos,
      /*
       * Las plantillas viven en el navegador y no en el servidor, así que son
       * justo las que más falta hacen aquí: no están en ningún otro sitio.
       */
      plantillas: {
        despensa: leerPlantillas(),
        dia: leerPlantillasDia(),
        repartos: leerRepartos(),
      },
    }),
    [clients, plans, recipes, foods, mediciones, registros, recursos, retos, gastos],
  );

  const lleva = queLleva(datos);
  /* Se mide de verdad: las fotos van dentro y son casi todo el peso. */
  const peso = useMemo(() => JSON.stringify(datos).length, [datos]);

  const bajar = () => {
    const nombre = nombreDelArchivo();
    descargarCopia(armarCopia(datos, correo), nombre);
    setBajada(nombre);
  };

  return (
    <Card
      title="Copia de seguridad"
      subtitle="El servidor no hace copias por su cuenta. Esta es la tuya, y no cuesta nada"
    >
      <dl className="space-y-1.5 text-sm">
        <Fila que="Clientas" cuantas={lleva.clientas} />
        <Fila que="Planes" cuantas={lleva.planes} />
        <Fila que="Recetas" cuantas={lleva.recetas} />
        <Fila que="Mediciones" cuantas={lleva.mediciones} />
        <Fila que="Días registrados" cuantas={lleva.registros} />
        <div className="flex justify-between gap-3 pt-1">
          <dt className="text-slate-500">Tamaño</dt>
          <dd className="tnum font-medium text-slate-900">{pesoLegible(peso)}</dd>
        </div>
      </dl>

      <Button onClick={bajar} className="mt-4 w-full justify-center">
        Descargar copia
      </Button>

      {bajada && (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-snug text-emerald-800">
          Descargada como <strong className="font-medium">{bajada}</strong>. Guárdala en un sitio
          seguro y repítelo de vez en cuando: una copia de hace tres meses sirve a medias.
        </p>
      )}

      <p className="mt-3 text-xs leading-snug text-slate-500">
        El archivo lleva nombres, correos, medidas, fotos y patologías de tus clientas. Guárdalo
        como guardarías las historias en papel: en un disco tuyo o en una carpeta con contraseña,
        no en el escritorio ni en nada compartido.
      </p>

      {/*
        RESTAURAR NO ES UN BOTÓN
        Restaurar es sobrescribir. Un botón que pisa todas las fichas con lo de
        hace tres semanas hace más daño del que arregla el día que se pulsa sin
        querer, y el día que hace falta de verdad se usa una vez en la vida.
      */}
      <p className="mt-2 text-xs leading-snug text-slate-500">
        No hay botón de restaurar a propósito: sobrescribir todas las fichas de golpe es fácil de
        pulsar sin querer. Si algún día hace falta recuperar, con este archivo se puede — se hace
        con calma y mirando.
      </p>
    </Card>
  );
}

function Fila({ que, cuantas }: { que: string; cuantas: number }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 pb-1.5">
      <dt className="text-slate-500">{que}</dt>
      <dd className={`tnum font-medium ${cuantas ? 'text-slate-900' : 'text-slate-400'}`}>
        {cuantas}
      </dd>
    </div>
  );
}
