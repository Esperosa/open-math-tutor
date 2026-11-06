import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridgeApi } from './bridgeApi';

const api: DesktopBridgeApi = Object.freeze({
  getBridgeUrl: (): Promise<string> => ipcRenderer.invoke('omt:bridge-url'),
});
contextBridge.exposeInMainWorld('openMathTutor', api);
