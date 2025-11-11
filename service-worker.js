
self.addEventListener('install', (e)=>{
  e.waitUntil(
    caches.open('tenksmart-v2').then(c=>c.addAll([
      'index.html','style.css','script.js','manifest.json','data/demo-data.json',
      'assets/logo.png','lib/firebase-app.umd.js','lib/firebase-firestore.umd.js'
    ]))
  );
});
self.addEventListener('fetch', (e)=>{
  e.respondWith(caches.match(e.request).then(resp=>resp || fetch(e.request)));
});
