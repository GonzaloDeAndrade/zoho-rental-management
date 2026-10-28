// Usage: node ide-script.mjs <workflow code from IDE> <script file> <out file>
// Replaces the body of the workflow's "custom deluge script ( ... )" block with the script.
import fs from 'node:fs';

const [wfFile, dgFile, outFile] = process.argv.slice(2);
const wf = fs.readFileSync(wfFile, 'utf8').replace(/\r\n/g, '\n');
const dg = fs.readFileSync(dgFile, 'utf8').replace(/\r\n/g, '\n').trimEnd();
const body = dg.split('\n').map((l) => (l ? '\t\t\t\t' + l : l)).join('\n');
const re = /(custom deluge script\n\t\t\t\()\n[\s\S]*?\n(\t\t\t\))/;
if (!re.test(wf)) throw new Error('script block not found');
fs.writeFileSync(outFile, wf.replace(re, (_, open, close) => `${open}\n${body}\n${close}`));
console.log('wrote', outFile);
