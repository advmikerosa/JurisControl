import React, { Component, Suspense, ReactNode, ErrorInfo } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CookieConsent } from './components/CookieConsent';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
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
const AuthCallback = React.lazy(() => import('./views/AuthCallback').then(m => ({ default: m.AuthCallback })));

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Error Boundary
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white p-6">
          <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-2xl font-bold mb-2">Algo deu errado</h1>
            <p className="text-slate-400 mb-6 text-sm">
              O sistema encontrou um erro inesperado. Tente recarregar ou resetar a aplicação se o problema persistir.
            </p>
            <div className="bg-black/20 p-4 rounded-lg mb-6 text-left overflow-auto max-h-32">
              <code className="text-xs text-rose-300 font-mono">
                {this.state.error?.message || 'Erro desconhecido'}
              </code>
            </div>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold transition-colors flex items-center gap-2"
              >
                <RefreshCw size={18} /> Recarregar
              </button>
              <button 
                onClick={this.handleReset}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition-colors flex items-center gap-2"
              >
                <Trash2 size={18} /> Resetar App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading Spinner
const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f172a]">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Logo size={24} />
      </div>
    </div>
    <p className="mt-4 text-slate-400 font-medium animate-pulse">Carregando JurisControl...</p>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Main App Component
const AppContent = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
          <Route path="/confirm-email" element={<EmailConfirmation />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfUse />} />

          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><Layout><CalendarView /></Layout></ProtectedRoute>} />
          <Route path="/cases" element={<ProtectedRoute><Layout><Cases /></Layout></ProtectedRoute>} />
          <Route path="/cases/:id" element={<ProtectedRoute><Layout><CaseDetails /></Layout></ProtectedRoute>} />
          <Route path="/crm" element={<ProtectedRoute><Layout><Kanban /></Layout></ProtectedRoute>} />
          <Route path="/financial" element={<ProtectedRoute><Layout><Financial /></Layout></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute><Layout><Clients /></Layout></ProtectedRoute>} />
          <Route path="/clients/:id" element={<ProtectedRoute><Layout><ClientDetails /></Layout></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Layout><UserProfile /></Layout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute><Layout><Documents /></Layout></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <CookieConsent />
      </Suspense>
    </Router>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <NotificationProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </NotificationProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}