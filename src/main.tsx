import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerServiceWorker } from './serviceWorker';
import App from './App';
import './styles.css';
const invitation = new URLSearchParams(location.hash.slice(1)).get('invite');
if (invitation && /^[a-f0-9-]{72}$/.test(invitation)) {
  sessionStorage.setItem('home-menu-invitation', invitation);
  history.replaceState(null, '', location.pathname + location.search);
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

registerServiceWorker();
