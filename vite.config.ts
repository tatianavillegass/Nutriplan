import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * `npm run build`      → dist/  (varios archivos, para subir a un hosting)
 * `npm run build:file` → dist-file/index.html (todo en uno, se abre con doble clic)
 *
 * Rutas relativas (`base: './'`) para que funcione en la raíz de un dominio,
 * en un subdirectorio o abierto directamente desde el disco.
 */
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss(), ...(mode === 'singlefile' ? [viteSingleFile()] : [])],
}));
