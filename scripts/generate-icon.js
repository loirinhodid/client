const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

const pngPath = path.join(__dirname, '..', 'assets', 'n.png');
const icoPath = path.join(__dirname, '..', 'assets', 'n.ico');

if (!fs.existsSync(pngPath)) {
  console.error('Arquivo de ícone não encontrado:', pngPath);
  process.exit(1);
}

pngToIco(pngPath)
  .then((buf) => fs.writeFileSync(icoPath, buf))
  .then(() => {
    console.log('Ícone gerado com sucesso em', icoPath);
  })
  .catch((err) => {
    console.error('Falha ao gerar ícone:', err);
    process.exit(1);
  });
