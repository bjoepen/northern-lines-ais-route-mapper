import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './AppShell.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
