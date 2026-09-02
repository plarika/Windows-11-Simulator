# Windows 11 Simulator

Simulador interativo do Windows 11 executado integralmente no navegador.

O projeto recria o shell, aplicações, gestão de janelas, ficheiros virtuais, contas, recuperação, pesquisa e várias integrações do Windows 11 sem executar código no sistema anfitrião.

## Links

- **Abrir o simulador:** https://plarika.github.io/Windows-11-Simulator/
- **Histórico de versões:** [docs/CHANGELOG.md](docs/CHANGELOG.md)
- **Política e notas de segurança:** [SECURITY.md](SECURITY.md)

## Versão atual

**V10.3 — Window Manager**

A V10.3 introduz um contrato V10 nativo para gestão de janelas, Snap Layouts, ambientes virtuais, placements, lifecycle e diagnóstico de integridade.

## Destaques

- Desktop, Start Menu e Taskbar com estado por perfil
- Window Manager com minimizar, maximizar, restaurar, Snap Layouts e Snap Groups
- múltiplos ambientes virtuais
- Explorer com filesystem virtual persistente
- aplicações Windows simuladas e ferramentas administrativas
- contas locais, bloqueio, troca de utilizador e recuperação de sessão
- Edge com navegação Web, pesquisa Google e pesquisa YouTube opcional
- PWA, service worker e funcionamento instalável
- diagnostics, testes automáticos e auditoria real no Edge

## Arquitetura V10

A arquitetura V10 adiciona contratos centrais sobre os módulos históricos V8/V9 sem reescrever tudo de uma vez.

| Camada | Estado | Responsabilidade |
|---|---|---|
| V10.0 Platform | ✅ | registry, lifecycle, health e diagnostics |
| V10.1 Boot / Recovery | ✅ | boot por fases, timeouts e recuperação |
| V10.2 Desktop / Taskbar | ✅ | shell, Start pins e self-healing da Taskbar |
| V10.3 Window Manager | ✅ | lifecycle de janelas, Snap, desktops e placements |
| V10.4 Explorer | Planeado | contrato V10 para navegação e filesystem |
| V10.5 Apps | Planeado | lifecycle e integração das aplicações |
| V10.6 Processes / Services | Planeado | processos, serviços e runtime |
| V10.7 Security | Planeado | segurança e políticas centrais |
| V10.8 Network / Devices | Planeado | rede, dispositivos e permissões |
| V10.9 Intelligence | Planeado | automação e inteligência do sistema |
| V11.0 | Objetivo | sistema virtual integrado |

### Núcleos V10 atuais

- `src/core/platform-v100.js`
- `src/core/boot-recovery-v101.js`
- `src/core/desktop-taskbar-v102.js`
- `src/core/window-manager-v103.js`
- `src/core/boot.js`

## Funcionalidades principais

### Desktop e Taskbar

- ícones do ambiente de trabalho com posições persistentes
- ficheiros e pastas virtuais no Desktop
- pins do Start por perfil
- pesquisa local integrada
- agrupamento de janelas por aplicação
- previews e progresso na Taskbar
- auto-hide e Show Desktop
- reconciliação automática de botões órfãos/duplicados

### Window Manager

- foco, minimizar, maximizar, restaurar e fechar
- Snap Layouts
- Snap Assist
- Snap Groups
- edge-drag snap
- previews no Alt+Tab e Taskbar
- múltiplos ambientes virtuais
- mover janelas entre ambientes
- persistência de posição e tamanho
- diagnóstico e self-reconcile V10.3

### Explorer

- filesystem virtual persistente
- navegação, tabs e múltiplas janelas
- copiar, mover, eliminar e reciclar
- histórico e undo/redo
- vistas, colunas, ordenação e agrupamento
- ficheiros ocultos, extensões e propriedades
- versões anteriores e Recycle Bin Pro

### Aplicações e sistema

Inclui, entre outras:

- Notepad
- Calculator
- Paint
- Photos
- Media Player
- Microsoft Edge
- Settings
- Task Manager
- Windows Security
- Device Manager
- Event Viewer
- Registry Editor
- Control Panel
- PowerShell e Terminal
- Services
- Disk Management
- Task Scheduler
- Resource Monitor
- System Information

## Sessões e recuperação

- contas locais
- estado separado por perfil
- bloqueio e troca de utilizador
- Session Restore
- deteção de sessão interrompida
- recuperação automática ou manual
- Safe Mode apenas dentro do simulador
- boot por fases com timeout
- deteção de boot-loop
- diagnostics V10 integrados

## Edge e pesquisa oficial

O Edge simulado suporta navegação Web com fallback de compatibilidade para sites que bloqueiam iframes.

### Google

A pesquisa oficial pode usar Google Programmable Search.

1. Crie um Programmable Search Engine.
2. Copie o Search Engine ID (`cx`).
3. No simulador abra **Edge > Definições > Pesquisa oficial**.
4. Cole o `cx`.

### YouTube

A pesquisa de vídeos pode usar a **YouTube Data API v3**.

1. Ative a YouTube Data API v3 num projeto Google Cloud.
2. Crie uma API key.
3. Restrinja a chave à **YouTube Data API v3**.
4. Se aplicável, restrinja também por HTTP referrer.
5. No simulador abra **Edge > Definições > Pesquisa oficial** e introduza a chave.

A chave introduzida pelo utilizador:

- fica apenas em `sessionStorage`
- não é guardada no estado do perfil
- não entra em backups ou diagnostics
- não é incluída no repositório

Cada utilizador deve usar a sua própria chave enquanto não existir um backend/proxy dedicado.

## Segurança e privacidade

O projeto é uma simulação Web e não deve ser confundido com virtualização real do Windows.

Princípios atuais:

- sem execução arbitrária de código no host
- sem acesso automático ao filesystem real
- permissões reais do browser exigem ação explícita
- mounts reais permanecem separados do filesystem virtual
- diagnostics evitam conteúdos sensíveis
- histories e eventos internos são limitados
- chaves API não são persistidas no estado normal
- Safe Mode afeta apenas o simulador

Para detalhes, consulte [SECURITY.md](SECURITY.md).

## Estrutura do projeto

```text
index.html
styles/
src/
  core/
  features/
  apps/
  workers/
tests/
tools/
docs/
service-worker.js
manifest.webmanifest
```

Os módulos históricos V8/V9 continuam ativos enquanto são migrados progressivamente para contratos V10.

## Testes

Requer Node.js 20 ou superior.

```bash
npm test
```

A suite inclui:

- smoke tests
- Platform V10.0 unit tests
- Boot / Recovery V10.1 unit tests
- Desktop / Taskbar V10.2 unit tests
- Window Manager V10.3 unit tests

Existe ainda uma auditoria browser completa em Edge através de:

```bash
node tools/browser_audit.mjs <porta-cdp>
```

A publicação só deve avançar com:

- testes automáticos sem falhas
- `git diff --check` limpo
- zero exceções relevantes no browser
- zero erros de consola relevantes
- nenhum segredo ou API key incluído no repositório

## Desenvolvimento local

O projeto não necessita de build para utilização básica.

Pode ser servido por qualquer servidor HTTP local. Exemplo:

```bash
python -m http.server 8772
```

Depois abra:

```text
http://127.0.0.1:8772/
```

Algumas APIs do browser podem exigir contexto seguro, permissões específicas ou comportamento diferente em localhost/GitHub Pages.

## Roadmap V10 → V11

- [x] V10.0 — Foundation
- [x] V10.1 — Boot / Recovery
- [x] V10.2 — Desktop / Taskbar
- [x] V10.3 — Window Manager
- [ ] V10.4 — Explorer
- [ ] V10.5 — Apps
- [ ] V10.6 — Processes / Services
- [ ] V10.7 — Security
- [ ] V10.8 — Network / Devices
- [ ] V10.9 — Intelligence
- [ ] V11.0 — Sistema virtual integrado

## Histórico

O histórico detalhado das versões V6.x → V9.9.7 foi movido para:

[docs/CHANGELOG.md](docs/CHANGELOG.md)

Isto mantém o README focado no estado atual do projeto sem perder o registo técnico das versões anteriores.

## Nota legal

Este projeto é um simulador independente para fins educativos, experimentais e demonstrativos.

Windows, Microsoft Edge e outros nomes de produtos referidos pertencem aos respetivos titulares. O projeto não é afiliado nem aprovado pela Microsoft, Google ou YouTube.
