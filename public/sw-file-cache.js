self.addEventListener('fetch', function (event) {
    // Check if the url ends with  .wav
    if (event.request.url.endsWith('.wav')) {
        console.log('event.request.url', event.request.url);
        // Return from cache if available
        // Cache name is 'file-cache4'
        event.respondWith((async () => {
            // Try to get the response from a cache.
            const cachedResponse = await caches.match(event.request);
            // Return as playable audio
            return new Response(cachedResponse.body, {
                headers: {
                    'Content-Type': 'audio/wav'
                }
            }); // Return the cached response if we found one.
        })());
    }
});