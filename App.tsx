

import React, { Suspense, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CookieConsent } from './components/CookieConsent';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { storageService } from './services/storageService';

// Lazy Loading dos Componentes das Views
// Adaptação para Named Exports
const Dashboard = React.lazy(() => import('./views/Dashboard').then(module => ({ default: module.Dashboard })));
const Cases = React.lazy(() => import('./views/Cases').then(module => ({ default: module.Cases })));
const CaseDetails = React.lazy(() => import('./views/CaseDetails').then(module => ({ default: module.CaseDetails }))); // NEW VIEW
const Kanban = React.lazy(() => import('./views/Kanban').then(module => ({ default: module.Kanban })));
const Financial = React.lazy(() => import('./views/Financial').then(module => ({ default: module.Financial })));
const Clients = React.lazy(() => import('./views/Clients').then(module => ({ default: module.Clients })));
const ClientDetails = React.lazy(() => import('./views/ClientDetails').then(module => ({ default: module.ClientDetails })));
const UserProfile = React.lazy(() => import('./views/UserProfile').then(module => ({ default: module.UserProfile })));
const Settings = React.lazy(() => import('./views/Settings').then(module => ({ default: module.Settings })));
const Login = React.lazy(() => import('./views/Login').then(module => ({ default: module.Login })));
const Documents = React.lazy(() => import('./views/Documents').then(module => ({ default: module.Documents })));
const PrivacyPolicy = React.lazy(() => import('./views/PrivacyPolicy').then(module => ({ default: module.PrivacyPolicy })));
const TermsOfUse = React.lazy(() => import('./views/TermsOfUse').then(module => ({ default: module.TermsOfUse })));

const LoadingScreen = () => (
  <div className="flex items-center justify-center h-screen w-full bg-[#0f172a] text-indigo-500">
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-16 h-16">
        <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-500/30 rounded-full"></div>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
      <p className="text-sm font-medium animate-pulse">Carregando JurisControl...</p>
    </div>
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
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
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
  );
};

const App: React.FC = () => {
  // Inicializa DB na montagem e roda automações
  useEffect(() => {
    storageService.seedDatabase();
    storageService.runAutomations();
  }, []);

  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Suspense fallback={<LoadingScreen />}>
             <AppRoutes />
             <CookieConsent />
          </Suspense>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;