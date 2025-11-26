
import React, { Suspense, useEffect, ReactNode, ErrorInfo, Component } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Layout } from './components/Layout';
import { CookieConsent } from './components/CookieConsent';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { storageService } from './services/storageService';
import { Logo } from './components/Logo';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

// Lazy Loading dos Componentes das Views
const Dashboard = React.lazy(() => import('./views/Dashboard').then(module => ({ default: module.Dashboard })));
const CalendarView = React.lazy(() => import('./views/CalendarView').then(module => ({ default: module.CalendarView })));
const Cases = React.lazy(() => import('./views/Cases').then(module => ({ default: module.Cases })));
const CaseDetails = React.lazy(() => import('./views/CaseDetails').then(module => ({ default: module.CaseDetails })));
const Kanban = React.lazy(() => import('./views/Kanban').then(module => ({ default: module.Kanban })));
const Financial = React.lazy(() => import('./views/Financial').then(module => ({ default: module.Financial })));
const Clients = React.lazy(() => import('./views/Clients').then(module => ({ default: module.Clients })));
const ClientDetails = React.lazy(() => import('./views/ClientDetails').then(module => ({ default: module.ClientDetails })));
const UserProfile = React.lazy(() => import('./views/UserProfile').then(module => ({ default: module.UserProfile })));
const Settings = React.lazy(() => import('./views/Settings').then(module => ({ default: module.Settings })));
const Login = React.lazy(() => import('./views/Login').then(module => ({ default: module.Login })));
const EmailConfirmation = React.lazy(() => import('./views/EmailConfirmation').then(module => ({ default: module.EmailConfirmation })));
const Documents = React.lazy(() => import('./views/Documents').then(module => ({ default: module.Documents })));
const PrivacyPolicy = React.lazy(() => import('./views/PrivacyPolicy').then(module => ({ default: module.PrivacyPolicy })));
const TermsOfUse = React.lazy(() => import('./views/TermsOfUse').then(module => ({ default: module.TermsOfUse })));

// Error Boundary Component
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("CRITICAL: Uncaught error in application root:", error, errorInfo);
  }

  handleFactoryReset = () => {
    if (window.confirm("ATENÇÃO: Isso apagará todos os dados locais e reiniciará o sistema para o estado original. Útil se o app estiver travado devido a dados corrompidos. Continuar?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-slate-200 p-6">
          <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-8 text-center backdrop-blur-2xl shadow-glass relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-orange-500"></div>
            
            <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-rose-500/30 animate-pulse">
              <AlertTriangle className="text-rose-500" size={40} />
            </div>
            
            <h2 className="text-2xl font-bold mb-2 text-white">Erro Crítico</h2>
            <p className="text-slate-400 mb-6 text-sm leading-relaxed">
              O sistema encontrou uma inconsistência. Tente recarregar ou restaurar os dados.
            </p>
            
            <div className="bg-black/20 p-4 rounded-xl text-left mb-6 overflow-hidden max-h-32 overflow-y-auto border border-white/5 group">
               <p className="text-[10px] font-mono text-rose-400 break-words font-bold mb-1">ERROR LOG:</p>
               <p className="text-[10px] font-mono text-slate-500 break-words">{this.state.error?.message}</p>
            </div>

            <div className="space-y-3">
              <button 
                onClick={this.handleReload} 
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                <RefreshCw size={16} /> Recarregar
              </button>
              
              <button 
                onClick={this.handleFactoryReset}
                className="w-full py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={16} /> Restaurar Dados
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const LoadingScreen = () => (
  <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-white relative overflow-hidden transition-colors duration-300">
    <div className="absolute inset-0 opacity-30 pointer-events-none">
       <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]" />
       <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/20 rounded-full blur-[120px]" />
    </div>
    <div className="relative z-10 flex flex-col items-center gap-6">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full"></div>
        <Logo size={64} className="animate-pulse drop-shadow-lg" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="h-1 w-32 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 dark:bg-indigo-500 animate-progress origin-left w-full"></div>
        </div>
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase">Carregando</p>
      </div>
    </div>
    <style>{`
      @keyframes progress {
        0% { transform: scaleX(0); }
        50% { transform: scaleX(0.7); }
        100% { transform: scaleX(1); }
      }
      .animate-progress { animation: progress 1.5s ease-in-out infinite; }
    `}</style>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  
  return <Layout children={children} />;
};

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        <Route path="/confirm-email" element={<EmailConfirmation />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><CalendarView /></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
        <Route path="/clients/:id" element={<ProtectedRoute><ClientDetails /></ProtectedRoute>} />
        <Route path="/cases" element={<ProtectedRoute><Cases /></ProtectedRoute>} />
        <Route path="/cases/:id" element={<ProtectedRoute><CaseDetails /></ProtectedRoute>} />
        <Route path="/crm" element={<ProtectedRoute><Kanban /></ProtectedRoute>} />
        <Route path="/financial" element={<ProtectedRoute><Financial /></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfUse />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

const App: React.FC = () => {
  useEffect(() => {
    try {
      storageService.seedDatabase();
      storageService.runAutomations();
    } catch (e) {
      console.error("Failed to initialize app services:", e);
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <NotificationProvider>
              <Router>
                <Suspense fallback={<LoadingScreen />}>
                   <AnimatedRoutes />
                   <CookieConsent />
                </Suspense>
              </Router>
            </NotificationProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
