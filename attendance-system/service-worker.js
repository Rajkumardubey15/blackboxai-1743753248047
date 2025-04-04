const CACHE_NAME = 'attendance-pwa-v1';
const urlsToCache = [
  '/',
  '/views/login.html',
  '/views/dashboard.html',
  '/views/admin.html',
  '/views/history.html',
  '/src/api/attendance.js',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});