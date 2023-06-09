const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const isDev = require('electron-is-dev');
const express = require('express');
const getPort = require('get-port'); // Last version before switching to ESM is 5.1.1
const { autoUpdater } = require('electron-updater');


const { ipcMain } = require('electron');

ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall();
});

global.__dirname = app.getAppPath();
console.log('window.__dirname', global.__dirname);

// Set audioPath to path from homepage key in package.json
const homepage = require('../package.json').homepage;

// Homepage is for example https://skrap.info/audio_unstable but we want /audio_unstable

// Remove the https://skrap.info
const audioPath = homepage.replace('https://skrap.info', '');


async function checkForUpdates() {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-available', () => {
        mainWindow.webContents.send('update-available');
    });

    autoUpdater.on('update-downloaded', () => {
        mainWindow.webContents.send('update-downloaded');
    });

    autoUpdater.on('error', (error) => {
        mainWindow.webContents.send('update-error', error);
    });
}

// Cache the result into a file, so that the port is the same on every run
const cacheResult = async (key, fn, force = false) => {
    const cacheFile = path.join(__dirname, 'cache.json');

    // Read cache file
    let cache = {};
    try {
        cache = await fs.readJson(cacheFile);
    } catch (err) { }

    // Check if the key exists
    if (cache[key] && !force) {
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
        const filePath = path.join(__dirname, req.path.replace(audioPath, '../build/'));
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
    /*
        Keep windowSize and position in cache
        https://stackoverflow.com/questions/5392344/saving-and-restoring-window-size-and-position-using-electron
    */
    const cacheKey = 'windowSize';
    const cache = await cacheResult(cacheKey, async () => {
        return {
            width: 800,
            height: 600,
            x: 0,
            y: 0,
        };
    });

    // Create the browser window.
    const win = new BrowserWindow({
        width: cache.width,
        height: cache.height,
        x: cache.x,
        y: cache.y,
        // Set background color to white
        backgroundColor: '#0e1928',
        webPreferences: {
            nodeIntegration: true,
        },
    });

    // Save windowSize and position in cache
    win.on('close', async () => {
        const cache = await cacheResult(cacheKey, async () => {
            return {
                width: win.getSize()[0],
                height: win.getSize()[1],
                x: win.getPosition()[0],
                y: win.getPosition()[1],
            };
        }, true);
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

    // Set the icon for the windows and mac
    // Location of icons is public/icons and their called favicon
    if (process.platform === 'win32') {
        win.setIcon(path.join(__dirname, 'icons/favicon.ico'));
    } else if (process.platform === 'darwin') {
        // win.setIcon(path.join(__dirname, 'icons/favicon.icns'));
    }

    if (!isDev) {
        // Start the file server
        const port = await startFileServer();
        // Load the index.html file
        win.loadURL(`http://localhost:${port}${audioPath}/index.html`);
    } else {
        win.loadURL('http://localhost:3000' + audioPath);
    }

    // Add shortcut to reload the page
    win.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'r' && input.meta) {
            win.reload();
        }
    });

    // Add shortcut to exit the app
    win.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'q' && input.meta) {
            app.quit();
        }
    });
}

app.whenReady().then(async () => {
    await createWindow();
    checkForUpdates();
});

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