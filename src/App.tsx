import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { Clients } from './pages/Clients';
import { ClientDetail } from './pages/ClientDetail';
import { RecipeBankPage } from './pages/RecipeBankPage';
import { FoodCatalogPage } from './pages/FoodCatalogPage';
import { ClientView } from './pages/ClientView';

const nav = [
  { to: '/clientes', label: 'Clientes' },
  { to: '/recetas', label: 'Banco de recetas' },
  { to: '/alimentos', label: 'Catálogo' },
];

export default function App() {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-brand-100 bg-white/90 backdrop-blur no-print">
        <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-6 py-3">
          <NavLink to="/clientes" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-700 text-sm font-bold text-white">
              N
            </span>
            <span className="text-sm font-semibold tracking-tight text-brand-900">NutriPlan</span>
          </NavLink>
          <nav className="flex gap-1">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm transition ${
                    isActive ? 'bg-brand-50 font-medium text-brand-800' : 'text-slate-500 hover:text-slate-800'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/clientes" replace />} />
          <Route path="/clientes" element={<Clients />} />
          <Route path="/clientes/:id" element={<ClientDetail />} />
          <Route path="/clientes/:id/vista" element={<ClientView />} />
          <Route path="/recetas" element={<RecipeBankPage />} />
          <Route path="/alimentos" element={<FoodCatalogPage />} />
        </Routes>
      </main>
    </div>
  );
}
