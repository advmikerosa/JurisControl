
// This file was identified as duplicate and unnecessary during QA Audit.
// The actual Layout component is located at src/components/Layout.tsx
// This file is kept as a placeholder to ensure imports don't break if any exist, 
// but it should be removed in the next refactor cycle.

import React from 'react';
import { Navigate } from 'react-router-dom';

export const Layout: React.FC = () => {
  return <Navigate to="/" replace />;
};
