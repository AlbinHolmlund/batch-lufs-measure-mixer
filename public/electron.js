const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

function startFileServer() {
    const express = require('express');
    const app = express();
    // Get an open port
    const port = require('get-port-sync')();
    // Serve the build folder
    const appPath = process.env.NODE_ENV === 'production' ? `${process.resourcesPath}/build` : __dirname;
    app.use(express.static(appPath));
    // Start the server
    app.listen(port, () => {
        console.log(`Server started on port ${port}`);
    });
    return port;
}

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
        },
    });

    if (!isDev) {
        // Start the file server
        const port = startFileServer();
        // Load the index.html file
        win.loadURL(`http://localhost:${port}`);
        return;
    } else {
        win.loadURL('http://localhost:3000');
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