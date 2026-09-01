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

## Recycle Bin Pro V9.5.0

A V9.5 continua a operar apenas sobre o filesystem virtual do perfil ativo e nunca percorre `real-mount-mode` nem File System Access handles. A restauração valida o destino antes de escrever. Em conflitos, `Manter ambos` é o comportamento não destrutivo; `Ignorar` não altera nenhum dos lados; `Substituir` preserva primeiro o item existente colocando-o na própria Reciclagem. O esvaziamento exige confirmação explícita e usa a eliminação permanente já auditada, incluindo limpeza segura de conteúdos reais referenciados quando estes deixam de ter referências virtuais. Ações V9.4 de Undo que dependiam de entradas da Reciclagem restauradas ou removidas manualmente são marcadas como não reversíveis, evitando recuperação enganadora de estado inexistente.

## Previous Versions V9.6.0

A V9.6 guarda apenas snapshots de strings virtuais restauráveis e pequenas. Cada snapshot é limitado a 128 KB, cada ficheiro mantém no máximo 8 versões, o perfil mantém no máximo 80 snapshots e o orçamento global é aproximadamente 1,5 MB. `data:` URLs, blobs reais (`__realBlobId`), conteúdos binários/importados e mounts reais não são copiados para o histórico. As versões usam uma identidade interna separada do caminho, permitindo mover, renomear, reciclar e restaurar sem colidir com um ficheiro novo que reutilize o mesmo nome. Eliminação permanente purga também a identidade de versões correspondente. O API público de listagem expõe apenas metadata da versão, não o conteúdo armazenado; a restauração é feita internamente após validação do ficheiro atual.

## Taskbar & Window Management Pro V9.7.0

A V9.7 trabalha apenas sobre janelas DOM do simulador e estado virtual do perfil ativo. Os previews de grupos são clones visuais: IDs são removidos, controlos interativos recebem `tabindex=-1` e `pointer-events:none`, e `iframe`, `video`, `audio` e `canvas` são substituídos por placeholders antes da apresentação. Não são capturados pixels do desktop real nem conteúdo de outras aplicações do sistema anfitrião. A persistência de geometria guarda apenas `left`, `top`, `width`, `height` e timestamp dentro do estado do perfil; não guarda conteúdo das janelas. A geometria é limitada ao viewport na restauração e o estado é limitado às 60 entradas mais recentes. O progresso da Taskbar recebe apenas snapshots de estado das operações virtuais do Explorer (`id`, modo, estado, contadores e percentagem), sem copiar conteúdo de ficheiros para a Taskbar.

## Settings Core & System Integration Bus V9.8.1

A V9.8.1 opera apenas sobre o estado virtual do perfil ativo. O `Win11SettingsStore` é armazenado dentro do mesmo objeto de perfil já usado pelo simulador e não recebe acesso adicional ao sistema operativo anfitrião, a ficheiros reais ou a permissões do navegador.

Importações são tratadas exclusivamente como dados. JSON acima de 64 KB é rejeitado, categorias e chaves desconhecidas são recusadas, valores são validados contra enums/tipos/intervalos e as chaves `__proto__`, `prototype` e `constructor` são bloqueadas para reduzir risco de prototype pollution. O código não usa `eval`, `new Function` ou execução dinâmica do conteúdo importado.

O checksum FNV-1a32 serve para detetar corrupção ou alteração inconsistente de um pacote exportado. Não é uma assinatura criptográfica e não fornece autenticidade contra um atacante capaz de recalcular o checksum. Configurações não concedem novas capacidades ao navegador nem elevam permissões.

O `Win11SystemBus` aceita apenas tópicos com formato restrito e payloads serializáveis, mantém histórico limitado e isola exceções de listeners. Os eventos DOM associados contêm apenas cópias do payload virtual; não transportam handles de File System Access, conteúdo do desktop real ou referências executáveis.

## Personalization & Settings Integration V9.8.2

A V9.8.2 não acrescenta acesso ao sistema operativo anfitrião. Personalização, escala e opções da Taskbar continuam a alterar apenas DOM, CSS e estado virtual do perfil ativo.

Os consumidores da Taskbar leem snapshots validados do `Win11SettingsStore`. Desativar previews impede a criação do clone visual V9.7 e mostra apenas um placeholder; não captura o desktop real, não ativa media e não adiciona permissões.

A bridge de compatibilidade com Personalization V7.8 mantém o estado legado sincronizado apenas para consumidores existentes. A nova UI não chama `saveState()` diretamente: todas as mutações passam pelo pipeline validado/atómico do Settings Core.

Snapshots de Backup V9.8.2 incluem um pacote de Settings exportado com schema e checksum. Na restauração, o pacote é validado antes de o filesystem virtual ser substituído; se for inválido, a operação é cancelada. Snapshots antigos podem migrar apenas tema e wallpaper através das mesmas regras de validação. O backup não ganha acesso a ficheiros do host, handles File System Access ou credenciais.

## Taskbar System Integration Pro V9.8.3

A V9.8.3 continua limitada à shell virtual do simulador. Auto-hide altera apenas classes CSS e temporizadores locais. A faixa de revelação não lê coordenadas para telemetria nem envia dados para serviços externos; usa apenas eventos de ponteiro dentro da página para revelar a Taskbar.

Mostrar ambiente de trabalho atua exclusivamente sobre elementos `.window` filhos do `#window-layer` pertencentes ao desktop virtual atual. Não minimiza, enumera ou controla janelas do Windows anfitrião. O conjunto temporário de restauração contém apenas IDs internos das janelas virtuais e não é persistido.

A opção de segundos no relógio apenas muda as opções de formatação de `Date.toLocaleTimeString()`. Não altera o relógio do sistema, não consulta serviços de hora externos e não cria um segundo timer de relógio.

As preferências `autoHide`, `showDesktop` e `showSeconds` continuam sujeitas ao schema booleano do `Win11SettingsStore`, persistência por perfil e eventos serializáveis do `Win11SystemBus`. Nenhuma destas opções concede permissões adicionais ao browser ou ao host.

## Explorer Settings Integration V9.8.4

A V9.8.4 não aumenta o acesso do Explorer ao sistema operativo anfitrião. As novas preferências atuam apenas sobre o filesystem virtual, DOM e estado do perfil ativo. Pastas reais montadas através de File System Access continuam sujeitas às regras e permissões já existentes e não são convertidas em conteúdo virtual pelo Settings Store.

`showHidden`, `showExtensions`, `compactView`, `openTo` e `confirmDelete` são valores validados pelo schema do `Win11SettingsStore`. O módulo de Filesystem V9.1 mantém a API pública antiga por compatibilidade, mas as alterações de visibilidade/extensões são encaminhadas para o Store quando este está disponível.

Compact View altera apenas classes CSS e espaçamento visual. Não muda conteúdo de ficheiros, permissões, metadata ou modo de vista persistido pelo Explorer Views.

`openTo=home` resolve apenas para um caminho virtual já presente no Acesso rápido do perfil, com fallback `C:/Documents`. Caminhos explícitos fornecidos por aplicações ou ações do utilizador têm prioridade e não são substituídos pela preferência.

Quando `confirmDelete=true`, o diálogo é mostrado antes de qualquer alteração ao filesystem virtual. A eliminação permanente por `Shift+Delete` mantém confirmação própria mesmo que a confirmação normal esteja desativada. Esta escolha é deliberada para não reduzir a proteção de uma ação irreversível.

A V9.8.4 também endurece o Mount audit: o teste de cartão de pasta real cria uma nova janela explícita `This PC`, evitando depender da preferência `openTo` do perfil ou do estado de uma janela Explorer reutilizada.

## Resource Monitor Contrast Hotfix V9.8.4.1

Este hotfix altera apenas apresentação CSS do Monitor de Recursos. Não adiciona novas APIs, permissões, acesso ao host, recolha de métricas reais nem comunicação externa.

Os valores de CPU, memória, disco e rede continuam a ser os mesmos valores virtuais/simulados já existentes. O hotfix apenas corrige fundo, cor do texto, estados de tabs, tabela e responsividade visual.

A folha `resource-monitor-v9841.css` é totalmente scoped a `.resmon` e respetivo estado `#app.theme-dark`, reduzindo o risco de alterar outras aplicações. O Browser audit verifica contraste mínimo para títulos, tabs e tabela nos modos claro e escuro.

## Apps & Default Applications V9.8.5

A V9.8.5 introduz uma registry explícita de aplicações e associações, mas não permite registar código arbitrário. Todos os handlers são escolhidos a partir de uma allowlist fixa de aplicações internas conhecidas. Extensões e protocolos desconhecidos ou associações incompatíveis são rejeitados.

As preferências continuam armazenadas no `Win11SettingsStore`, sujeitas ao schema V1, validação de enum, proteção contra prototype pollution, commit atómico, checksum de integridade e persistência por perfil. `state.fileAssociations` e `state.protocolAssociations` existem apenas como bridges de compatibilidade e não são a fonte canónica.

O Protocol Registry limita-se a `http` e `https`. URLs inválidos e esquemas como `javascript:`, `data:` ou outros protocolos não allowlisted são rejeitados antes de abrir uma aplicação.

A abertura de HTML virtual no Edge não executa o documento original. O conteúdo é analisado como dados, scripts e elementos ativos são removidos, atributos `on*`, `style`, `srcdoc` e `formaction` são eliminados, recursos remotos de imagem são bloqueados e links permitidos ficam limitados a HTTP/HTTPS com `noopener noreferrer`. O resultado é carregado num iframe sem permissões e com CSP restritiva.

PDF virtual é materializado apenas a partir do conteúdo já autorizado no simulador e apresentado num iframe sandboxed através de Blob URL temporário. O Blob URL é revogado quando a janela correspondente deixa o DOM.

Nenhuma associação V9.8.5 concede permissões do browser, acesso a ficheiros reais, capacidades do host ou execução de comandos do sistema operativo. Pastas reais montadas continuam sujeitas às fronteiras e permissões já documentadas pelo File System Access API.

## Storage 2.0 V9.8.6

A V9.8.6 calcula apenas armazenamento pertencente ao simulador. A capacidade de 128 GB é um modelo virtual e não consulta, representa ou modifica a capacidade do disco real do sistema anfitrião. A API `navigator.storage` usada noutro módulo de diagnóstico do dispositivo permanece separada de `Win11Storage`.

O scanner de categorias percorre exclusivamente `state.files` do perfil ativo e a Reciclagem virtual. Pastas montadas através de File System Access não são percorridas nem contabilizadas automaticamente pelo Storage 2.0.

A limpeza automática permanece desativada por defeito. Quando ativada, só pode remover conteúdo sob os roots virtuais allowlisted `C:/Temp`, `C:/Windows/Temp` e `C:/AppData/Local/Temp`. A Reciclagem é uma opção separada do Settings Store e pode ser excluída da limpeza.

Antes de eliminar uma referência virtual que represente conteúdo importado, o motor tenta `RealContentBridge.cleanupVirtualValue()`, permitindo remover de forma consistente o Blob associado ao perfil. O esvaziamento da Reciclagem reutiliza `Win11ExplorerRecycle.empty()`, preservando as invalidações de histórico e as regras de eliminação permanente já auditadas.

`Win11Storage` não recebe handles File System Access, caminhos do host, permissões adicionais, acesso a processos, execução de comandos ou capacidade de apagar ficheiros reais. O evento `storage:changed` contém apenas contadores, bytes libertados e origem textual limitada.

O Browser audit da V9.8.6 testa a limpeza dentro de uma cópia temporária isolada de `state.files` e substitui temporariamente `saveState()` por um no-op durante esse sandbox. O objeto original do perfil e as definições de armazenamento são restaurados antes de continuar o audit.

A correção de sessão Explorer associada à V9.8.6 separa reabertura da janela principal de criação explícita de uma nova janela. Apenas `openAppNewWindow(..., caminho)` marca o destino como explícito; isto impede que uma sessão antiga substitua o destino solicitado sem desativar o restauro normal de tabs da janela principal.

## System Integration & Hardening V9.8.7

A V9.8.7 introduz diagnóstico e reconciliação apenas para o estado interno do simulador. `Win11SystemHealth` não recebe acesso ao host, File System Access handles, processos, credenciais, clipboard real ou conteúdo dos ficheiros virtuais.

O diagnóstico usa APIs públicas dos módulos já existentes e compara apenas valores de configuração agregados. O pacote exportado `win11-simulator-system-health` inclui versão, score, estado, revisão do Settings Store, contadores do System Bus e resultados técnicos dos checks. Não inclui `activeUserId`, `state.files`, nomes de ficheiros, conteúdo, `fileAssociations` completos ou dados de conta.

`Win11SettingsStore.reconcileLegacy()` considera o Settings Store a fonte canónica. A função reaplica os valores validados às bridges legadas e não altera os valores do Store nem incrementa a revisão. Um digest das bridges é comparado antes/depois; `saveState()` só é chamado se existir uma mudança real.

A reconciliação V9.8.7 não executa resets. Reaplica apenas Personalização, Explorer Settings/Filesystem, Taskbar e reparação de botões já auditada, além de invalidar o índice de pesquisa local. Erros individuais dessas reaplicações são isolados e o diagnóstico final indica se a integração continua degradada.

Os aliases `.htm` e `.jpeg` foram alinhados com a registry V9.8.5 para impedir que bridges antigas apontem para handlers diferentes dos resolvidos por `Win11FileAssociations`.

O histórico de saúde é exclusivamente em memória e limitado a 20 entradas. Os eventos `settings:reconciled` e `system-health:reconciled` transportam apenas revisão, contagens, score, origem textual limitada e nomes internos de ações de reconciliação.

## App Lifecycle & System Shell V9.9.0

A V9.9.0 introduz um router interno de intents, mas não adiciona capacidade de executar comandos do host. `Win11Shell` só resolve tipos explicitamente allowlisted: aplicações internas, páginas conhecidas de `ms-settings:`, destinos `shell:` virtuais, HTTP/HTTPS e paths já existentes no filesystem virtual do perfil.

Paths virtuais são normalizados para o namespace `C:/...` do simulador. Segmentos relativos `.` e `..`, strings vazias, NUL e paths fora deste namespace são rejeitados. O router não converte paths virtuais em paths Windows reais e não recebe File System Access handles.

URLs continuam limitados a HTTP/HTTPS e são entregues a `Win11ProtocolRegistry`. Schemes como `javascript:`, `data:`, `file:` real, `ftp:` e outros não allowlisted não são executados pelo router.

Ficheiros virtuais são abertos através da cadeia já auditada `Win11DefaultApps` + `openFile`. O router não lê nem serializa o conteúdo do ficheiro para o seu histórico. O histórico de intents guarda apenas tipo, origem, aplicação resolvida, scheme HTTP/HTTPS e uma classificação genérica do destino de pasta.

`Win11AppLifecycle` observa apenas nós DOM `.window` e mudanças de classe/`data-desktop` dentro de `#window-layer`. Os eventos contêm identificador efémero da janela, app interna, PID virtual, desktop virtual e flags de estado. Não incluem credenciais, ficheiros, clipboard, localização, permissões do browser ou dados do host.

Os históricos de intents e lifecycle existem exclusivamente em memória e estão limitados a 60 e 100 entradas respetivamente. Não são gravados no perfil nem enviados para serviços externos.

Executar, Terminal e PowerShell virtual continuam sem acesso ao shell do sistema operativo. `start` e `Start-Process` usam `Win11Shell` apenas quando o argumento corresponde a um intent suportado; os restantes comandos mantêm o comportamento virtual anterior.

## App Sessions & Activation V9.9.1

A V9.9.1 gere apenas janelas DOM do simulador e não cria processos reais. As políticas single/multi-instance são aplicadas sobre identificadores internos presentes em `APPS`; IDs desconhecidos são rejeitados.

`openAppNewWindow()` continua disponível, mas é envolvido por uma política explícita. Para aplicações single-instance, uma janela já existente no desktop virtual atual é restaurada e focada em vez de duplicada. Aplicações multi-instance continuam a usar o criador de janelas já auditado.

`Win11AppSessions` não persiste conteúdo de sessão, URLs, nomes de ficheiros, credenciais ou handles. O snapshot contém apenas app interna, contagem de janelas, política, estado visível/focado e números de desktops virtuais.

O histórico de sessões é exclusivamente em memória, limitado a 80 entradas e contém apenas ação, app interna, ID efémero de janela, desktop virtual, origem textual limitada e política. Os eventos enviados ao `Win11SystemBus` usam o mesmo conjunto de metadados técnicos.

As ações Ativar e Fechar em Definições operam apenas sobre elementos `.window` dentro de `#window-layer`. Não existe capacidade de terminar processos do Windows anfitrião nem de interagir com aplicações fora do simulador.

## Session Restore & App Reopen V9.9.2

A V9.9.2 persiste apenas metadados mínimos das janelas virtuais quando o utilizador ativa explicitamente a opção de reabrir aplicações. A funcionalidade permanece desativada por defeito.

O snapshot pertence ao estado do perfil já existente e contém apenas identificador interno da aplicação, desktop virtual, flags minimizada/maximizada/focada, ordem e, exclusivamente para o Explorer, um destino virtual allowlisted. Não contém texto do Notepad, URLs do Edge, nomes de ficheiros, conteúdo de documentos, credenciais, IDs de conta, clipboard, permissões, dados de dispositivo ou File System Access handles.

Os destinos Explorer persistíveis estão limitados a `This PC`, `C:/Desktop`, `C:/Documents`, `C:/Downloads`, `C:/Pictures`, `C:/Music`, `C:/Videos`, `C:/OneDrive` e `Recycle Bin`. Caminhos personalizados e Explorer em `real-mount-mode` não produzem hint de restauração.

O snapshot é limitado a 24 janelas. Aplicações multi-instance ficam limitadas a 4 entradas por aplicação e desktop virtual; aplicações single-instance ficam limitadas a uma. Snapshots com mais de 30 dias são considerados expirados e não são restaurados automaticamente.

A restauração usa exclusivamente `Win11AppSessions` e elementos dentro de `#window-layer`. Não inicia processos do sistema anfitrião, não abre aplicações do Windows real e não converte caminhos virtuais em caminhos do host.

Os eventos `win11-session-saving` e `win11-session-start` são deliberadamente neutros e não transportam o identificador da conta. Servem apenas para ordenar captura e restauração em relação à persistência do perfil.

Como hardening adicional, `openApp()` e o lookup principal da Taskbar foram restringidos a `#window-layer > .window`. As previews da Taskbar usam clones visuais que podem conter a classe `.window`; esses clones já não podem ser selecionados como se fossem uma janela de aplicação real.

O Browser audit da V9.9.2 cria apenas sessões de teste controladas, valida que conteúdo e caminhos personalizados não entram no snapshot, fecha apenas as janelas criadas pelo teste e restaura a configuração de sessão anterior antes de continuar.

## Window Restore Fidelity V9.9.3

A V9.9.3 acrescenta geometria ao snapshot de sessão, mas mantém o princípio de minimização de dados da V9.9.2. Os novos campos limitam-se a coordenadas/dimensões numéricas do retângulo da janela, dimensões do viewport de origem e, quando aplicável, nome interno do layout Snap e índice do slot.

Todos os valores de geometria são convertidos para números finitos, arredondados e limitados. O viewport persistido fica limitado a 320–10000 px de largura e 240–10000 px de altura. O retângulo é normalizado para permanecer dentro desse viewport, com dimensão mínima de 300×220 px e sem ocupar a área reservada à Taskbar.

No restore, a geometria é recalculada para o viewport atual e novamente limitada. Valores absurdos, negativos, infinitos ou fora do ecrã não são aplicados diretamente. O snapshot não pode posicionar uma janela fora da área visível.

O estado Snap é aceite apenas quando `layout` existe em `Win11WindowManager.layouts` e `slot` aponta para um slot válido desse layout. A aplicação do Snap usa a API existente `Win11WindowManager.applyLayoutSlot()`; não existe execução de CSS ou código obtido do snapshot.

Para janelas maximizadas ou snapped, o snapshot utiliza apenas o retângulo flutuante interno já mantido pelo simulador. Não é lido qualquer conteúdo da aplicação.

A proteção anti-restauro duplicado utiliza apenas um fingerprint em memória produzido a partir dos metadados já sanitizados do snapshot. O fingerprint não é persistido nem enviado externamente. Se o mesmo snapshot for solicitado novamente dentro de 2200 ms, o segundo restore é ignorado e é emitido apenas um evento técnico `session-restore:skipped`.

Os metadados V9.9.3 continuam sem incluir texto, URLs, nomes de ficheiros, paths personalizados do Explorer, credenciais, IDs de utilizador, clipboard, handles do File System Access API ou dados do host.

## Session Recovery & Crash Resume V9.9.4

A V9.9.4 acrescenta um marcador de saúde da sessão ao perfil existente, mas não cria uma nova cópia do conteúdo das aplicações. O Recovery Manager reutiliza exclusivamente o snapshot sanitizado de `Win11SessionRestore`.

O estado `sessionRecoveryV994` guarda apenas schema, preferência de auto-resume, estado runtime, timestamps, classificação do último encerramento, flag de recovery pendente e contadores agregados. Não guarda nome da conta, ID da conta, credenciais, texto, URLs, nomes de ficheiros, paths personalizados, clipboard ou handles de dispositivos/ficheiros.

A presença de uma sessão autenticada é verificada através da API existente `Win11SessionManager.activeUserId`, mas esse identificador não é copiado para `sessionRecoveryV994`, para o diagnóstico nem para os eventos do Recovery Manager.

O heartbeat é atualizado a cada 30 segundos apenas enquanto existe uma sessão autenticada com estado `running`. Cada atualização utiliza a persistência local já isolada por perfil; não envia telemetria nem faz pedidos de rede.

Eventos `win11-session-saving` são síncronos. Isto permite classificar Terminar sessão, power/restart, forced-end e mudança de conta como encerramentos limpos antes de `saveActiveProfile()` persistir o perfil. Razões `lock-*` são classificadas como sessão bloqueada, não como encerramento.

Uma sessão é considerada interrompida apenas quando um novo `win11-session-start` encontra o marcador anterior ainda em `running`. O Recovery Manager não tenta inferir causas externas, processos do host ou detalhes de crash.

Auto-resume está ativo por defeito apenas para manter a compatibilidade funcional com a reabertura automática existente. Quando desativado, o snapshot permanece inalterado até o utilizador escolher Recuperar ou Descartar. Descartar limpa apenas a flag de recovery pendente.

O histórico do Recovery Manager existe apenas em memória e é limitado a 24 entradas. Os eventos enviados ao `Win11SystemBus` contêm apenas versão, origem/reason limitada, contagens e flags técnicas.

O Recovery Manager não tem acesso ao shell do sistema operativo, processos reais, filesystem real, credenciais, clipboard real, permissões do browser ou conteúdo das janelas.

## Recovery UX & Safe Mode V9.9.5

O Modo de Segurança da V9.9.5 é uma funcionalidade do simulador. Não corresponde ao Safe Mode do Windows anfitrião e não altera boot configuration, serviços, drivers, registry, processos ou políticas do sistema operativo real.

A política de aplicações essenciais é aplicada ao caminho final de lançamento do shell do simulador através de `openApp()` e `openAppNewWindow()`. Serve para reproduzir a experiência de um ambiente reduzido; não deve ser interpretada como uma fronteira de segurança contra JavaScript já executado dentro da própria aplicação.

Ao entrar em Safe Mode, `Win11SessionRestore.setCaptureSuspended(true)` impede que o fecho das janelas normais e a abertura das ferramentas essenciais substituam o snapshot recuperável. Esta flag existe apenas em memória e não desativa nem apaga a preferência de Session Restore do perfil.

A saída do Safe Mode reativa a captura antes de executar qualquer recuperação. Recuperar usa exclusivamente o snapshot já sanitizado pelo Session Restore schema 2. Sair sem recuperar descarta apenas o pedido de recovery pendente; o mecanismo não lê conteúdo das aplicações.

O estado `safeModeV995` persiste apenas schema, flag ativa, timestamps, reason limitada, estado anterior do motor de background e contadores técnicos de lançamentos bloqueados. Não contém ID/nome da conta, credenciais, texto, URLs, ficheiros, clipboard, tokens, paths reais ou handles.

O diagnóstico mostrado no overlay e em Definições contém apenas classificação da última saída, timestamps de heartbeat/recovery e contagens agregadas. O overlay não recolhe nem transmite dados externamente.

O motor `Win11BackgroundEngine` é pausado através da sua API pública existente. Safe Mode não termina processos do host nem interfere com tarefas do Windows real.

Os testes dinâmicos da V9.9.5 preservam o estado anterior de Restore/Recovery, suspendem a captura durante as mudanças de janelas, validam a política do shell e restauram a configuração anterior antes de continuar a suite.

## Edge Google & YouTube Compatibility V9.9.6

A compatibilidade desta versão não contorna políticas de segurança dos sites. O simulador continua sujeito a Content-Security-Policy, X-Frame-Options e restantes restrições impostas por Google, YouTube e pelo navegador.

O Google incorporado usa `igu=1` e solicita `newwindow=0` para favorecer navegação no mesmo iframe quando permitido. A opção de abrir o Google completo continua a usar o browser real e remove o parâmetro específico de incorporação.

Links YouTube diretos são transformados apenas em rotas internas validadas e em URLs oficiais `https://www.youtube-nocookie.com/embed/...`. IDs de vídeo aceitam exclusivamente o formato seguro de 11 caracteres; IDs de playlist são limitados a caracteres alfanuméricos, hífen e underscore e a um comprimento máximo definido.

O player YouTube está dentro de um iframe sandboxed. Não recebe `allow-top-navigation`, não executa código do host, não recebe credenciais do simulador e não usa proxy, API key ou serviço de bypass. Permissões multimédia são explicitamente limitadas às necessárias para o player incorporado.

A pesquisa completa do YouTube não é extraída nem contornada. Sem uma API oficial configurada, o simulador oferece apenas o fallback explícito para o site real.

Domínios Google regionais são reconhecidos por uma allowlist/padrão limitado de host; isto não relaxa as regras para hosts arbitrários.

O hotfix não lê histórico do browser anfitrião, cookies externos, tokens, credenciais, clipboard, ficheiros reais ou dados de conta Google/YouTube. O histórico guardado continua a ser apenas o histórico virtual já existente no perfil do simulador.

## Edge Search Experience Pro V9.9.7

A V9.9.7 integra apenas providers oficiais: Google Programmable Search Element e YouTube Data API v3. Não utiliza scraping, proxy de terceiros, bypass de X-Frame-Options/CSP ou endpoints não documentados.

O Google Search Engine ID (`cx`) pode ser persistido no perfil virtual porque funciona como identificador público de configuração do Programmable Search Engine. O Edge não guarda passwords, cookies ou credenciais Google.

A chave YouTube é tratada como credencial pública de browser e nunca como segredo confiável. Quando introduzida pela UI, é guardada apenas em `sessionStorage` sob uma chave dedicada e não é copiada para `state.edgeBrowser`, `state.edgeSearchV997`, backups, diagnósticos, histórico ou Git. Uma deployment pode fornecer `WIN11_EDGE_YOUTUBE_API_KEY`, mas uma chave exposta ao browser deve ser restringida por HTTP referrer e por API no Google Cloud.

As chamadas YouTube usam `credentials: "omit"` e apenas o endpoint oficial `https://www.googleapis.com/youtube/v3/search`. A pesquisa força `type=video`, `videoEmbeddable=true` e `videoSyndicated=true`. A UI ignora resultados que não contenham um video ID válido e não apresenta channel/account fields.

Títulos e metadados devolvidos pelo YouTube são inseridos na UI via `textContent`. URLs de miniaturas são aceites apenas por HTTPS em hosts `ytimg.com` esperados. IDs de vídeo e page tokens são validados antes de reutilização.

O Google Programmable Search é carregado apenas quando existe um `cx` configurado. O componente é renderizado com o contrato oficial `searchresults-only`, `gname` de topo e `linkTarget="_self"`. Cliques HTTP/HTTPS são intercetados no container de resultados; esquemas como `javascript:` são rejeitados.

Por defeito, resultados Google abrem numa nova tab virtual do Edge. Essa tab mantém sempre uma barra controlada pelo simulador com “Abrir site completo”. Quando um host é conhecido por bloquear frames, o simulador apresenta Compatibility Mode imediatamente. Para hosts desconhecidos, o browser continua a ter a palavra final sobre CSP/X-Frame-Options; o simulador não tenta contornar essas políticas.

O hotfix não lê cookies do browser real, histórico externo, tokens Google, credenciais de conta, clipboard real, ficheiros do host ou conteúdo privado de Google/YouTube.
