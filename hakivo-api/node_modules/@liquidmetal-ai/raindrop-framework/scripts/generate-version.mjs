// This script generates a version.ts file from package.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const versionFilePath = path.join(__dirname, '..', 'src', 'version.ts');
const content = `// This file is auto-generated during build. Do not edit.
export const VERSION = '${packageJson.version}';
`;

fs.writeFileSync(versionFilePath, content);
console.log(`Generated version.ts with version ${packageJson.version}`);
