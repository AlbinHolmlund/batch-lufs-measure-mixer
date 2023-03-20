const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const isDev = require('electron-is-dev');
const express = require('express');
const getPort = require('get-port'); // Last version before switching to ESM is 5.1.1

global.__dirname = app.getAppPath();
console.log('window.__dirname', global.__dirname);

// Cache the result into a file, so that the port is the same on every run
const cacheResult = async (key, fn) => {
    const cacheFile = path.join(__dirname, 'cache.json');

    // Read cache file
    let cache = {};
    try {
        cache = await fs.readJson(cacheFile);
    } catch (err) { }

    // Check if the key exists
    if (cache[key]) {
        return cache[key];
    }

    // Run the function
    const result = await fn();

    // Save the result
    cache[key] = result;
    await fs.writeJson(cacheFile, cache);

    return result;
};

const clearCache = async () => {
    const cacheFile = path.join(__dirname, 'cache.json');

    // Remove the cache file if it exists
    try {
        if ((fs.existsSync(cacheFile))) {
            await fs.remove(cacheFile);
        }
    } catch (err) {
        console.error(err);
    }
};

async function startFileServer() {
    // Get get port
    const app = express();

    // Get an open port (3000 if available)
    const port = await getPort({ port: 3960 });
    console.log('port', port);

    // Serve the build folder as /audio/ (for production)
    app.get('*', (req, res) => {
        console.log('req.path', req.path);
        const filePath = path.join(__dirname, req.path.replace('audio', '../build/'));
        console.log('filePath', filePath);

        // Check if the file exists
        if (fs.existsSync(filePath)) {
            // Return the file
            res.status(200).sendFile(filePath);
        } else {
            // Return a 404
            res.status(404).send('File not found');
        }
    });


    // Start the server
    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
            console.log('Server listening at port %s', port);
            resolve(port);
        });
    });
}

async function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
        },
    });

    // Add menu item to clearCache
    const menu = Menu.buildFromTemplate([
        // File -> Clear Cache
        // File -> Reload
        // File -> Toggle DevTools
        // File -> Quit
        {
            label: 'File',
            submenu: [
                {
                    label: 'Clear Cache',
                    click: async () => {
                        await clearCache();
                        win.reload();
                    },
                },
                {
                    label: 'Reload',
                    click: () => {
                        win.reload();
                    },
                },
                {
                    label: 'Toggle DevTools',
                    click: () => {
                        win.webContents.toggleDevTools();
                    },
                },
                {
                    label: 'Quit',
                    click: () => {
                        app.quit();
                    },
                },
            ],
        },
    ]);
    Menu.setApplicationMenu(menu);

    if (!isDev) {
        // Start the file server
        const port = await startFileServer();
        // Load the index.html file
        win.loadURL(`http://localhost:${port}/audio/index.html`);
    } else {
        win.loadURL('http://localhost:3000/audio');
    }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});