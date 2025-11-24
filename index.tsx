import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const mountApp = () => {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    console.error("CRITICAL: Root element not found. Retrying in 100ms...");
    setTimeout(mountApp, 100);
    return;
  }

  // Previne múltiplas montagens
  if (rootElement.hasAttribute('data-mounted')) return;
  rootElement.setAttribute('data-mounted', 'true');

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}