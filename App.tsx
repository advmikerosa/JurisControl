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

// Lazy Loading Views
const Dashboard = React.lazy(() => import('./views/Dashboard').then(m => ({ default: m.Dashboard })));
const CalendarView = React.lazy(() => import('./views/CalendarView').then(m => ({ default: m.CalendarView })));
const Cases = React.lazy(() => import('./views/Cases').then(m => ({ default: m.Cases })));
const CaseDetails = React.lazy(() => import('./views/CaseDetails').then(m => ({ default: m.CaseDetails })));
const Kanban = React.lazy(() => import('./views/Kanban').then(m => ({ default: m.Kanban })));
const Financial = React.lazy(() => import('./views/Financial').then(m => ({ default: m.Financial })));
const Clients = React.lazy(() => import('./views/Clients').then(m => ({ default: m.Clients })));
const ClientDetails = React.lazy(() => import('./views/ClientDetails').then(m => ({ default: m.ClientDetails })));
const UserProfile = React.lazy(() => import('./views/UserProfile').then(m => ({ default: m.UserProfile })));
const Settings = React.lazy(() => import('./views/Settings').then(m => ({ default: m.Settings })));
const Login = React.lazy(() => import('./views/Login').then(m => ({ default: m.Login })));
const EmailConfirmation = React.lazy(() => import('./views/EmailConfirmation').then(m => ({ default: m.EmailConfirmation })));
const Documents = React.lazy(() => import('./views/Documents').then(m => ({ default: m.Documents })));
const PrivacyPolicy = React.lazy(() => import('./views/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const TermsOfUse = React.lazy(() => import('./views/TermsOfUse').then(m => ({ default: m.TermsOfUse })));

// Error Boundary
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App Error:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleReset = () => {
    if (window.confirm("Isso apagará os dados locais. Continuar?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-slate-200 p-6">
          <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-8 text-center backdrop-blur-2xl shadow-xl">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <AlertTriangle className="text-rose-500" size={32} />
            </div>
            <h2 className="text-xl font-bold mb-2 text-white">Ops! Algo deu errado.</h2>
            <p className="text-slate-400 mb-6 text-sm">O sistema encontrou um erro inesperado.</p>
            <div className="bg-black/30 p-3 rounded-lg text-left mb-6 overflow-hidden max-h-24 overflow-y-auto">
               <code className="text-xs text-rose-400 font-mono">{this.state.error?.message}</code>
            </div>
            <div className="flex gap-3">
              <button onClick={this.handleReload} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                <RefreshCw size={16} /> Tentar Novamente
              </button>
              <button onClick={this.handleReset} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                <Trash2 size={16} /> Resetar
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
  <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-[#0f172a] transition-colors">
    <Logo size={48} className="animate-pulse mb-4" />
    <div className="h-1 w-24 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-600 animate-progress w-full origin-left"></div>
    </div>
    <style>{`@keyframes progress { 0% { transform: scaleX(0); } 50% { transform: scaleX(0.7); } 100% { transform: scaleX(1); } } .animate-progress { animation: progress 1s ease-in-out infinite; }`}</style>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  
  return <Layout>{children}</Layout>;
};

const AppRoutes: React.FC = () => {
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
};

const App: React.FC = () => {
  useEffect(() => {
    storageService.runAutomations();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <NotificationProvider>
              <Router>
                <Suspense fallback={<LoadingScreen />}>
                   <AppRoutes />
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