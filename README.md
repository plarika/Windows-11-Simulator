# Windows 11 Simulator

Simulador interativo do Windows 11 executado integralmente no navegador.

## Abrir o simulador

**GitHub Pages:** https://plarika.github.io/Windows-11-Simulator/

## Versão atual

**V6.6 Real Integrations** — Explorer com ficheiros reais, Fotos e Media Player reais, notificações do dispositivo e PWA instalável.

## Funcionalidades

- Desktop, Start Menu, Taskbar, pesquisa e múltiplos ambientes virtuais
- Window Manager com minimizar, maximizar, redimensionar, Snap Layouts e Alt+Tab
- Explorador de Ficheiros com filesystem virtual persistente
- Notepad, Calculator, Paint, Photos, Edge com Internet, Media Player e Microsoft Store simulados
- Settings, Windows Update, Windows Security, Device Manager e Task Manager
- Registry Editor, Event Viewer, Control Panel e ferramentas administrativas
- CMD e PowerShell virtuais
- Gestão de Discos, Serviços, Agendador de Tarefas, Monitor de Recursos e System Information
- Clipboard, Widgets, OneDrive, Remote Desktop e outras áreas do Windows

## Arquitetura V6

- `index.html` — shell da interface
- `styles/` — estilos separados por geração
- `src/core/` — runtime e arranque
- `src/features/` — funcionalidades de sistema
- `src/apps/` — aplicações e ferramentas administrativas
- `tools/migrate_v6.py` — migração reproduzível do build V5 para a estrutura modular

## Segurança

Este projeto é uma simulação web. CMD, PowerShell, Registry, Gestão de Discos, Windows Update,
Defender, Hyper-V, WSL, Serviços e Remote Desktop não executam operações reais no computador.

Não são recolhidas credenciais reais e o terminal não executa comandos do host.

## Nota legal

Projeto educacional e experimental. Não é afiliado, aprovado ou suportado pela Microsoft.
Windows e Windows 11 são marcas da Microsoft Corporation.


## V6.2 Realism Layer

A V6.2 melhora Taskbar, Start, janelas, ícones, system tray, lock screen, menus e animações sem alterar o modelo de segurança do simulador.

## V6.3 App Realism

- Edge com vários separadores e Internet
- Explorer com chrome, breadcrumbs e barra de estado mais realistas
- Task Manager moderno com processos, desempenho, arranque, utilizadores, detalhes e serviços
- Notepad com diálogos virtuais Abrir e Guardar como
- Settings com identidade do dispositivo e pesquisa integrada

## V6.3.1 Stability Review

- corrigido ciclo de MutationObserver nos breadcrumbs do Explorer
- corrigida atualização da contagem de seleção no Explorer
- corrigido duplo clique no diálogo Abrir
- Guardar como acrescenta automaticamente a extensão .txt quando necessário
- adicionado favicon para eliminar o 404 do browser
- validação funcional em Chromium: Explorer, Edge, Task Manager, Settings, Notepad e layout mobile

## V6.3.2 Encoding Fix

- corrigido mojibake em texto português e símbolos da interface
- normalizados ficheiros afetados para UTF-8 sem BOM
- corrigidos Versão, aplicações, módulos, Segurança e outros textos
- restaurados símbolos —, □, ×, ‹, ›, ☁ e °
- adicionada proteção automática contra regressões de codificação

## V6.4 Real Functions — Step 1

Primeiro passo de integração com funções reais do dispositivo:

- abrir ficheiros TXT, Markdown, LOG e CSV reais no Bloco de Notas
- editar conteúdo real dentro do simulador
- guardar novamente no ficheiro através da File System Access API quando disponível
- fallback de upload/download em browsers sem essa API
- acesso sempre depende de uma ação e autorização explícita do utilizador
- filesystem virtual continua separado dos ficheiros reais

## V6.5 Real Functions — Step 2

- copiar texto do simulador para a área de transferência real do Android/Windows
- colar texto do dispositivo para o simulador
- integração no Bloco de Notas
- integração no painel Win+V
- Clipboard API em contexto HTTPS quando disponível
- fallback de cópia e de colagem manual quando o navegador restringe leitura direta
- sem leitura da área de transferência em segundo plano

## V6.6 Real Integrations

- Explorer: importar ficheiros reais para o filesystem virtual
- Explorer: importar pastas autorizadas preservando subpastas
- Explorer: arrastar e largar ficheiros reais
- Explorer: exportar ficheiros virtuais/importados para o dispositivo
- blobs reais guardados em IndexedDB em vez de localStorage
- Fotos: abrir imagens reais do dispositivo
- Media Player: reproduzir áudio e vídeo reais
- notificações reais opcionais através da Notification API
- PWA instalável no Windows/Android
- service worker para cache offline da interface local do simulador
- todas as permissões reais continuam dependentes de ação explícita do utilizador
