import { createContext, useContext, type ReactNode } from 'react';

/**
 * SIN NÚMEROS DE ENERGÍA
 *
 * Hay clientas a las que ver las calorías les hace daño: con un trastorno de
 * conducta alimentaria detrás, cada cifra es una cuenta más que llevar y la
 * app pasa de ayudar a alimentar lo que se quiere dejar atrás. Con esto
 * encendido (`Client.sinNumeros`) ve su plan entero —sus porciones, sus
 * recetas, sus gramos— pero sin calorías ni macros por ningún lado.
 *
 * POR QUÉ UN CONTEXTO Y NO UNA PROP
 * =================================
 * Los números salen en una docena de sitios repartidos por su pantalla, y
 * varios de esos componentes los comparte con la pantalla de la
 * nutricionista. Pasándolo de mano en mano habría que tocar cada escala y
 * bastaría olvidarse de una para que el número se colara justo donde más
 * daño hace. Así se enciende una vez, en la raíz de su app, y **por defecto
 * está apagado**: la pantalla de la nutricionista no se entera, que ella sí
 * necesita las cifras para pautar.
 */
const Contexto = createContext(false);

export function SinNumerosProvider({
  activo,
  children,
}: {
  activo: boolean;
  children: ReactNode;
}) {
  return <Contexto.Provider value={activo}>{children}</Contexto.Provider>;
}

/** `true` cuando no hay que enseñar calorías ni macros. */
export function useSinNumeros(): boolean {
  return useContext(Contexto);
}

/**
 * Lo que sólo tiene sentido con números delante. Se esconde entero en vez de
 * dejar la etiqueta sin la cifra: «Calorías —» sigue siendo un recordatorio de
 * que hay un número que no estás mirando.
 */
export function ConNumeros({ children }: { children: ReactNode }) {
  return useSinNumeros() ? null : <>{children}</>;
}
