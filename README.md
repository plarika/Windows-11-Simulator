# Windows 11 Simulator

Simulador interativo do Windows 11 executado integralmente no navegador.

## Abrir o simulador

**GitHub Pages:** https://plarika.github.io/Windows-11-Simulator/

## Funcionalidades

- Desktop, Start Menu, Taskbar, pesquisa e múltiplos ambientes virtuais
- Window Manager com minimizar, maximizar, redimensionar, Snap Layouts e Alt+Tab
- Explorador de Ficheiros e filesystem virtual persistente
- Notepad, Calculator, Paint, Photos, Edge, Media Player e Microsoft Store simulados
- Settings, Windows Update, Windows Security, Device Manager e Task Manager
- Registry Editor, Event Viewer, Control Panel e ferramentas administrativas
- CMD e PowerShell virtuais
- Gestão de Discos, Serviços, Agendador de Tarefas, Monitor de Recursos e System Information
- Clipboard, Widgets, OneDrive, Remote Desktop e outras áreas do Windows

## Segurança

Este projeto é uma **simulação web**. CMD, PowerShell, Registry, Gestão de Discos, Windows Update,
Defender, Hyper-V, WSL, Serviços e Remote Desktop não executam operações reais no computador.

Não são recolhidas credenciais reais e o terminal não executa comandos do host.

## Persistência

Ficheiros e definições virtuais são guardados localmente no browser através de armazenamento web.
Limpar os dados do site pode remover o estado persistido do simulador.

## Compatibilidade

O simulador foi desenhado para desktop, tablet e smartphone. Algumas interações avançadas são
adaptadas automaticamente em ecrãs pequenos.

## Estado

Versão publicada: **Windows 11 Simulator V5 Web Build**.

A arquitetura modular V6 está em desenvolvimento para facilitar futuras evoluções e testes.

## Nota legal

Projeto educacional e experimental. Não é afiliado, aprovado ou suportado pela Microsoft.
Windows e Windows 11 são marcas da Microsoft Corporation.
