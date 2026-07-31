import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { WhisprApi } from '@shared/api'
import type {
  AppSettings,
  BarState,
  DictationResult,
  HistoryQuery,
  ModelDownloadProgress
} from '@shared/types'
import { EVT, IPC } from '@shared/ipc-channels'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: WhisprApi = {
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  setSettings: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch),
  validateHotkey: (accelerator) => ipcRenderer.invoke(IPC.settingsValidateHotkey, accelerator),

  toggleDictation: () => ipcRenderer.invoke(IPC.dictationToggle),
  cancelDictation: () => ipcRenderer.invoke(IPC.dictationCancel),
  sendAudio: (pcm, durationMs) => ipcRenderer.invoke(IPC.dictationAudio, pcm, durationMs),
  reportCaptureError: (message) => ipcRenderer.invoke(IPC.dictationCaptureError, message),

  importAudio: (pcm, durationMs) => ipcRenderer.invoke(IPC.importAudio, pcm, durationMs),

  listReplacements: () => ipcRenderer.invoke(IPC.replacementsList),
  addReplacement: (input) => ipcRenderer.invoke(IPC.replacementsAdd, input),
  deleteReplacement: (id) => ipcRenderer.invoke(IPC.replacementsDelete, id),

  listNotes: (search) => ipcRenderer.invoke(IPC.notesList, search),
  createNote: (title) => ipcRenderer.invoke(IPC.notesCreate, title),
  updateNote: (id, patch) => ipcRenderer.invoke(IPC.notesUpdate, id, patch),
  deleteNote: (id) => ipcRenderer.invoke(IPC.notesDelete, id),
  appendToNote: (id, text) => ipcRenderer.invoke(IPC.notesAppend, id, text),

  listHistory: (query: HistoryQuery) => ipcRenderer.invoke(IPC.historyList, query),
  deleteHistory: (id) => ipcRenderer.invoke(IPC.historyDelete, id),
  clearHistory: () => ipcRenderer.invoke(IPC.historyClear),
  getStats: () => ipcRenderer.invoke(IPC.statsGet),

  listModels: () => ipcRenderer.invoke(IPC.modelsList),
  downloadModel: (modelId) => ipcRenderer.invoke(IPC.modelsDownload, modelId),

  testCloud: () => ipcRenderer.invoke(IPC.cloudTest),
  testSarvam: () => ipcRenderer.invoke(IPC.sarvamTest),
  testCleanup: () => ipcRenderer.invoke(IPC.cleanupTest),

  appVersion: () => ipcRenderer.invoke(IPC.appVersion),
  openMainWindow: () => ipcRenderer.invoke(IPC.openMainWindow),
  copyText: (text) => ipcRenderer.invoke(IPC.copyText, text),

  onBarState: (cb) => subscribe<BarState>(EVT.barState, cb),
  onCaptureStart: (cb) => subscribe<void>(EVT.captureStart, cb),
  onCaptureStop: (cb) => subscribe<{ discard: boolean }>(EVT.captureStop, cb),
  onModelProgress: (cb) => subscribe<ModelDownloadProgress>(EVT.modelProgress, cb),
  onDictationDone: (cb) => subscribe<DictationResult>(EVT.dictationDone, cb),
  onSettingsChanged: (cb) => subscribe<AppSettings>(EVT.settingsChanged, cb)
}

contextBridge.exposeInMainWorld('api', api)
