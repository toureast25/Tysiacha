// 
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App.js';

// --- Регистрация Service Worker для PWA ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Код нашего Service Worker
    const swCode = `
      const CACHE_NAME = 'tysiacha-cache-v3';
      const urlsToCache = [
        '/',
        '/index.html',
        '/style.css',
        '/manifest.json',
        '/index.js',
        '/constants.js',
        '/utils/gameLogic.js',
        '/components/App.js',
        '/components/Lobby.js',
        '/components/Game.js',
        '/components/GameUI.js',
        '/components/Dice.js',
        '/components/RulesModal.js',
        '/components/SpectatorsModal.js',
        '/components/KickConfirmModal.js',
        '/components/PlayerContextMenu.js'
      ];

      self.addEventListener('install', event => {
        event.waitUntil(
          caches.open(CACHE_NAME)
            .then(cache => {
              console.log('Opened cache');
              return cache.addAll(urlsToCache);
            })
        );
      });

      self.addEventListener('fetch', event => {
        if (event.request.method !== 'GET') {
          return;
        }
        
        if (event.request.mode === 'navigate') {
          event.respondWith(
            fetch(event.request).catch(() => caches.match('/'))
          );
          return;
        }

        event.respondWith(
          caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return fetch(event.request).then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, responseToCache);
                });
              }
              return networkResponse;
            });
          })
        );
      });

      self.addEventListener('activate', event => {
        const cacheWhitelist = [CACHE_NAME];
        event.waitUntil(
          caches.keys().then(cacheNames => {
            return Promise.all(
              cacheNames.map(cacheName => {
                if (cacheWhitelist.indexOf(cacheName) === -1) {
                  return caches.delete(cacheName);
                }
              })
            );
          })
        );
      });
    `;

    // Создаем Blob из кода Service Worker
    const swBlob = new Blob([swCode], { type: 'application/javascript' });
    // Создаем URL для нашего Blob
    const swUrl = URL.createObjectURL(swBlob);

    // Регистрируем Service Worker по этому URL
    navigator.serviceWorker.register(swUrl, { scope: '/' }).then(registration => {
      console.log('Embedded ServiceWorker registration successful with scope: ', registration.scope);
    }, err => {
      console.log('Embedded ServiceWorker registration failed: ', err);
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
