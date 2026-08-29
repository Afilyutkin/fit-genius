import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Self-hosted fonts: no render-blocking request to Google's CDN, and both
// families ship Cyrillic (the app runs in Russian as well as English).
import '@fontsource-variable/manrope';
import '@fontsource-variable/oswald';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);