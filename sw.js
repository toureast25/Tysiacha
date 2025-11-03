// 
// Service Worker для кэширования ресурсов PWA

const CACHE_NAME = 'tysiacha-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/index.js',
  '/constants.js',
  '/manifest.json',
  '/utils/gameLogic.js',
  '/components/App.js',
  '/components/Dice.js',
  '/components/Game.js',
  '/components/Lobby.js',
  '/components/RulesModal.js',
  '/components/SpectatorsModal.js',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Roboto+Condensed:ital,wght@0,100..900;1,100..900&family=Ruslan+Display&display=swap',
  'https://unpkg.com/mqtt/dist/mqtt.min.js',
  'https://esm.sh/react@18.2.0',
  'https://esm.sh/react-dom@18.2.0/client'
];

// Установка Service Worker и кэширование статических ассетов
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Обработка запросов: отдавать из кэша, если есть, иначе идти в сеть
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Если ресурс есть в кэше, отдаем его
        if (response) {
          return response;
        }
        // Иначе, делаем запрос к сети
        return fetch(event.request);
      }
    )
  );
});

// Активация Service Worker и удаление старых кэшей
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
