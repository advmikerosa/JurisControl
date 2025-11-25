import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeNameMap: Record<string, string> = {
  '': 'Visão Geral',
  'clients': 'Clientes',
  'cases': 'Processos',
  'crm': 'CRM & Tarefas',
  'financial': 'Financeiro',
  'documents': 'Documentos',
  'profile': 'Meu Perfil',
  'settings': 'Configurações',
  'privacy': 'Privacidade',
  'terms': 'Termos de Uso'
};

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  if (location.pathname === '/') return null;

  return (
    <nav className="flex items-center text-xs text-slate-500 mb-6 animate-fade-in">
      <Link to="/" className="hover:text-indigo-400 transition-colors flex items-center gap-1">
        <Home size={12} />
        <span className="sr-only">Home</span>
      </Link>
      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        
        // Heuristic to detect dynamic IDs (numbers, uuids, or prefixes used in mockData)
        const isId = value.length > 15 || /\d/.test(value) || value.startsWith('case-') || value.startsWith('cli-') || value.startsWith('task-');
        const displayName = isId ? 'Detalhes' : (routeNameMap[value] || value.charAt(0).toUpperCase() + value.slice(1));

        return (
          <React.Fragment key={to}>
            <ChevronRight size={12} className="mx-2 opacity-50" />
            {isLast ? (
              <span className="font-medium text-slate-300">{displayName}</span>
            ) : (
              <Link to={to} className="hover:text-indigo-400 transition-colors">
                {displayName}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};