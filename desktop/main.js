const { app, BrowserWindow, session } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: "#0b1018",
    title: "Project N",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true },
  });
  win.loadFile(path.join(__dirname, "app", "index.html"));
}

app.whenReady().then(() => {
  // Allow pointer-lock / fullscreen the game requests (granted by default for a
  // local app).
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(true));
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
