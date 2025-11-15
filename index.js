import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App.js';

// --- Регистрация Service Worker для PWA ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Используем относительный путь 'sw.js'. Это ключевое исправление для корректной работы
    // на платформах типа GitHub Pages, где проект может находиться в под-директории.
    navigator.serviceWorker.register('sw.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}


// --- Точка входа в приложение ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Не удалось найти корневой элемент для монтирования");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  React.createElement(
    React.StrictMode,
    null,
    React.createElement(App)
  )
);