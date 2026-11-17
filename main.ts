// Lantern Keeper — the make.fun best-game-01 entry program (Node 22+, standard
// library only). The game itself is this directory's game/ folder: plain static
// files a desktop browser loads fully offline. This program hands the entry in:
// it copies game/ (and screenshots/, when present) from beside this file into
// the output directory and writes dossier.json there with the vendored
// make.fun library — the summary the judge reads.
//
// The output directory is /output in the grader's container; anywhere else,
// MAKEFUN_OUTPUT_DIR stands in for it:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The run is deterministic: the same repository always yields the same
// dossier.json, byte for byte.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });

// Screenshots are produced after the game (see shots.json); the output always
// gets a screenshots/ folder, and the repository's own is copied when it exists.
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
const repoScreenshots = join(repoRoot, 'screenshots');
if (existsSync(repoScreenshots)) {
  cpSync(repoScreenshots, join(outputDir, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own limits: past them, the scorer would refuse the
// entry, so the dossier builder refuses first (over 4 screenshots or one over
// 256 KiB; over 993 game files, 48 MiB of game files, or a game path over
// 1000 bytes; the source text shown to the judge capped at 160 KiB).
const dossierText = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossierText);
