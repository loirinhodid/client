const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function readPackage() {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const text = fs.readFileSync(pkgPath, 'utf-8');
  return { pkgPath, data: JSON.parse(text), text };
}

function writePackage(pkgPath, data) {
  fs.writeFileSync(pkgPath, JSON.stringify(data, null, 2) + '\n');
}

function bumpVersion(version) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) throw new Error('Invalid semver: ' + version);
  parts[2] = parts[2] + 1;
  return parts.join('.');
}

async function main() {
  const { pkgPath, data } = readPackage();
  const oldVersion = data.version || '0.0.0';
  const newVersion = bumpVersion(oldVersion);
  data.version = newVersion;
  writePackage(pkgPath, data);
  console.log(`Bumped version ${oldVersion} -> ${newVersion}`);

  // mudar cwd para a pasta onde está o package.json para que git encontre o arquivo
  const pkgDir = path.dirname(pkgPath);
  try {
    process.chdir(pkgDir);
  } catch (err) {
    console.warn('Não foi possível mudar para o diretório do package.json:', pkgDir, err.message);
  }

  try {
    // ensure git has a user identity for commits (local repo config)
    try {
      execSync('git config user.email "ci@sycorax.local"');
      execSync('git config user.name "Sycorax CI"');
    } catch (cfgErr) {
      // ignore config errors
    }

    execSync('git add package.json', { stdio: 'inherit' });
    execSync(`git commit -m "chore(release): v${newVersion}"`, { stdio: 'inherit' });
  } catch (err) {
    console.warn('Git commit failed (maybe no changes or not a git repo or no initial commit):', err.message);
  }

  try {
    execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`, { stdio: 'inherit' });
  } catch (err) {
    console.warn('Git tag failed:', err.message);
  }

  try {
    execSync('git push origin HEAD', { stdio: 'inherit' });
    execSync(`git push origin v${newVersion}`, { stdio: 'inherit' });
  } catch (err) {
    console.warn('Push failed (remote may require auth):', err.message);
    console.log('Local commit and tag created; push manually when ready.');
  }

  console.log('Release prep finished. If you want CI to publish the artifacts, push the tag to GitHub.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
