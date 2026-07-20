import { BrowserWindow, screen, shell, app } from 'electron'
import { join } from 'node:path'

const BAR_WIDTH = 460
const BAR_HEIGHT = 116
const BAR_MARGIN_BOTTOM = 48

let mainWindow: BrowserWindow | null = null
let barWindow: BrowserWindow | null = null

function loadRenderer(win: BrowserWindow, page: 'index' | 'bar'): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(`${devUrl}/${page === 'index' ? '' : 'bar.html'}`)
  } else {
    void win.loadFile(join(import.meta.dirname, `../renderer/${page}.html`))
  }
}

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
    return mainWindow
  }
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 760,
    minHeight: 540,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  // Closing the main window keeps the app alive in the tray
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })
  loadRenderer(mainWindow, 'index')
  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

export function createBarWindow(): BrowserWindow {
  if (barWindow && !barWindow.isDestroyed()) return barWindow
  barWindow = new BrowserWindow({
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // Never steal focus from the app the user is dictating into
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  })
  barWindow.setAlwaysOnTop(true, 'screen-saver')
  barWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  positionBar(barWindow)
  loadRenderer(barWindow, 'bar')
  return barWindow
}

function positionBar(win: BrowserWindow): void {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width, height } = display.workArea
  win.setBounds({
    x: Math.round(x + (width - BAR_WIDTH) / 2),
    y: Math.round(y + height - BAR_HEIGHT - BAR_MARGIN_BOTTOM),
    width: BAR_WIDTH,
    height: BAR_HEIGHT
  })
}

export function getBarWindow(): BrowserWindow | null {
  return barWindow && !barWindow.isDestroyed() ? barWindow : null
}

export function showBar(): void {
  const win = createBarWindow()
  positionBar(win)
  win.showInactive()
}

export function hideBar(): void {
  getBarWindow()?.hide()
}

let isQuitting = false
export function markQuitting(): void {
  isQuitting = true
}
app.on('before-quit', markQuitting)
