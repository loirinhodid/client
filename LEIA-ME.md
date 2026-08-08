# Rover Client

Rover Client é um cliente Electron que carrega um app remoto (`important-nexus-launch-pad.base44.app`)
e dá acesso ao sistema local para abrir o jogo/pasta no seu PC.

## Como rodar

1. Precisa ter o Node.js instalado (baixe em nodejs.org, versão LTS).
2. Abra um terminal dentro desta pasta e rode:
   ```
   npm install
   npm start
   ```
3. Uma janela vai abrir carregando o app remoto normalmente.

## Como ligar o botão do seu app a isso

Dentro do código do seu app (no editor do site remoto), no botão que hoje
tenta abrir o jogo, troque a lógica por algo assim:

```js
async function abrirJogo() {
  if (window.electronAPI) {
    const resultado = await window.electronAPI.abrirJogo();
    if (!resultado.sucesso) {
      alert(resultado.mensagem || 'Não foi possível abrir o jogo.');
    }
  } else {
    alert('Esse recurso só funciona rodando pelo app desktop, não no navegador comum.');
  }
}
```

Coisas que já vêm prontas:

- `window.electronAPI.abrirJogo()` — na primeira vez, abre uma caixa de diálogo
  pra você escolher o `.exe` do jogo. Da segunda vez em diante, já abre direto,
  porque o caminho fica salvo localmente (em `%APPDATA%/Rover Client/config.json`
  no Windows).
- `window.electronAPI.abrirPastaJogo()` — abre a pasta onde está o jogo configurado.
- `window.electronAPI.reconfigurarJogo()` — esquece o caminho salvo, caso você
  queira trocar de jogo depois.

## Por que é seguro

A janela carrega a página do Base44 (que não é seu código, é hospedado por eles),
então o `preload.js` só expõe essas 3 funções específicas via `contextBridge` —
`nodeIntegration` fica desligado e `contextIsolation` ligado. Isso significa que
mesmo que algo estranho rode dentro da página, não tem acesso livre ao sistema
de arquivos nem consegue rodar comandos arbitrários — só o que foi liberado
aqui no `main.js`.

## Gerar um .exe pra não precisar rodar pelo terminal (opcional, depois)

Este projeto agora tem suporte para empacotar um instalador Windows e para
atualizações automáticas via GitHub Releases.

Passos básicos:

1. Instale dependências:
   ```bash
   npm install
   ```
2. Gere o ícone `.ico` a partir do `assets/logo.svg`:
   ```bash
   npm run build-icon
   ```
3. Crie o instalador:
   ```bash
   npm run dist
   ```
4. Para publicar no GitHub e permitir atualizações automáticas:
   - Altere `owner` e `repo` em `package.json` para seu repositório GitHub.
   - Rode:
     ```bash
     npm run publish
     ```

O instalador será gerado em `dist/` e, depois de publicado no GitHub, o app
vai buscar atualizações automaticamente sempre que iniciar.

## Publicação e controle de versões (importante para atualizações automáticas)

Para que usuários já instalados recebam atualizações imediatamente é necessário
seguir este fluxo ao publicar uma nova versão:

1. Atualize o campo `version` em `package.json` (por exemplo: `"version": "1.0.1"`).
2. Gere o instalador e artefatos:

```bash
npm run build-icon
npm run dist
```

3. Crie uma *release* no GitHub contendo o instalador (`.exe`) gerado em `dist/`
   — o `electron-updater` usado pelo app consulta as releases para aplicar
   atualizações.

Notas importantes:
- Este projeto agora usa `Sycorax` como `author`/`publisherName` e `appId` foi
  ajustado para `com.sycorax.roverclient` para evitar conflitos com executáveis
  antigos.
- O arquivo de instalador gerado usa um nome consistente (`RoverClient-Setup-<version>.exe`)
  para evitar duplicidade de executáveis nas releases.
- O app faz uma verificação imediata no startup e também varre periodicamente
  com um agendador que usa backoff exponencial (inicia em 5 minutos e pode
  aumentar até 4 horas em caso de falhas) — isso mantém o equilíbrio entre
  latência (receber atualizações rapidamente) e carga no servidor.

Precisa atualizar manualmente o sistema de versão?
- Sim: para que o `electron-updater` detecte uma nova versão você precisa
  publicar uma nova release com um valor de `version` maior do que a atual
  presente no `package.json` da release anterior. Ou seja, sempre que for
  lançar uma atualização, incremente `version` e publique a release contendo
  o instalador gerado. O app não irá atualizar se a versão publicada não for
  maior do que a instalada.

Se quiser, eu posso automatizar a criação da release (script) ou ajustar o
workflow de CI para incrementar a versão e publicar automaticamente.

## Controle da Janela (para o site remoto)

Se a equipe do site quiser controlar a janela do launcher (minimizar, maximizar, fechar)
há uma API segura exposta pela `preload.js` que o site pode usar quando estiver
rodando dentro do app Electron.

Exemplos (usar apenas quando `window.janelaAPI` existir):

Minimizar a janela:

```js
if (window.janelaAPI) {
  window.janelaAPI.minimizar();
}
```

Alternar maximizar/restaurar:

```js
if (window.janelaAPI) {
  window.janelaAPI.maximizar(); // se estiver maximizada, restaura; caso contrário maximiza
}
```

Fechar a janela:

```js
if (window.janelaAPI) {
  window.janelaAPI.fechar();
}
```

Notificação de estado de maximização (útil para trocar o ícone/título do botão):

```js
if (window.janelaAPI && window.janelaAPI.aoMaximizarMudar) {
  window.janelaAPI.aoMaximizarMudar((estaMaximizada) => {
    // atualizar UI do site conforme necessário
    console.log('janela maximizada?', estaMaximizada);
  });
}
```

Observações de segurança e integração:

- As funções acima só existem quando a página está sendo renderizada dentro
  do `Rover Client` (não estarão presentes em navegadores normais).
- Use checagens (`if (window.janelaAPI)`) para evitar erros no ambiente web.
- A API expõe apenas os controles listados — o site não ganha acesso ao Node
  ou ao sistema de arquivos.

Copie e envie essas instruções para a IA que gerencia o site para que ela adicione
os handlers nos botões apropriados do frontend.
