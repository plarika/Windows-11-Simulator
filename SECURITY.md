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

## Google Navigation V8.1.2

A integração Google mantém o iframe sandboxed e não concede `allow-top-navigation` nem `allow-top-navigation-by-user-activation`. As pesquisas incorporadas usam `newwindow=1` para pedir ao Google que abra resultados numa nova aba/janela, caminho compatível com `allow-popups` e `allow-popups-to-escape-sandbox`. Ao usar o botão para abrir o Google completo, o parâmetro `igu` é removido antes da abertura externa. Assim, conteúdo cross-origin não recebe permissão para substituir o shell do simulador.

## Explorer Navigation V8.2.0

A barra de endereço V8.2 valida caminhos contra o filesystem virtual antes de navegar e não cria pastas implícitas a partir de texto introduzido pelo utilizador. A camada de separadores também suspende operações de navegação virtual enquanto o Explorer está em `real-mount-mode`, evitando misturar estado de separadores virtuais com handles de pastas reais autorizadas pelo browser.

## Explorer Tab Persistence V8.2.1

A persistência de separadores usa exclusivamente o objeto `state` do perfil ativo e armazena apenas caminhos e histórico do filesystem virtual. Handles de File System Access, referências de mounts reais e conteúdo de ficheiros reais não entram no estado dos separadores. A gravação ocorre no momento das alterações de navegação/tabs, evitando callbacks tardios após a janela desaparecer que pudessem coincidir com uma troca de conta.

## Explorer Tab Management V8.3.0

A V8.3 mantém tabs fixados, ordem dos separadores e Acesso rápido dentro do `state` isolado por perfil. O Acesso rápido aceita apenas caminhos que passam pela validação do filesystem virtual e rejeita `This PC`, Reciclagem e referências externas. Handles de File System Access e mounts reais continuam fora do estado persistente. Ações de fecho em massa preservam tabs fixados, reduzindo perda acidental de contexto.

## Explorer Details V8.4.0

O painel de detalhes V8.4 gera preview automático apenas para conteúdo que já pertence ao filesystem virtual do perfil. Ficheiros representados por referências a blobs reais/importados não são lidos automaticamente e exibem apenas uma indicação de privacidade. Em `real-mount-mode`, a seleção é tratada como conteúdo montado e o painel não chama `ensureFolder`, não lê handles e não tenta produzir preview do conteúdo real. O preview textual é truncado a 1200 caracteres para limitar exposição e custo de renderização.

## Explorer Context & Properties V8.5.0

Os menus modernos V8.5 são instalados apenas sobre itens do filesystem virtual. Quando o Explorer entra em `real-mount-mode`, a captura de contexto retorna imediatamente e não substitui os menus das pastas reais montadas. A ficha de Propriedades V8.5 lê apenas metadata e valores já presentes no estado virtual; referências a conteúdo real importado são identificadas como tal sem abrir handles externos. A ação Copiar caminho usa exclusivamente o caminho virtual selecionado.

## Explorer Views & Grouping V8.6.0

As preferências V8.6 armazenam apenas os valores de apresentação `mode` e `group` no `state` do perfil. O agrupamento é suspenso em `real-mount-mode` e não lê, move ou reordena handles de pastas reais. A implementação reutiliza os controlos de vista existentes do Explorer e não altera dados do filesystem.

## Explorer Sidebar V8.7.0

A barra lateral V8.7 persiste apenas preferências de apresentação (`width`, `compact` e estados de colapso). Não acrescenta acesso a novos caminhos, não altera mounts e reutiliza exclusivamente os destinos virtuais já autorizados pelo Explorer.

## Explorer Adaptive Command & Selection V8.8.0

A V8.8 persiste apenas a preferência visual `checkboxes`. A decoração de caixas de seleção e as operações de seleção são bloqueadas em `real-mount-mode`, evitando que a camada virtual tente gerir diretamente itens de pastas reais montadas. O overflow apenas delega ações para APIs já existentes do Explorer.

## Explorer Columns, Sort & Grouping Pro V8.9.0

A V8.9 persiste apenas preferências de apresentação (campo/direção de ordenação, agrupamento, visibilidade e larguras das colunas). Tamanho e data são calculados exclusivamente a partir do filesystem virtual já carregado. Em `real-mount-mode`, o motor de ordenação/agrupamento V8.9 retorna sem ler ou reorganizar conteúdo real montado.

## Explorer File Operations V9.0.0

O motor V9.0 não cria um segundo filesystem: decide apenas a política da operação e delega a cópia/movimento efetivo para as funções já auditadas do Explorer Pro, incluindo o tratamento seguro de blobs reais importados. Operações virtuais são recusadas em `real-mount-mode`. Apenas uma operação é permitida por janela de cada vez, reduzindo condições de corrida. Cancelamento e pausa ocorrem entre itens e nunca interrompem uma mutação a meio. A resolução de conflitos substitui apenas o item virtual de destino explicitamente escolhido.

## Explorer Filesystem Pro V9.1.0

A V9.1 mantém a metadata num mapa separado do conteúdo do VFS para não alterar nem reinterpretar valores existentes, incluindo referências a blobs reais. A camada V9.1 é suspensa em `real-mount-mode` e nunca guarda handles de File System Access. Atalhos `.lnk` virtuais contêm apenas caminhos e tipos do filesystem virtual e são resolvidos com validação de existência antes da abertura. A preferência de ocultar extensões altera apenas o texto apresentado; o nome canónico interno permanece intacto.

## Search 2.0 V9.2.0

A V9.2 constrói um índice apenas a partir do catálogo de aplicações/definições e do filesystem virtual `state.files` já autorizado. Não percorre `real-mount-mode`, não lê handles de File System Access, não consulta o clipboard e não envia queries para serviços externos. Filtros são analisados localmente como dados e não são executados como código. O índice é invalidado por hooks do Filesystem Pro em alterações de conteúdo/metadata e permanece limitado ao perfil ativo.

## Explorer Multi-Window V9.3.0

A V9.3 permite múltiplas janelas apenas dentro do mesmo runtime e desktop virtual autorizado. Transferências entre Explorers reutilizam o motor V9.0 e o mesmo `state.files`; não existe filesystem paralelo. O payload de drag-and-drop entre janelas contém apenas identificador da janela de origem e descritores virtuais de itens. `real-mount-mode` é explicitamente excluído. A gestão de janelas considera apenas filhos reais de `#window-layer`, impedindo previews/clones visuais do Window Manager de serem tratados como janelas operacionais. Sessões secundárias persistentes são limitadas e não armazenam handles reais.

A correção de Acesso rápido V9.3 é exclusivamente visual: faz reset do estilo nativo de `<button>` e define estados normal/hover/ativo/foco no dark theme. Não altera caminhos, permissões nem estado do filesystem.

## Explorer Undo/Redo & File History V9.4.0

A V9.4 persiste apenas descritores reversíveis de operações (`path`, nomes, tipo, destino, timestamp e estado de reversibilidade). Conteúdo de ficheiros, blobs e handles de File System Access não são duplicados no histórico. Undo/Redo reutiliza as funções já auditadas do Explorer Pro e valida a existência da origem e a ausência de conflitos antes de inverter uma operação. `real-mount-mode`, eliminação permanente e substituições destrutivas permanecem fora do Undo. O histórico é limitado a 50 ações por perfil e é isolado pelo mesmo mecanismo de estado dos restantes dados do utilizador.
