
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App.js';

// This file is a stub for the development environment.
// The main application is loaded from index.js.
// This content ensures that any development tools that
// might parse this file do not throw an error.

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement as HTMLElement);
    root.render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(App)
      )
    );
}