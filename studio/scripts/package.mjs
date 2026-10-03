import { packager } from '@electron/packager';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const electron = require('electron');
const outputs = await packager({ dir: root, out: path.join(root, 'out'), name: 'LocalWriting', executableName: '本地写作', platform: 'win32', arch: 'x64', electronVersion: require('electron/package.json').version, electronZipDir: process.env.STUDIO_ELECTRON_ZIP_DIR || undefined, overwrite: true, asar: true, prune: false, ignore: [/^\/node_modules/, /^\/src/, /^\/scripts/, /^\/tests/, /^\/out/, /^\/\.test-data/], appCopyright: '丁焕', win32metadata: { ProductName: '本地写作', FileDescription: '本地博客写作应用' } });
for (const output of outputs) console.log(path.join(output, '本地写作.exe'));
