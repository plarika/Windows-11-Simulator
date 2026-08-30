# Security

## Modelo de segurança

O Windows 11 Simulator corre no navegador e mantém todas as operações administrativas dentro de uma
camada virtual. Interfaces como CMD, PowerShell, Registry Editor, Device Manager, Disk Management,
Windows Update e Remote Desktop não devem executar ações no sistema operativo real.

## Reportar problemas

Se encontrar uma função que consiga escapar da simulação, executar comandos reais, aceder ao
filesystem real sem intenção explícita ou expor informação sensível, abra um GitHub Issue com passos
de reprodução e impacto.

Não inclua palavras-passe, tokens, chaves de API ou outros segredos nos relatórios.
