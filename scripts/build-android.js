/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');
const androidAssetsDir = path.resolve(rootDir, 'android/app/src/main/assets/www');

console.log('📦 Step 1: Building Web Application...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

console.log('📁 Step 2: Preparing Android Assets Directory...');
if (!fs.existsSync(androidAssetsDir)) {
  fs.mkdirSync(androidAssetsDir, { recursive: true });
} else {
  fs.rmSync(androidAssetsDir, { recursive: true, force: true });
  fs.mkdirSync(androidAssetsDir, { recursive: true });
}

console.log(`📋 Step 3: Copying dist files to ${androidAssetsDir}...`);
function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);
  for (const file of files) {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);
    if (fs.lstatSync(curSource).isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  }
}

copyFolderRecursiveSync(distDir, androidAssetsDir);
console.log('✅ Android Assets successfully synced! Ready for Gradle build.');
