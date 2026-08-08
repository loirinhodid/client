const { downloadArtifact } = require('@electron/get');
const path = require('path');
const fs = require('fs');

const version = '31.7.7';
const opts = {
  version,
  artifactName: 'electron',
  platform: process.platform,
  arch: process.arch,
  checksums: undefined,
};

console.log('opts', opts);

downloadArtifact(opts)
  .then((zipPath) => {
    console.log('downloaded', zipPath);
    console.log('size', fs.statSync(zipPath).size);
    console.log('exists', fs.existsSync(zipPath));
  })
  .catch((err) => {
    console.error('download err', err);
    process.exit(1);
  });
