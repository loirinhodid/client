const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const projectRoot = path.join(__dirname, '..');
const packageInfo = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const manifestPath = path.join(projectRoot, 'dist', 'latest.yml');
const manifest = yaml.load(fs.readFileSync(manifestPath, 'utf8'));

manifest.buildRevision = Number(packageInfo.buildRevision || 0);
fs.writeFileSync(manifestPath, yaml.dump(manifest, { lineWidth: -1 }));