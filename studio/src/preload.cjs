const { contextBridge, ipcRenderer } = require('electron');
const methods = ['startup', 'choose-repo', 'info', 'drafts', 'posts', 'create', 'get', 'save', 'remove', 'publish', 'retryPush', 'importImage', 'export', 'close-ready', 'smoke-ready', 'smoke-error'];
contextBridge.exposeInMainWorld('studio', {
  call: (method, ...args) => {
    if (!methods.includes(method)) return Promise.reject(new Error('无效的操作。'));
    return ipcRenderer.invoke(method, ...args);
  },
  onProgress: callback => ipcRenderer.on('progress', (_event, message) => callback(message)),
  onClose: callback => ipcRenderer.on('prepare-close', () => callback()),
});
