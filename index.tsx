import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (rootElement) {
  // Ensure the root isn't already mounted if hot-reloading
  if (!rootElement._reactRootContainer) {
      const root = ReactDOM.createRoot(rootElement);
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
  }
} else {
  console.error("CRITICAL: Root element 'root' not found in the document.");
}

// TypeScript helper for the custom property
declare global {
  interface Element {
    _reactRootContainer?: any;
  }
}