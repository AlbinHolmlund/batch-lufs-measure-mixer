// Register the service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {// Register a service worker
        navigator.serviceWorker.register(window.PUBLIC_URL + '/sw-file-cache.js').then(function (reg) {
            console.log('Service worker registered!', reg);
        }).catch(function (err) {
            console.log('Service worker registration failed: ', err);
        });
    });
}

// In electron.js, add this to the createWindow function:
// win.webContents.session.setCacheEnabled(false);

const slugify = (str) => {
    const map = {
        '-': ' ',
        '-': '_',
        'a': 'á|à|ã|â|À|Á|Ã|Â',
        'e': 'é|è|ê|É|È|Ê',
        'i': 'í|ì|î|Í|Ì|Î',
        'o': 'ó|ò|ô|õ|Ó|Ò|Ô|Õ',
        'u': 'ú|ù|û|ü|Ú|Ù|Û|Ü',
        'c': 'ç|Ç',
        'n': 'ñ|Ñ',
    };
    for (const pattern in map) {
        str = str.replace(new RegExp(map[pattern], 'g'), pattern);
    }
    return str;
};


// Function to cache files and return URLs
export function cacheFiles(fileList) {
    // fileList:
    /*[
        {
            name: 'test.mp3',
            dataUri: 'blob:https://localhost:3000/...'
        }
    ]*/
    return new Promise((resolve, reject) => {
        // Open cache
        caches.open('file-cache4').then((cache) => {
            // Add files to cache
            const promises = fileList.map(async (file) => {
                // file.name = slugify(file.name);
                // Add file to cache
                const response = await fetch(file.dataUri);
                console.log('response', response);
                await cache.put(window.PUBLIC_URL + '/' + file.name, response);
                // Return url
                return file.name;
            });
            Promise.all(promises).then((fileNames) => {
                // Resolve
                resolve(fileNames);
            }).catch((err) => {
                reject(err);
            });
        }).catch((err) => {
            reject(err);
        });
    });
}