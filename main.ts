// ORBIT — Institutional Token Launch Intelligence Radar (token-radar-01).
//
// The program reads the sealed snapshot from /input/snapshot.json (or --input <file|dir>), scores every
// pre-token protocol with the fitted comparable model in lib/model.ts, writes the ranked board to
// /output/board.json, and copies this repository's dashboard/ and screenshots/ to /output. Last, it writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// The dashboard is a static page, no framework and no network: dashboard/index.html, dashboard/app.css
// and dashboard/app.js read /output/data.js, which this program writes from the same board. The model is
// a fitted log regression on deduplicated traded comparables; the page states it, shows why growth and
// age were tested and dropped, and gives every protocol a farm plan with its gas cost split from the
// capital at risk.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps (reference/gate.json): the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`ORBIT: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`ORBIT: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));

// Screenshots: the repository keeps each shot as base64 text (`1-board.png.b64`)
// because the GitHub snapshot push accepts UTF-8 files only and cannot carry a
// binary PNG. A real PNG sitting next to its .b64 wins; otherwise the .b64 is
// decoded here, byte for byte the PNG it was made from, and the decoded image
// is what lands in /output/screenshots. Either way the output holds real PNGs.
function pngSize(buf: Buffer): [number, number] | null {
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  return null;
}
function jpegSize(buf: Buffer): [number, number] | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return null;
  let at = 2;
  while (at + 9 < buf.length) {
    if (buf[at] !== 0xff) return null;
    const marker = buf[at + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
    const size = buf.readUInt16BE(at + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return [buf.readUInt16BE(at + 7), buf.readUInt16BE(at + 5)];
    }
    at += 2 + size;
  }
  return null;
}
function shotBytes(name: string): { bytes: Buffer; outName: string } | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png.b64') || lower.endsWith('.jpg.b64') || lower.endsWith('.jpeg.b64')) {
    const outName = name.slice(0, -4);
    const text = readFileSync(join(here, 'screenshots', name), 'utf8').trim();
    if (!/^[A-Za-z0-9+/=\r\n]+$/.test(text)) return null;
    return { bytes: Buffer.from(text, 'base64'), outName };
  }
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return { bytes: readFileSync(join(here, 'screenshots', name)), outName: name };
  }
  return null;
}
const shotDir = join(here, 'screenshots');
mkdirSync(join(out, 'screenshots'), { recursive: true });
const seen = new Map<string, string>();
const shots: string[] = [];
if (existsSync(shotDir)) {
  for (const name of readdirSync(shotDir).sort()) {
    if (name.startsWith('.')) continue;
    const path = join(shotDir, name);
    if (!statSync(path).isFile()) continue;
    const shot = shotBytes(name);
    if (shot === null) {
      process.stderr.write(`ORBIT: screenshots/${name}: not a PNG, a JPEG or base64 of one\n`);
      process.exit(1);
    }
    const base = shot.outName.replace(/\.(png|jpe?g)$/i, '');
    if (seen.has(base)) continue; // a real image and its .b64 are the same shot
    seen.set(base, shot.outName);
    const { bytes, outName } = shot;
    const dims = pngSize(bytes) ?? jpegSize(bytes);
    if (dims === null) {
      process.stderr.write(`ORBIT: screenshots/${name}: not a whole PNG or JPEG\n`);
      process.exit(1);
    }
    if (bytes.length > 524_288) {
      process.stderr.write(`ORBIT: screenshots/${name}: ${bytes.length} bytes, over the 512 KiB cap\n`);
      process.exit(1);
    }
    if (Math.max(dims[0], dims[1]) > 1440 || Math.min(dims[0], dims[1]) < 800) {
      process.stderr.write(`ORBIT: screenshots/${name}: ${dims[0]}x${dims[1]}, the long edge must be at most 1440 and the short edge at least 800\n`);
      process.exit(1);
    }
    if (!IMAGE_NAME.test(outName)) {
      process.stderr.write(`ORBIT: screenshots/${outName}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
      process.exit(1);
    }
    writeFileSync(join(out, 'screenshots', outName), bytes);
    shots.push(outName);
  }
}
if (shots.length < 3) {
  process.stderr.write(`ORBIT: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

process.stdout.write(
  `ORBIT: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside, ${radar.explorer_size} in the explorer)\n` +
    `ORBIT: model orbit-1 on ${radar.comparable_size} fitted comparables (unique gecko_id ${radar.validation.unique_gecko_id}, ${radar.validation.valid_comparables} valid), OOF log-MAE ${radar.validation.tvl_only_log_mae} vs baseline ${radar.validation.baseline_log_mae}\n` +
    `ORBIT: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (3 files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
