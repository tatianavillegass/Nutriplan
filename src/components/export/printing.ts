import { useCallback } from 'react';

/**
 * Exportación a PDF vía el diálogo de impresión del navegador.
 *
 * No usamos jsPDF: el layout de Fase 2 es una tabla tipográfica y el motor de
 * impresión respeta el CSS `@page` con mucha mejor fidelidad que un canvas.
 * El nombre del documento se usa como nombre de archivo sugerido.
 */
export function usePrintDocument(nombreArchivo: string) {
  return useCallback(() => {
    const previo = document.title;
    document.title = nombreArchivo.replace(/[\\/:*?"<>|]/g, '-');
    const restaurar = () => {
      document.title = previo;
      window.removeEventListener('afterprint', restaurar);
    };
    window.addEventListener('afterprint', restaurar);
    window.print();
    // Safari no siempre dispara afterprint.
    setTimeout(restaurar, 4000);
  }, [nombreArchivo]);
}

export function fechaLarga(d = new Date()): string {
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}
