/** Renderer -> main (invoke) */
export const IPC = {
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsValidateHotkey: 'settings:validate-hotkey',

  dictationToggle: 'dictation:toggle',
  dictationCancel: 'dictation:cancel',
  /** Bar sends captured PCM (Float32, 16kHz mono) when recording stops */
  dictationAudio: 'dictation:audio',
  /** Bar sends partial PCM chunk during recording */
  dictationAudioChunk: 'dictation:audio-chunk',
  /** Bar reports mic failure (permission denied etc.) */
  dictationCaptureError: 'dictation:capture-error',

  /** Transcribe an imported audio file (no paste); returns the saved record */
  importAudio: 'import:audio',

  replacementsList: 'replacements:list',
  replacementsAdd: 'replacements:add',
  replacementsDelete: 'replacements:delete',

  notesList: 'notes:list',
  notesCreate: 'notes:create',
  notesUpdate: 'notes:update',
  notesDelete: 'notes:delete',
  notesAppend: 'notes:append',

  historyList: 'history:list',
  historyDelete: 'history:delete',
  historyClear: 'history:clear',
  statsGet: 'stats:get',

  modelsList: 'models:list',
  modelsDownload: 'models:download',

  cloudTest: 'cloud:test',
  sarvamTest: 'sarvam:test',
  cleanupTest: 'cleanup:test',

  appVersion: 'app:version',
  openMainWindow: 'app:open-main',
  copyText: 'app:copy-text'
} as const

/** Main -> renderer (send) */
export const EVT = {
  /** BarState payload, to bar window */
  barState: 'evt:bar-state',
  /** Bar should start/stop microphone capture */
  captureStart: 'evt:capture-start',
  captureStop: 'evt:capture-stop',
  /** ModelDownloadProgress payload, to main window */
  modelProgress: 'evt:model-progress',
  /** DictationResult payload, to main window (history refresh) */
  dictationDone: 'evt:dictation-done',
  /** Settings changed elsewhere; payload AppSettings */
  settingsChanged: 'evt:settings-changed'
} as const
