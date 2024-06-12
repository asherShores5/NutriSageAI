const CACHE_NAME = 'nutrisageai-cache-v1';
const urlsToCache = [
    '/',
    '/NutriSageAI/docs/index.html',
    '/NutriSageAI/docs/styles.css',
    '/NutriSageAI/docs/script.js',
    '/NutriSageAI/docs/images/favicon_io/android-chrome-192x192.png',
    '/NutriSageAI/docs/images/favicon_io/android-chrome-512x512.png',
    '/NutriSageAI/docs/images/favicon_io/apple-touch-icon.png',
    '/NutriSageAI/docs/images/favicon_io/favicon.ico'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache).catch((error) => {
                    console.error('Failed to add URLs to cache', error);
                });
            })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
