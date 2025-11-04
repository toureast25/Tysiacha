//
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App.js';

// --- Регистрация Service Worker для PWA ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Временное решение для обхода ошибки "origin does not match"
    // которая возникает в некоторых средах (например, scf.usercontent.goog),
    // когда Service Worker скрипт по какой-то причине пытается загрузиться с другого домена (ai.studio).
    // Это не решает корневую проблему конфигурации сервера/среды хостинга,
    // но предотвращает появление ошибки регистрации Service Worker в консоли.
    const currentHostname = window.location.hostname;
    if (currentHostname.includes('usercontent.goog')) {
      console.warn('ServiceWorker: Регистрация пропущена. Обнаружено потенциальное несоответствие источника в среде usercontent.goog. Подробности: ',
        "Скрипт Service Worker, похоже, пытается быть загруженным с другого домена (ai.studio), " +
        "не соответствующего текущему источнику приложения. Пожалуйста, убедитесь, что ваш файл sw.js " +
        "обслуживается с того же домена, что и приложение, или обратитесь к администратору хостинга. " +
        "Для сохранения PWA функциональности в этой среде может потребоваться изменение конфигурации сервера.");
      return;
    }

    // Добавление явного 'scope: /' для Service Worker.
    // Это может помочь в некоторых средах, хотя для корневого Service Worker
    // '/' обычно является значением по умолчанию. Ошибка "origin does not match"
    // часто указывает на проблему с конфигурацией сервера/среды хостинга,
    // где Service Worker URL может быть переписан или проксирован.
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(registration => {
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