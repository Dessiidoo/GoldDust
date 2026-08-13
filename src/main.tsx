import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import TrendsView from './TrendsView.tsx';
import './index.css';

// App.tsx references TrendsView directly; expose the component during module bootstrap
// so the existing UI can use the newly restored Trends screen without rewriting the large App file.
(globalThis as any).TrendsView = TrendsView;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
