# Windows 11 Simulator

Simulador interativo do Windows 11 executado integralmente no navegador.

## Abrir o simulador

**GitHub Pages:** https://plarika.github.io/Windows-11-Simulator/

## Versão atual

**V6 Modular** — a interface publicada foi dividida em módulos para permitir evolução segura sem regressões.

## Funcionalidades

- Desktop, Start Menu, Taskbar, pesquisa e múltiplos ambientes virtuais
- Window Manager com minimizar, maximizar, redimensionar, Snap Layouts e Alt+Tab
- Explorador de Ficheiros com filesystem virtual persistente
- Notepad, Calculator, Paint, Photos, Edge, Media Player e Microsoft Store simulados
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
