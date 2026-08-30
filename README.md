# Windows 11 Simulator

Simulador interativo do Windows 11 executado integralmente no navegador.

## Abrir o simulador

**GitHub Pages:** https://plarika.github.io/Windows-11-Simulator/

## VersÃ£o atual

**V6 Modular** â€” a interface publicada foi dividida em mÃ³dulos para permitir evoluÃ§Ã£o segura sem regressÃµes.

## Funcionalidades

- Desktop, Start Menu, Taskbar, pesquisa e mÃºltiplos ambientes virtuais
- Window Manager com minimizar, maximizar, redimensionar, Snap Layouts e Alt+Tab
- Explorador de Ficheiros com filesystem virtual persistente
- Notepad, Calculator, Paint, Photos, Edge com Internet, Media Player e Microsoft Store simulados
- Settings, Windows Update, Windows Security, Device Manager e Task Manager
- Registry Editor, Event Viewer, Control Panel e ferramentas administrativas
- CMD e PowerShell virtuais
- GestÃ£o de Discos, ServiÃ§os, Agendador de Tarefas, Monitor de Recursos e System Information
- Clipboard, Widgets, OneDrive, Remote Desktop e outras Ã¡reas do Windows

## Arquitetura V6

- `index.html` â€” shell da interface
- `styles/` â€” estilos separados por geraÃ§Ã£o
- `src/core/` â€” runtime e arranque
- `src/features/` â€” funcionalidades de sistema
- `src/apps/` â€” aplicaÃ§Ãµes e ferramentas administrativas
- `tools/migrate_v6.py` â€” migraÃ§Ã£o reproduzÃ­vel do build V5 para a estrutura modular

## SeguranÃ§a

Este projeto Ã© uma simulaÃ§Ã£o web. CMD, PowerShell, Registry, GestÃ£o de Discos, Windows Update,
Defender, Hyper-V, WSL, ServiÃ§os e Remote Desktop nÃ£o executam operaÃ§Ãµes reais no computador.

NÃ£o sÃ£o recolhidas credenciais reais e o terminal nÃ£o executa comandos do host.

## Nota legal

Projeto educacional e experimental. NÃ£o Ã© afiliado, aprovado ou suportado pela Microsoft.
Windows e Windows 11 sÃ£o marcas da Microsoft Corporation.

