import { BrowserWindow, screen, shell, app } from 'electron'
import { join } from 'node:path'

/**
 * Mirrors --c-canvas / --c-ink in styles.css. Fixed, not derived from
 * nativeTheme: the app is locked to the light palette, so a dark-mode OS must
 * not repaint the caption bar dark above a warm paper window.
 */
const CAPTION = { color: '#f4f1ed', symbolColor: '#1b1a18', height: 40 }

/*
 * The bar is a small always-on-screen pill (Wispr Flow style), not a panel that
 * appears only while dictating. The window is a fixed transparent canvas sized
 * for the widest state; the visible pill sizes itself to its content inside.
 */
const BAR_WIDTH = 340
const BAR_HEIGHT = 52
const BAR_MARGIN_BOTTOM = 10

let mainWindow: BrowserWindow | null = null
let barWindow: BrowserWindow | null = null

function loadRenderer(win: BrowserWindow, page: 'index' | 'bar'): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  // The bar has no visible devtools (focusable:false), so its console — where
  // the capture diagnostics live — is otherwise unreadable. Dev only.
  if (devUrl) {
    win.webContents.on('console-message', (e) => console.log(`[${page}]`, e.message))
  }
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
    backgroundColor: CAPTION.color,
    titleBarStyle: 'hidden',
    titleBarOverlay: CAPTION,
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
    backgroundColor: '#00000000',
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
  // The pill is purely an indicator. Making the whole window click-through
  // means it can sit over other apps permanently without eating clicks.
  barWindow.setIgnoreMouseEvents(true)
  positionBar(barWindow)
  loadRenderer(barWindow, 'bar')
  // Always on screen: show as soon as it can paint, and never steal focus.
  barWindow.once('ready-to-show', () => barWindow?.showInactive())
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

/** Re-anchor the pill to the display the cursor is on, then make sure it shows. */
export function showBar(): void {
  const win = createBarWindow()
  positionBar(win)
  win.showInactive()
}

let isQuitting = false
export function markQuitting(): void {
  isQuitting = true
}
app.on('before-quit', markQuitting)
