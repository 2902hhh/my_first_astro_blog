import { spawn } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
if (!process.argv[2]) throw new Error('Pass the isolated preview repository path.');
const executable = path.join(root, 'out', 'LocalWriting-win32-x64', '本地写作.exe');
const child = spawn(executable, ['--smoke-test', `--smoke-repo=${path.resolve(process.argv[2])}`], { windowsHide: true, stdio: 'pipe' });
child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
