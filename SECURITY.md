# Security

## Modelo de segurança

O Windows 11 Simulator corre no navegador e mantém todas as operações administrativas dentro de uma
camada virtual. Interfaces como CMD, PowerShell, Registry Editor, Device Manager, Disk Management,
Windows Update e Remote Desktop não devem executar ações no sistema operativo real.

## Funções reais autorizadas

Algumas áreas podem interagir com capacidades reais do navegador, mas apenas após ação explícita do utilizador:

- abertura e gravação de ficheiros reais;
- importação de ficheiros e pastas para o Explorer virtual;
- área de transferência real;
- reprodução de imagens, áudio e vídeo escolhidos pelo utilizador;
- notificações do navegador;
- instalação como PWA.

Estas integrações não devem ler ficheiros, pastas, clipboard, microfone, câmara ou outros recursos em segundo plano. Os ficheiros importados para o Explorer são guardados como cópias controladas no IndexedDB do site. CMD, PowerShell, Registry, Serviços, Gestão de Discos e restantes ferramentas administrativas continuam virtuais.

## Reportar problemas

Se encontrar uma função que consiga escapar da simulação, executar comandos reais, aceder ao
filesystem real sem intenção explícita ou expor informação sensível, abra um GitHub Issue com passos
de reprodução e impacto.

Não inclua palavras-passe, tokens, chaves de API ou outros segredos nos relatórios.

## Contas locais e sessões

As credenciais locais nunca são guardadas em texto simples. O simulador guarda apenas um derivado PBKDF2-SHA-256 com salt aleatório e iterações configuradas. Cada perfil usa uma chave de estado própria e os blobs importados no IndexedDB são associados ao ownerId da conta. Esta separação é uma barreira lógica dentro da aplicação web e não substitui a segurança de contas reais do sistema operativo ou a proteção contra alguém com controlo total do browser/devtools.

## Ferramentas reais do dispositivo

A V6.8 pode pedir acesso ao microfone, câmara e captura de ecrã apenas depois de uma ação explícita do utilizador. Streams MediaDevices são terminadas quando a aplicação é fechada. As gravações e fotografias importadas são associadas ao ownerId da sessão local. O simulador não ativa microfone, câmara ou captura em segundo plano.

## Backups de perfil

Os ficheiros `.win11profile` não incluem a credencial local, o hash PBKDF2 nem o salt. Podem, no entanto, conter ficheiros, definições, histórico local e outros dados do perfil; devem ser tratados como dados privados. O restauro é efetuado apenas na conta atualmente autenticada e os blobs recebem novos IDs associados ao ownerId dessa conta.
