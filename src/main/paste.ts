import { clipboard } from 'electron'
import { execFile } from 'node:child_process'

function exec(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 5000 }, (err) => (err ? reject(err) : resolve()))
  })
}

async function sendPasteKeystroke(): Promise<void> {
  switch (process.platform) {
    case 'win32':
      // SendKeys is built into .NET, so no extra install is needed on Windows
      await exec('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"
      ])
      break
    case 'darwin':
      await exec('osascript', [
        '-e',
        'tell application "System Events" to keystroke "v" using command down'
      ])
      break
    default:
      // X11 first, then wayland
      try {
        await exec('xdotool', ['key', '--clearmodifiers', 'ctrl+v'])
      } catch {
        await exec('wtype', ['-M', 'ctrl', 'v', '-m', 'ctrl'])
      }
  }
}

/**
 * Put text on the clipboard and simulate the paste keystroke in the focused app.
 * Falls back to clipboard-only (returns false) if the keystroke helper fails.
 */
export async function pasteText(
  text: string,
  opts: { autoPaste: boolean; restoreClipboard: boolean }
): Promise<boolean> {
  const previous = opts.restoreClipboard ? clipboard.readText() : null
  clipboard.writeText(text)
  if (!opts.autoPaste) return true
  try {
    await sendPasteKeystroke()
    if (previous !== null) {
      // Give the target app time to read the clipboard before restoring it
      setTimeout(() => clipboard.writeText(previous), 1200)
    }
    return true
  } catch (err) {
    console.error('[paste] keystroke failed, text left on clipboard:', err)
    return false
  }
}
