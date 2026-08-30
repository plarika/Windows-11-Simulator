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

## Partilha e impressão

A partilha nativa só é iniciada após ação explícita do utilizador e usa `navigator.share` quando disponível. O simulador não envia ficheiros para um servidor próprio. A impressão cria apenas uma vista temporária local do ficheiro e chama o diálogo de impressão do browser/sistema. Conteúdo de texto é escapado antes da vista de impressão para evitar execução de HTML fornecido pelo utilizador.

## Pastas reais montadas

A V7.1 só acede a diretórios escolhidos explicitamente pelo utilizador através da File System Access API. A montagem nunca concede acesso automático ao resto do sistema. Operações de criar, renomear, escrever e eliminar afetam diretamente a pasta selecionada e são apresentadas como operações reais na interface. Handles persistidos ficam associados ao ownerId da conta local; ao eliminar uma conta, as referências de montagem desse perfil são removidas.

## Compatibilidade Web do Edge

A camada Web do Edge continua a respeitar as políticas de incorporação dos sites. O simulador não tenta contornar X-Frame-Options ou Content-Security-Policy. A V8.1.1 substitui a integração especial do YouTube por `https://www.ouvirmusica.com.br/`, carregada como conteúdo Web real num iframe sandboxed. O iframe recebe apenas as permissões necessárias para navegação e reprodução (`autoplay; encrypted-media`), e mantém um botão explícito para abrir o endereço real externamente caso o site altere as suas políticas de incorporação.

## Downloads do Edge

A página `edge://downloads` só transfere recursos por `fetch()` quando o servidor remoto permite CORS. O simulador não contorna políticas cross-origin. O conteúdo descarregado é entregue ao utilizador através de File System Access quando disponível ou por download local do browser. Histórico, favoritos e sessão do Edge ficam dentro do perfil local atual.

## Explorer Pro V7.4

A seleção múltipla e as operações em lote da V7.4 atuam no filesystem virtual do perfil atual. Pastas reais montadas continuam a usar a camada explícita File System Access da V7.1 e não são modificadas silenciosamente pela lógica de batch virtual. Ao copiar um ficheiro importado para IndexedDB, a V7.4 cria um novo Blob associado ao utilizador atual para evitar referências partilhadas perigosas entre cópias.

## Window Manager V7.5

Os previews de Alt+Tab, Task View e taskbar são clones visuais sanitizados da interface local. Iframes, vídeo, áudio e canvas não são executados novamente dentro dos previews. Snap Layouts e ambientes virtuais atuam apenas nas janelas do simulador e não controlam janelas reais do sistema operativo.

## Real Device Integration V7.6

O Centro do dispositivo mostra apenas dados que o navegador expõe à aplicação. Não tenta obter identificadores ocultos nem contorna permissões. Câmara, microfone, notificações e localização só são solicitados após uma ação explícita do utilizador. O relatório de diagnóstico não inclui coordenadas de localização, conteúdo da área de transferência, credenciais, PINs ou palavras-passe. Métricas de rede como downlink e RTT são estimativas da Network Information API quando o browser as disponibiliza.

## Notifications and Background V7.7

O motor de tarefas da V7.7 é interno ao simulador e apenas executa ações JavaScript previamente definidas pelo projeto; não executa comandos do sistema operativo, scripts externos, child processes, eval ou código introduzido pelo utilizador. O modo Não incomodar apenas controla banners do simulador e notificações reais já autorizadas. As tarefas continuam limitadas ao estado virtual do perfil ativo.


## Settings and Windows Security V7.8

O Windows Security V7.8 é um subsistema interno do simulador. As verificações analisam exclusivamente o filesystem virtual guardado no estado do perfil e procuram apenas o marcador inofensivo `WIN11_SIMULATOR_TEST_THREAT`, criado pelo próprio simulador para testes. Não são lidos ficheiros do Windows anfitrião, pastas montadas pelo File System Access API, processos, Registry, Microsoft Defender, TPM, Secure Boot ou regras reais do Windows Firewall.

Os controlos de firewall, SmartScreen, proteção em tempo real, cloud, tamper e ransomware são estados virtuais persistentes. Nenhuma destas opções modifica políticas ou definições do sistema operativo real. O diagnóstico do ambiente web limita-se a sinais expostos pelo browser, como `isSecureContext`, `navigator.onLine` e disponibilidade de IndexedDB.

## System Tray and Quick Settings V7.9

O System Tray V7.9 apenas observa sinais que o navegador disponibiliza explicitamente. O estado de rede usa `navigator.onLine` e, quando disponível, a Network Information API. O estado de bateria usa a Battery Status API quando exposta pelo navegador. Nenhum destes controlos liga/desliga Wi-Fi, Bluetooth, interfaces de rede ou bateria do dispositivo.

Volume, brilho, Bluetooth e luz noturna são controlos virtuais do simulador. Fullscreen e Wake Lock usam APIs Web reais apenas após uma ação do utilizador e quando suportadas pelo navegador. O indicador de privacidade apenas observa streams MediaStream já autorizados e ativos dentro da própria página; não enumera nem captura dispositivos em segundo plano.

## Windows Experience and Updates V8.0

O Windows Hello da V8.0 é exclusivamente visual e não usa WebAuthn, reconhecimento facial, impressão digital ou dados biométricos. A autenticação continua a usar a credencial local PBKDF2 já existente.

As atualizações PWA deixam de ativar silenciosamente uma nova Service Worker quando já existe uma versão ativa. A nova worker aguarda até o utilizador escolher Atualizar agora; só então recebe a mensagem SKIP_WAITING. O reload automático ocorre apenas após essa confirmação e após controllerchange. A opção Depois mantém a versão atual durante a sessão.

## Start and Search V8.1

A pesquisa V8.1 indexa apenas aplicações, definições e o sistema de ficheiros virtual pertencente ao perfil ativo. Não percorre pastas reais montadas, não lê o conteúdo da área de transferência e não envia consultas para serviços externos. A pesquisa por conteúdo limita a análise de cada valor textual virtual para evitar trabalho excessivo no UI thread.

Pins, aplicações recentes e histórico de pesquisa são guardados apenas no estado do perfil local ativo. As jump lists operam sobre aplicações e ficheiros do simulador; não executam comandos do sistema anfitrião.
