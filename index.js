const { app, BrowserWindow } = require('electron')

function createWindow () {
  const win = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    }
  })

  win.loadFile('client.html');
  //win.setFullScreen(true);
  //win.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
