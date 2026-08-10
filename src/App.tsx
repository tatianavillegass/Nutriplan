import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { Clients } from './pages/Clients';
import { ClientDetail } from './pages/ClientDetail';
import { RecipeBankPage } from './pages/RecipeBankPage';
import { FoodCatalogPage } from './pages/FoodCatalogPage';
import { ClientView } from './pages/ClientView';
import { TemplatesPage } from './pages/TemplatesPage';
import { AuthPage } from './pages/AuthPage';
import { ClaveNueva } from './components/common/ClaveNueva';
import { useAuthStore } from './store/useAuthStore';
import { hayNube } from './utils/supabase';
import {
  arrancarSincronizacion,
  cargarDesdeNube,
  observarSincronizacion,
  pararSincronizacion,
} from './utils/sincronizacion';

const nav = [
  { to: '/clientes', label: 'Clientes' },
  { to: '/recetas', label: 'Banco de recetas' },
  { to: '/alimentos', label: 'Alimentos' },
  { to: '/plantillas', label: 'Mis plantillas' },
];

export default function App() {
  const sesion = useAuthStore((s) => s.sesion);
  const cuenta = useAuthStore((s) => s.actual());
  const perfil = useAuthStore((s) => s.perfil);
  const cargando = useAuthStore((s) => s.cargando);
  const recuperando = useAuthStore((s) => s.recuperando);
  const arrancar = useAuthStore((s) => s.arrancar);
  const cerrar = useAuthStore((s) => s.salir);
  const [guardado, setGuardado] = useState<'al-dia' | 'guardando' | 'error'>('al-dia');

  // Al abrir la app se mira si quedaba una sesión abierta en el servidor.
  useEffect(() => {
    void arrancar();
    observarSincronizacion(setGuardado);
    return () => observarSincronizacion(null);
  }, [arrancar]);

  // Con sesión: se baja lo que hay arriba y a partir de ahí se sube solo.
  useEffect(() => {
    if (!perfil) return;
    let vivo = true;
    void cargarDesdeNube(perfil).then(() => {
      if (vivo) arrancarSincronizacion(perfil);
    });
    return () => {
      vivo = false;
      pararSincronizacion();
    };
  }, [perfil]);

  if (cargando) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-sm text-slate-400">
        Abriendo tu cuenta…
      </div>
    );
  }

  // Llegando por el enlace del email, lo primero es la contraseña nueva.
  if (recuperando) return <ClaveNueva />;

  // Sin sesión sólo existe la pantalla de acceso.
  if (!sesion || !cuenta) return <AuthPage />;

  /** El cliente entra directo a su plan y no ve nada más. */
  const esCliente = cuenta.rol === 'cliente';
  const inicio = esCliente ? `/clientes/${cuenta.clientId}/vista` : '/clientes';

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-brand-100 bg-white/90 backdrop-blur no-print">
        <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-6 py-3">
          <NavLink to={inicio} className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-700 text-sm font-bold text-white">
              N
            </span>
            <span className="text-sm font-semibold tracking-tight text-brand-900">NutriPlan</span>
          </NavLink>

          {!esCliente && (
            <nav className="flex gap-1">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-sm transition ${
                      isActive
                        ? 'bg-brand-50 font-medium text-brand-800'
                        : 'text-slate-500 hover:text-slate-800'
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-3">
            {hayNube && (
              <span
                className={`text-[11px] ${
                  guardado === 'error'
                    ? 'text-amber-600'
                    : guardado === 'guardando'
                      ? 'text-slate-400'
                      : 'text-slate-300'
                }`}
                title={
                  guardado === 'error'
                    ? 'No se ha podido guardar en el servidor. Se reintenta solo.'
                    : 'Los cambios se guardan solos.'
                }
              >
                {guardado === 'error'
                  ? 'Sin conexión'
                  : guardado === 'guardando'
                    ? 'Guardando…'
                    : 'Guardado'}
              </span>
            )}
            <span className="text-xs text-slate-500">
              {cuenta.nombre}
              <span className="ml-1.5 text-slate-300">·</span>
              <span className="ml-1.5 text-[11px] text-slate-400">
                {esCliente ? 'cliente' : 'nutricionista'}
              </span>
            </span>
            <button
              onClick={() => void cerrar()}
              className="rounded-lg px-2.5 py-1.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <Routes>
          <Route path="/" element={<Navigate to={inicio} replace />} />
          <Route path="/clientes/:id/vista" element={<ClientView />} />
          {!esCliente && (
            <>
              <Route path="/clientes" element={<Clients />} />
              <Route path="/clientes/:id" element={<ClientDetail />} />
              <Route path="/recetas" element={<RecipeBankPage />} />
              <Route path="/alimentos" element={<FoodCatalogPage />} />
              <Route path="/plantillas" element={<TemplatesPage />} />
            </>
          )}
          {/* Cualquier otra ruta devuelve a lo suyo: el cliente no husmea. */}
          <Route path="*" element={<Navigate to={inicio} replace />} />
        </Routes>
      </main>
    </div>
  );
}
