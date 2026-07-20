import { app, session } from 'electron'
import { settings } from './settings'
import { createBarWindow, createMainWindow } from './windows'
import { createTray } from './tray'
import { HotkeyManager } from './hotkeys'
import { DictationController } from './dictation'
import { registerIpc } from './ipc'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => createMainWindow())

  const dictation = new DictationController({
    onRecordingStart: () => hotkeys.holdEscape(),
    onRecordingEnd: () => hotkeys.releaseEscape()
  })
  const hotkeys = new HotkeyManager(
    () => dictation.toggle(),
    () => dictation.cancel(),
    () => dictation.toggle('translate')
  )

  void app.whenReady().then(() => {
    app.setAppUserModelId('com.sajal.whisprflow')

    // The bar window records audio; grant it mic access without a prompt
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(permission === 'media')
    })

    registerIpc(dictation, hotkeys)
    createBarWindow()
    createMainWindow()
    createTray(() => dictation.toggle())

    const cfg = settings.get()
    const result = hotkeys.apply(cfg.hotkey)
    if (!result.ok) console.error('[hotkey] failed to register:', result.reason)
    const translateResult = hotkeys.applyTranslate(cfg.translateHotkey)
    if (!translateResult.ok) {
      console.error('[hotkey] translate shortcut failed:', translateResult.reason)
    }
  })

  // Tray app: closing all windows must not quit
  app.on('window-all-closed', () => undefined)

  app.on('will-quit', () => hotkeys.dispose())
}
