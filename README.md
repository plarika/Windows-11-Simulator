# Windows 11 Simulator

Simulador interativo do Windows 11 executado integralmente no navegador.

## Abrir o simulador

**GitHub Pages:** https://plarika.github.io/Windows-11-Simulator/

## Versão atual

**V9.9.5 Recovery UX & Safe Mode** — escolha visual após interrupção, Modo de Segurança virtual com apps essenciais, preservação do snapshot e diagnóstico de recuperação em Definições > Contas.

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

## V6.7 Local Accounts & Sessions

- contas locais separadas por utilizador
- PIN/palavra-passe protegido com PBKDF2-SHA-256 e salt aleatório
- estado do simulador guardado numa chave própria por perfil
- sessão ativa em sessionStorage para sobreviver a refresh sem misturar contas
- bloquear, terminar sessão e mudar de utilizador
- primeiro perfil migra os dados existentes e guarda backup da chave legada
- blobs IndexedDB passam a ter ownerId por utilizador
- deteção de sessão concorrente da mesma conta via BroadcastChannel
- takeover explícito termina a sessão da outra janela
- contas ficam guardadas apenas neste dispositivo/browser

## V6.7.1 Session Boot Fix

- o gestor de sessões é preparado antes de o ecrã de boot desaparecer
- o ecrã de login/registo fica disponível na primeira abertura sem refresh
- quando já existem contas, o runtime deixa de carregar ou gravar estado fora de uma sessão autenticada
- cache PWA/service worker atualizada para forçar a nova sequência de arranque
- o ecrã de bloqueio inicial fica preparado sob o boot para evitar um estado intermédio clicável

## V6.7.2 First-Load Fix

- todos os scripts do simulador usam `defer`, permitindo download em paralelo na primeira abertura
- a ordem de execução continua preservada
- o gestor de sessões é preparado antes de o boot desaparecer
- o ecrã inicial mostra `A preparar sessão...`
- cache PWA/service worker atualizada para 6.7.2

## V6.7.3 Android Login Fix

- PBKDF2 passa a ser executado num Web Worker dedicado
- a interface deixa de ficar bloqueada durante a verificação no Android
- fallback Web Crypto no thread principal com timeout
- botão de login não permite submissões duplicadas
- contas antigas com 180000 iterações são migradas após login válido para 120000 iterações
- o PIN/palavra-passe continua sem ser persistido em texto simples

## V6.7.4 Login Overlay Fix

- corrigido conflito CSS entre #lock.hidden e #lock.session-lock
- após login válido o ecrã de autenticação fica realmente com display:none
- auditoria passa a validar getComputedStyle em vez de apenas a classe hidden
- cache PWA atualizada para 6.7.4

## V6.8 Real Device Tools

- Gravador de Som com microfone real e MediaRecorder
- gravações guardadas no filesystem do perfil através do IndexedDB
- Câmara real com preview, troca frontal/traseira e fotografia para Imagens
- Ferramenta de Recorte com getDisplayMedia quando suportado
- Informações do Sistema com dados reais expostos pelo navegador
- armazenamento persistente via Storage API
- Wake Lock opcional para manter o ecrã ativo
- modo ecrã completo real
- rede online/offline refletida através de eventos reais do browser
- todas as permissões sensíveis continuam a exigir ação explícita do utilizador

## V6.9 Profile & Recovery

- fotografia/avatar por conta local
- alteração do nome da conta
- alteração segura de PIN/palavra-passe com PBKDF2-SHA-256
- eliminação de contas inativas e limpeza dos respetivos blobs IndexedDB
- exportação de perfil para ficheiro `.win11profile`
- backup inclui estado virtual e até 64 MB de blobs reais do utilizador
- o backup exclui credencial, hash e salt do login
- restauro remapeia IDs de blobs para evitar colisões entre contas
- bloqueio automático configurável por inatividade
- bloqueio de sessão encerra Câmara e finaliza de forma segura o Gravador
- terminar sessão interrompe streams sensíveis e descarta gravações ainda não concluídas

## V7.0 Desktop Integration

- associações de ficheiros por extensão, persistentes por perfil
- Abrir com... no Explorador
- Aplicações predefinidas em Definições > Aplicações
- partilha real através de `navigator.share` quando suportada
- fallback de partilha para clipboard ou exportação
- impressão real de texto e imagens através do diálogo do navegador/sistema
- Definições Rápidas mostram o estado real online/offline
- Fullscreen e Wake Lock reais diretamente nas Definições Rápidas
- a página deixa de fingir que consegue ligar/desligar o Wi-Fi real
- Definições > Rede distingue claramente rede real de redes virtuais simuladas

## V7.1 Real Folder Mounts

- montar uma pasta real escolhida explicitamente pelo utilizador
- handle de diretório guardado em IndexedDB quando o navegador permite
- montagens isoladas por conta local
- reautorização após refresh quando o browser exigir
- navegação real sem copiar previamente a pasta para o filesystem virtual
- abrir ficheiros reais com Bloco de Notas, Fotografias, Pintar e Media Player
- Bloco de Notas escreve de volta no mesmo ficheiro montado
- criar pastas e documentos de texto reais
- mudar nome de ficheiros e pastas reais
- eliminar diretamente dentro da pasta autorizada
- Partilhar, Imprimir e Abrir com funcionam também nos ficheiros montados
- montagens aparecem em Este PC e na navegação do Explorador
- quando o File System Access API não existe, o Explorador mantém o modo Importar pasta como fallback

## V7.2 Edge Internet Compatibility

- pesquisa Google diretamente pela barra do Edge
- Google homepage/search com modo de incorporação compatível
- integração Web real com fallback quando um site bloqueia iframe
- o atalho principal de música abre https://www.ouvirmusica.com.br/
- Ouvir Música é carregado num iframe sandboxed com permissão explícita para reprodução de áudio
- sessões antigas com rotas `edge://youtube` são migradas automaticamente para Ouvir Música
- atalhos Google, Ouvir Música, Wikipedia e GitHub no novo separador
- sites conhecidos por bloquear iframe recebem uma página de compatibilidade em vez de um ecrã vazio
- botão Abrir site real preservado em todos os modos
- o simulador não contorna X-Frame-Options nem Content-Security-Policy dos sites

## V7.3 Edge Advanced

- favoritos persistentes por perfil e barra de favoritos
- histórico de navegação pesquisável por perfil
- página `edge://downloads` com downloads diretos quando CORS permite
- página `edge://favorites`
- página `edge://history`
- página `edge://settings`
- restaurar sessão de separadores depois de refresh
- separadores fixados
- duplicar separador
- fechar outros / fechar à direita
- reabrir separador fechado
- atalhos Ctrl+T, Ctrl+W, Ctrl+Shift+T, Ctrl+L, Ctrl+R e Ctrl+Tab
- Google V7.2 mantido; Ouvir Música substitui a integração YouTube a partir da V8.1.1

## V7.4 Explorer Pro

- seleção múltipla com Ctrl+clique e Shift+clique
- caixa de seleção por arrasto em área vazia
- Ctrl+A, Ctrl+C, Ctrl+X e Ctrl+V no Explorer
- Delete envia vários itens para a Reciclagem
- Shift+Delete elimina permanentemente com confirmação
- copiar/mover vários ficheiros e pastas
- drag-and-drop multi-item para pastas
- F2 para mudar o nome e Alt+Enter para Propriedades
- propriedades agregadas de múltiplos itens
- pesquisa com filtros type:, ext:, name: e size:
- thumbnails de imagens locais e ficheiros reais importados
- pastas virtuais também passam pela Reciclagem
- cópias de ficheiros IndexedDB duplicam o Blob em vez de partilhar a mesma referência
- montagens de pastas reais da V7.1 mantidas sem alteração de permissões

## V7.5 Desktop & Window Manager 2.0

- seis Snap Layouts
- Snap Assist para preencher espaços vazios
- Snap Groups entre janelas do mesmo layout
- arrastar janelas para margens, cantos e topo
- Alt+Tab com previews reais das janelas
- previews de janelas e Snap Groups na taskbar
- Task View com previews reais
- mover janelas entre ambientes por drag-and-drop ou menu
- renomear e fechar ambientes virtuais
- Win+Ctrl+D cria ambiente e Win+Ctrl+F4 fecha o atual
- ícones reais de C:/Desktop aparecem no ambiente de trabalho
- ícones do Desktop podem ser reposicionados e a posição fica guardada por perfil
- menu de contexto do Desktop com nova pasta, novo documento, atualizar e ordenar

## V7.6 Real Device Integration

- Centro do dispositivo real acessível pela taskbar, Quick Settings e Definições
- rede online/offline em tempo real
- Connection API quando exposta: effectiveType, downlink, RTT e Data Saver
- bateria e carregamento quando Battery Status API está disponível
- CPU lógica, memória aproximada, touch points e informação de ecrã exposta pelo browser
- uso/quota de armazenamento e armazenamento persistente
- centro de permissões para notificações, câmara, microfone, localização e clipboard
- nenhum pedido de permissão é feito automaticamente
- resumo de dispositivos media sem revelar labels antes da autorização
- matriz de capacidades reais do navegador
- estado reativo para bateria, rede, fullscreen, visibilidade e dispositivos media
- relatório JSON de diagnóstico sem coordenadas de localização, conteúdo do clipboard ou credenciais
- novo Diagnóstico V7.6 em Informações do Sistema

## V7.7 Notifications, Action Center & Background Services

- Centro de Notificações V2 com grupos por origem
- badge de notificações não lidas na taskbar
- marcar todas como lidas e limpar tudo
- adiar notificações por 15 minutos
- ações dentro das notificações
- abertura da aplicação associada ao tocar na notificação
- prioridades normal, baixa e alta
- modo Não incomodar: desligado, prioridade ou apenas alarmes
- opção temporária de Não incomodar por uma hora
- regras persistentes por origem
- Quick Settings com tile de Não incomodar
- integração com notificações reais do browser quando autorizadas
- motor de background para tarefas agendadas
- nextRun, lastRun, resultado e contador de execuções
- histórico de atividade em background
- Serviços V2 com arranque, paragem, reinício e Event Log
- Agendador de Tarefas V2 com execução manual e por intervalo
- ações internas para Windows Update, Storage Sense e manutenção automática


## V7.8 Settings, Personalization & Windows Security

- Personalização V2 com tema Claro, Escuro ou Sistema
- cor de destaque persistente por perfil
- efeitos de transparência e animações configuráveis
- alinhamento da barra de tarefas ao Centro ou à Esquerda
- oito wallpapers integrados no simulador
- Windows Security V2 com navegação por áreas
- verificações Rápida, Completa e Personalizada apenas no filesystem virtual
- item de teste inofensivo para validar deteções sem malware real
- histórico de verificações e histórico de proteção
- proteção em tempo real, cloud, tamper e ransomware representadas como controlos virtuais
- firewall virtual com perfis domínio, privado e público
- SmartScreen e PUA protection virtuais
- pontuação de saúde calculada a partir do estado do simulador
- integração das deteções e alterações críticas com o Centro de Notificações V7.7
- indicadores do browser como Secure Context, rede e IndexedDB identificados explicitamente como ambiente web

## V8.0.0 Shell Icons Fix

- substituição dos emoji do Ambiente de Trabalho por SVGs internos
- ícones distintos para Este PC, Documentos, Edge, Reciclagem e Definições
- ícones próprios para pastas, ficheiros de texto, imagens e multimédia
- preservação de drag, posições persistentes, duplo clique e menu de contexto
- botão de energia redesenhado em CSS sem depender do glifo Unicode U+23FB
- aria-label no botão de energia
- testes contra regressão para SVGs e menu de energia

## V7.9 System Tray & Quick Settings V2

- cluster unificado de rede, volume e bateria na taskbar
- ícones SVG internos e independentes de emoji/fontes
- estado online/offline real do browser
- tipo efetivo de ligação e downlink estimado quando Network Information API está disponível
- estado e percentagem reais de bateria quando Battery Status API está disponível
- Quick Settings V2 reconstruído como um único painel
- volume e brilho virtuais com sliders integrados
- Bluetooth virtual explicitamente identificado
- Luz noturna virtual com efeito visual no desktop
- integração com Não incomodar / Focus Assist
- integração com Fullscreen API e Screen Wake Lock quando suportados
- tray overflow com Segurança, Centro do dispositivo, OneDrive e atividade em background
- indicador de privacidade quando streams autorizados de câmara/microfone estão ativos
- Win+A abre Definições rápidas
- Win+N abre Notificações
- estados reais e virtuais identificados separadamente no painel

## V8.0 Windows Experience & Reliability

- lock screen em duas fases: relógio primeiro, autenticação após clique/tecla
- criação da primeira conta continua direta
- Windows Hello visual sem acesso biométrico real
- opções de início de sessão com indicação explícita do método local
- estado online/offline e bateria no lock screen quando expostos pelo browser
- atualização PWA coordenada com aviso Nova versão disponível
- Service Worker deixa de forçar skipWaiting em atualizações
- Atualizar agora ativa explicitamente a nova Service Worker
- opção Depois mantém a sessão atual intacta
- cartão Windows Update nas Definições
- recuperação do shell após BFCache/retoma de visibilidade
- refresh de tray, notificações e Device Center na recuperação

## V8.1 Start, Search & Taskbar Experience

- aplicações afixadas no Iniciar persistem por perfil local
- afixar/remover aplicações pelo menu de contexto
- reordenar pins por drag and drop
- Todas as aplicações em lista alfabética
- recomendados combinam ficheiros e aplicações recentes
- pesquisa por aplicações, definições, nomes/caminhos e conteúdo textual do VFS
- pesquisa ignora acentos para melhorar correspondências
- resultados categorizados com painel de detalhes e ações
- navegação de pesquisa por teclado
- pesquisa do Iniciar integrada sem abrir uma segunda UI desnecessariamente
- histórico local de pesquisas por perfil
- jump lists da taskbar para Explorer, Notepad e Photos
- menus da taskbar permitem afixar/remover do Iniciar e fechar a janela
- nenhuma pesquisa lê pastas reais montadas sem ação explícita
## V8.1.1 Ouvir Música Integration

- Ouvir Música substitui o atalho e a experiência especial do YouTube no Edge
- URL principal: https://www.ouvirmusica.com.br/
- carregamento em iframe Web sandboxed com permissões de media limitadas
- botão Abrir site real continua disponível como fallback
- rotas antigas `edge://youtube` são migradas automaticamente

## V8.1.2 Google Navigation Reliability

- pesquisas Google incorporadas usam `igu=1` e `newwindow=1`
- resultados Google podem abrir numa nova aba/janela através das permissões de popup já existentes
- a sandbox continua sem `allow-top-navigation` e não pode substituir o simulador
- Abrir Google completo remove o parâmetro `igu` exclusivo do modo incorporado
- Ouvir Música e restantes integrações Web permanecem inalteradas

## V8.2.0 Explorer Navigation

- vários separadores dentro da mesma janela do Explorador
- histórico de navegação independente por separador
- botão `+` para novo separador e fecho individual
- `Ctrl+T` cria separador e `Ctrl+W` fecha o separador ativo
- `Ctrl+Tab` e `Ctrl+Shift+Tab` alternam entre separadores
- `Alt+←` e `Alt+→` percorrem o histórico do separador ativo
- `Ctrl+L` ativa uma barra de endereço editável
- caminhos inválidos são rejeitados sem criar pastas virtuais por acidente
- pastas de sistema virtuais vazias continuam reconhecidas como destinos válidos
- navegação por separadores fica protegida enquanto uma pasta real montada está aberta

## V8.2.1 Explorer Tab Persistence

- sessão de separadores guardada no estado do perfil local
- restauração dos separadores e do separador ativo ao reabrir o Explorer por `This PC`
- histórico de cada separador preservado na sessão
- stack local dos últimos 20 separadores fechados
- `Ctrl+Shift+T` reabre o último separador fechado
- menu de contexto com Novo, Duplicar, Reabrir fechado, Fechar, Fechar outros e Fechar à direita
- duplicação preserva caminho e histórico do separador original
- estado persistente contém apenas caminhos virtuais; nunca guarda handles de pastas reais montadas
- corrigida a instalação do Explorer Pro quando a janela arranca em `This PC` (`.thispc-grid`)
- Explorer Pro expõe um refresh idempotente para integração segura após restauração/navegação de tabs

## V8.3.0 Explorer Tab Management

- separadores podem ser fixados/desafixados pelo menu de contexto
- tabs fixados ficam agrupados à esquerda e são restaurados com a sessão
- reordenação de tabs por drag-and-drop dentro do grupo fixado ou normal
- operações Fechar outros / Fechar à direita preservam tabs fixados
- Acesso rápido dinâmico no topo da barra lateral
- Acesso rápido começa com Ambiente de Trabalho, Documentos e Transferências
- qualquer pasta virtual válida pode ser adicionada/removida pelo menu do tab
- Acesso rápido é persistido no estado do perfil e limitado a 12 localizações
- migração automática do estado Explorer V8.2.1 para a estrutura V8.3
- estado persistente continua limitado ao filesystem virtual; mounts reais não entram no Acesso rápido

## V8.4.0 Explorer Details & This PC

- novo painel lateral de Detalhes, ativado pela barra de comandos
- seleção sincronizada com nome, tipo, localização e tamanho
- preview seguro de ficheiros de texto virtuais, limitado a 1200 caracteres
- preview de imagens virtuais `data:image/*`
- pastas mostram número de ficheiros, subpastas e tamanho agregado
- conteúdo importado/real não é lido automaticamente para preview
- em `real-mount-mode` o painel mostra apenas a proteção de privacidade e não tenta mapear o conteúdo real para o VFS
- `This PC` mantém os drives existentes e ganha uma secção Pastas com 6 localizações principais
- resumo de armazenamento virtual do perfil no `This PC`
- layout responsivo: painel lateral em desktop e overlay em ecrãs pequenos

## V8.5.0 Explorer Modern Context & Properties

- novo menu de contexto moderno específico para ficheiros e pastas virtuais do Explorer
- ações rápidas no topo: Cortar, Copiar, Mudar nome, Partilhar quando aplicável e Eliminar
- ações de item único: Abrir, Acesso rápido, Abrir com e Propriedades
- `Mostrar mais opções` abre um menu secundário clássico com Abrir com, Partilhar, Imprimir, Copiar caminho e Propriedades
- seleção múltipla mostra apenas ações em lote válidas e não expõe ações de item único
- Propriedades V8.5 para seleção única com separadores realmente funcionais `Geral` e `Detalhes`
- Geral mostra tipo, localização, tamanho, conteúdo de pasta e origem
- Detalhes mostra caminho completo, extensão, modificação quando disponível, atributos e isolamento de perfil
- Propriedades V7.4 continuam a ser usadas para seleção múltipla
- menus V8.5 não interceptam `real-mount-mode`; mounts reais mantêm o fluxo próprio

## V8.6.0 Explorer Views & Grouping

- quatro modos de vista: Ícones grandes, Ícones médios, Ícones pequenos e Detalhes
- menu `Ver` dedicado na barra de comandos
- agrupamento opcional por tipo com secções Pastas, Ficheiros e Reciclagem
- preferências de vista e agrupamento persistidas no estado do perfil
- vista Detalhes reutiliza o motor de lista já existente, mantendo seleção, propriedades e drag-and-drop
- agrupamento fica desativado em `real-mount-mode` para não reorganizar conteúdo real montado
- MutationObserver protegido contra reagir às próprias headings de agrupamento

## V8.7.0 Explorer Sidebar & Navigation

- barra lateral com estado próprio persistente por perfil
- largura ajustável entre 168 e 320 px por drag ou teclado no separador de resize
- modo compacto persistente com coluna de 64 px
- secções `Acesso rápido` e `Este PC` colapsáveis
- itens laterais normalizados em ícone + rótulo para evitar depender dos símbolos antigos do HTML
- navegação acessível por `ArrowUp`, `ArrowDown`, `Home`, `End`, `Enter` e `Space`
- sidebar continua escondida no breakpoint móvel; o audit testa o comportamento de teclado em modo desktop controlado

## V8.8.0 Explorer Adaptive Command & Selection

- barra de comandos adaptativa baseada em `ResizeObserver`
- modos compacto e tight em janelas estreitas
- menu `Mais` com Propriedades, Painel de detalhes, Ordenar, vistas, agrupamento e sidebar compacta
- botão `Selecionar` com Selecionar tudo e Desmarcar tudo
- caixas de seleção opcionais por ficheiro/pasta virtual
- estado das caixas de seleção persistido por perfil
- indicador de quantidade selecionada na command bar
- checkboxes sincronizadas com o motor de seleção múltipla existente
- seleção por checkbox e decoração suspensas em `real-mount-mode`

## V8.9.0 Explorer Columns, Sort & Grouping Pro

- ordenação por Nome, Tipo, Tamanho e Data de modificação
- direção ascendente/descendente persistente por perfil
- agrupamento por Tipo, Tamanho e Data de modificação
- grupos de tamanho: Pastas, Pequenos, Médios e Grandes
- grupos de data: Hoje, Esta semana, Este mês, Mais antigos e Sem data
- cabeçalhos de colunas clicáveis com indicador ↑/↓
- colunas Tipo, Tamanho e Data podem ser mostradas/ocultadas
- larguras de Nome, Tipo, Tamanho e Data ajustáveis e persistentes
- resize de colunas por drag no cabeçalho da vista Detalhes
- migração do agrupamento V8.6 para o motor V8.9, mantendo V8.6 em `none` para evitar dois motores sobre o mesmo DOM
- criação autónoma do header Detalhes quando a camada antiga ainda não o gerou

## V9.0.0 Explorer File Operations

- novo motor de operações que reutiliza `copyFileAdvanced` / `copyFolderAdvanced` do Explorer Pro
- operações de copiar/mover mostram cartão de progresso dentro da janela do Explorer
- Pausar, Retomar e Cancelar por operação
- apenas uma operação ativa por janela para evitar corridas sobre o VFS
- conflitos de nome oferecem Substituir, Ignorar, Manter ambos e Cancelar operação
- opção `Fazer o mesmo para os conflitos seguintes`
- cópia de um ficheiro para a própria pasta passa a poder criar `ficheiro (2)`; mover para a mesma pasta continua bloqueado
- clipboard de `cut` preserva os itens ainda não movidos quando uma operação é cancelada/ignorada
- `real-mount-mode` continua fora do motor virtual V9.0
- Acesso rápido/sidebar recebeu um readability pass: texto de 12 px, maior altura/padding, contraste reforçado e estado ativo mais visível

## V9.1.0 Explorer Filesystem Pro

- metadata persistente por perfil com `created`, `modified` e atributo `hidden`
- metadata guardada num mapa paralelo, sem alterar o formato dos conteúdos em `state.files`
- Mostrar/Ocultar itens ocultos
- Mostrar/Ocultar extensões sem alterar o nome canónico interno dos ficheiros
- ficheiros `.lnk` virtuais com resolução controlada para ficheiros e pastas virtuais
- badge visual para atalhos e mensagem segura quando o destino já não existe
- metadata acompanha copiar, mover, mudar nome e eliminação
- cópias recebem metadata coerente e movimentos preservam a metadata original
- gravações virtuais do Bloco de Notas atualizam `modified`
- Propriedades mostra Criado, Modificado, Oculto e o destino dos atalhos
- Pesquisa omite itens ocultos por defeito e resolve resultados de atalhos
- ordenação/agrupamento por data usa a metadata V9.1
- `real-mount-mode` continua excluído do motor de metadata/atalhos virtuais
- identidade canónica do ficheiro separada do texto apresentado para impedir regressões ao ocultar extensões

## V9.2.0 Search 2.0

- novo motor de pesquisa local `Win11SearchV920`, mantendo a UI existente do Start/Search
- índice local em cache: não é reconstruído a cada tecla e é invalidado por mutações do filesystem V9.1
- pesquisa passa a incluir pastas virtuais, além de aplicações, definições e ficheiros
- filtros `type:` / `tipo:` para apps, definições, ficheiros, pastas, imagens, texto, áudio, vídeo e atalhos
- filtros `ext:` / `extension:` para extensão
- filtros `size:` / `tamanho:` com operadores `>`, `>=`, `<`, `<=` e unidades B/KB/MB/GB
- filtros `modified:` / `date:` com Hoje, Semana, Mês, Ano, `Nd`, Mais antigos e datas explícitas
- filtros `in:` / `path:` para restringir a localização virtual
- filtro `hidden:` respeitando a política V9.1: itens ocultos continuam invisíveis se `Mostrar itens ocultos` estiver desligado
- ranking melhorado com prioridade a nome exato/prefixo, recência e ficheiros recentes
- aliases de aplicações mantêm compatibilidade com pesquisas como `bloco de notas`
- filtros rápidos no UI: Todos, Aplicações, Pastas, Imagens e Texto
- chips removíveis mostram os filtros ativos
- sugestões usam histórico do perfil e exemplos de filtros
- atalhos e metadata V9.1 continuam integrados no índice
- pesquisa continua 100% local: sem mounts reais, sem clipboard e sem pedidos externos

## V9.3.0 Explorer Multi-Window

- nova API `openAppNewWindow()` cria explicitamente uma nova janela sem alterar o comportamento histórico de `openApp()`
- o Explorador pode ter várias janelas reais no mesmo desktop virtual
- botão `Nova janela`, `Ctrl+N` e `Win+Shift+E`
- cada janela mantém tabs, histórico, separadores fechados e sessão independentes
- janela principal continua a espelhar `lastSession` para compatibilidade com perfis existentes
- sessões secundárias são limitadas a 16 registos persistentes para evitar crescimento indefinido do estado
- clones/previews do Window Manager são excluídos: apenas filhos reais de `#window-layer` contam como janelas Explorer
- drag-and-drop entre duas janelas Explorer usa o motor V9.0 de operações, incluindo progresso e política de conflitos
- `Ctrl` durante o drop escolhe copiar; o drop normal move
- `real-mount-mode` continua protegido e não entra nas transferências virtuais entre janelas
- Snap lado a lado funciona com duas janelas Explorer independentes
- Taskbar agrupa vários Explorers num único botão com contador e painel para focar/fechar cada janela
- jump list do Explorer ganhou `Nova janela`
- correção do Acesso rápido em dark/mobile: reset explícito do `<button>` elimina o fundo branco nativo dos itens inativos
- itens inativos do Acesso rápido ficam transparentes/escuros; o item ativo mantém fundo azul e texto branco legível
- foco por teclado do Acesso rápido ganhou contorno visível sem alterar o estado ativo

## V9.4.0 Explorer Undo/Redo & File History

- novo motor `Win11ExplorerHistory` partilhado pelas janelas Explorer do perfil ativo
- histórico persistente limitado a 50 ações, guardando apenas descritores de caminhos/nomes/tipos e nunca cópias de blobs
- botões `Desfazer`, `Refazer` e `Histórico` na command bar
- `Ctrl+Z` desfaz; `Ctrl+Y` e `Ctrl+Shift+Z` refazem
- copiar pode ser desfeito removendo apenas o destino criado e depois refeito se origem/destino continuarem válidos
- mover pode ser invertido entre origem e destino e refeito com validação de conflitos
- mudar nome usa um helper central `renameVirtual()` e suporta Undo/Redo para ficheiros e pastas
- eliminar para a Reciclagem guarda `originalName` e pode restaurar exatamente o nome original quando o destino está livre
- Redo de eliminar volta a criar a entrada correspondente na Reciclagem e atualiza o descritor do histórico
- operações V9.0 em lote geram um único registo de histórico, incluindo operações parcialmente concluídas antes de um cancelamento
- histórico e botões são sincronizados entre múltiplas janelas Explorer V9.3
- o painel de histórico mostra as 10 ações mais recentes e permite limpar o histórico
- ações de substituição destrutiva (`Substituir` num conflito) ficam marcadas como não anuláveis
- `Shift+Delete` e eliminação permanente continuam deliberadamente fora do Undo
- se origem/destino tiver sido alterado depois da operação, Undo/Redo falha de forma segura sem forçar sobrescritas

## V9.5.0 Recycle Bin Pro

- nova camada `Win11ExplorerRecycle` integrada no Explorer existente
- toolbar dedicada visível apenas em `Recycle Bin`
- ações `Restaurar`, `Restaurar tudo` e `Esvaziar`
- banner com quantidade de itens e tamanho aproximado da Reciclagem
- cada item mostra localização original e data/hora de eliminação
- metadata mantém `originalName`, `originalPath`, `deletedAt` e tipo
- restauração em lote reutiliza o motor auditado do Explorer Pro
- conflitos de restauração suportam `Manter ambos`, `Ignorar`, `Substituir` e `Fazer o mesmo para os conflitos seguintes`
- `Manter ambos` cria nome único sem sobrescrever o destino existente
- `Ignorar` preserva o item na Reciclagem
- `Substituir` move primeiro o item existente para a Reciclagem antes de restaurar, evitando perda silenciosa
- `Restaurar tudo` processa todo o conteúdo da Reciclagem com a mesma política de conflitos
- `Esvaziar Reciclagem` exige confirmação explícita e mostra número de itens/tamanho aproximado
- esvaziar e apagar permanentemente continuam deliberadamente irreversíveis
- restaurações/remoções manuais invalidam entradas V9.4 de Undo que já deixaram de ser reversíveis
- integração Multi-Window: todas as janelas Explorer atualizam depois de restaurar/esvaziar
- refresh explícito no ciclo de navegação garante toolbar/banner/metadata corretos em cliques, jump lists e navegação programática
- estados dark/mobile mantêm o mesmo padrão de legibilidade da V9.3

## V9.6.0 Previous Versions

- novo motor `Win11ExplorerVersions` persistente por perfil
- snapshots são criados antes de uma gravação que substitui conteúdo virtual existente
- Bloco de Notas captura automaticamente a versão anterior antes de `Guardar` e `Guardar como` quando o destino já existe
- conflitos V9.0 com política `Substituir` preservam automaticamente o conteúdo antigo do destino como versão anterior
- `Propriedades` de ficheiros mostra a quantidade de versões e o botão `Ver versões`
- janela `Versões anteriores` mostra data/hora, motivo e tamanho de cada snapshot
- qualquer snapshot pode ser restaurado; antes da restauração é guardada a versão atual para permitir voltar atrás através do próprio histórico de versões
- histórico acompanha o ficheiro ao mover e mudar nome
- ao enviar para a Reciclagem, a ligação de versões é destacada do caminho e guardada com o item reciclado
- ao restaurar da Reciclagem, o histórico volta a ligar-se ao novo caminho/nome, inclusive quando `Manter ambos` gera um nome diferente
- pastas movidas/renomeadas transportam as ligações de versões dos ficheiros internos
- eliminação permanente remove também o histórico de versões associado
- limite de 8 versões por ficheiro e 80 snapshots globais por perfil
- limite de 128 KB por snapshot e aproximadamente 1,5 MB de armazenamento total de versões
- snapshots duplicados e gravações sem alterações são ignorados
- `data:` URLs, conteúdos não textuais, blobs importados e ficheiros acima do limite não são duplicados no histórico
- `real-mount-mode` e File System Access handles continuam fora do sistema de versões

## V9.7.0 Taskbar & Window Management Pro

- nova camada `Win11TaskbarWindowPro` integrada na Taskbar e no Window Manager existente
- aplicações com duas ou mais janelas no mesmo ambiente virtual passam a poder ser agrupadas num único botão da Taskbar
- o Explorer mantém o agrupamento especializado V9.3 e a V9.7 generaliza o comportamento para as restantes aplicações
- badge numérico mostra a quantidade de janelas do grupo
- painel do grupo mostra previews seguros das janelas, título e estado aberta/minimizada
- ações de grupo: `Minimizar todas`, `Restaurar todas` e `Fechar todas`
- cada janela do painel pode ser focada ou fechada individualmente
- previews clonados removem IDs, desativam controlos interativos e substituem iframe/vídeo/áudio/canvas por placeholders
- operações de copiar/mover do Explorer emitem progresso para a Taskbar
- o indicador de progresso acompanha percentagem e estado de pausa e desaparece automaticamente depois da operação terminar
- quando várias janelas Explorer têm operações em curso, o botão agrupado pode refletir progresso agregado
- posição e tamanho de janelas flutuantes passam a ser persistidos por perfil, ambiente virtual, aplicação e posição ordinal da janela
- geometria restaurada é limitada ao viewport atual para evitar janelas fora do ecrã depois de mudanças de resolução
- estados `maximized` e `wm-snapped` não sobrescrevem a geometria flutuante guardada
- o armazenamento de placements é limitado às 60 entradas mais recentes por perfil
- `Win11TaskbarWindowPro.refresh()` é síncrono para ações explícitas; observers continuam agrupados por `requestAnimationFrame` para evitar churn de DOM
- Alt+Tab, Task View, Snap Assist, Snap Groups e Multi-Window V9.3 continuam preservados sem reimplementação paralela

## V9.8.1 Settings Core & System Integration Bus

- novo `Win11SystemBus` para comunicação desacoplada entre componentes do simulador
- tópicos do bus são validados por formato estrito e os payloads têm de ser serializáveis
- histórico do bus limitado aos 80 eventos mais recentes e diagnóstico limitado a 20 erros de listeners
- cada listener é isolado: uma exceção não interrompe os restantes consumidores
- eventos também são expostos como `CustomEvent("win11:<tópico>")` para integração DOM controlada
- novo `Win11SettingsStore` persistido dentro do estado do perfil ativo, sem criar uma segunda base `localStorage`
- schema V1 cobre aparência, Taskbar, Explorer, aplicações, armazenamento, acessibilidade, notificações, sistema e privacidade
- migração automática reaproveita preferências existentes de Personalization V7.8, Explorer Filesystem V9.1, acessibilidade, notificações, volume, brilho e privacidade
- tipos, enums e intervalos são validados antes de qualquer mutação
- categorias/chaves desconhecidas e `__proto__`, `prototype` e `constructor` são rejeitadas
- atualizações de categoria são atómicas: se um valor for inválido, nenhuma alteração do lote é aplicada
- cada commit válido incrementa uma revisão, atualiza timestamp/checksum e persiste uma única vez
- eventos `settings:changed`, `settings:<categoria>:changed` e `settings:committed` permitem consumidores desacoplados
- exportação/importação tem limite de 64 KB, schema explícito e verificação de integridade FNV-1a32
- APIs de reset por categoria e reset global usam o mesmo pipeline validado
- compatibilidade com estado legado é mantida para os componentes V7.x–V9.7 durante a migração gradual
- esta versão estabelece a infraestrutura; a V9.8.2 migra a UI de Personalização/Settings para consumo integral do Store e do bus

## V9.8.2 Personalization & Settings Integration

- nova camada `settings-personalization-v982.js` sobre o Settings Core V9.8.1
- a página Personalização passa a persistir exclusivamente através de `Win11SettingsStore`
- tema Claro/Escuro/Sistema, cor de destaque, transparência, animações e wallpaper são aplicados a partir do Store
- escala da interface de 90% a 160% é guardada por perfil e propagada pelo `Win11SystemBus`
- a Taskbar passa a consumir opções reais de agrupamento de janelas, badges, progresso e previews
- agrupamento pode ser `Sempre`, `Quando houver várias` ou `Nunca`
- desativar previews substitui os clones por um placeholder estático, sem executar ou clonar o conteúdo da janela
- Explorer Multi-Window V9.3 respeita a preferência de agrupamento e de badges da Taskbar
- a bridge pública `Win11Personalization` mantém compatibilidade com consumidores antigos sem permitir que a nova UI escreva diretamente no estado legado
- `Win11SettingsStore.get("categoria")` passa a devolver snapshots isolados de uma categoria
- Acessibilidade V5 encaminha escala e toggles suportados para o Settings Store
- Backup/Recovery passa a incluir um `exportConfig()` validado das definições
- restauração de snapshots novos usa `importConfig()`; snapshots antigos continuam compatíveis por migração controlada de tema/wallpaper
- se o pacote de definições de um backup estiver inválido, a restauração é cancelada antes de substituir o filesystem
- a página ativa de Settings é preservada quando eventos externos atualizam escala/personalização, evitando rerenders para a secção errada

## V9.8.3 Taskbar System Integration Pro

- nova camada `Win11TaskbarSystem` integrada no Settings Core e System Bus
- opção `Ocultar automaticamente a Barra de tarefas` passa a ter comportamento real
- auto-hide usa uma faixa de revelação segura no limite inferior e também responde a hover/focus
- overlays abertos, menus de grupos e interação com a própria Taskbar mantêm a barra visível
- opção `Mostrar ambiente de trabalho` controla um botão discreto no extremo direito da Taskbar
- o botão minimiza apenas as janelas virtuais visíveis do desktop atual
- um segundo acionamento restaura exatamente o conjunto de janelas previamente minimizado
- o estado Mostrar ambiente de trabalho é associado ao desktop virtual onde foi iniciado
- desativar o botão enquanto Mostrar ambiente de trabalho está ativo restaura automaticamente as janelas antes de ocultar o controlo
- opção `Mostrar segundos no relógio` alterna entre `HH:MM` e `HH:MM:SS`
- o relógio existente foi adaptado para consultar o Settings Store no próprio tick, evitando timers concorrentes
- o relógio do ecrã de bloqueio continua em horas/minutos, independentemente da opção da Taskbar
- as três novas opções são persistidas por perfil pelo mesmo `Win11SettingsStore`
- alterações são aplicadas em tempo real através de `settings:taskbar:changed`
- as opções V9.8.2 de alinhamento, agrupamento, badges, progresso e previews continuam integradas

## V9.8.4 Explorer Settings Integration

- nova camada `Win11ExplorerSettings` integrada no Settings Core e System Bus
- nova página `Explorador de Ficheiros` nas Definições
- `Mostrar itens ocultos` passa a persistir exclusivamente pelo `Win11SettingsStore`
- `Mostrar extensões de ficheiros` passa a usar o mesmo pipeline validado
- o menu `Ficheiros` do Explorer V9.1 mantém compatibilidade, mas as mutações são encaminhadas para o Store
- alterações de hidden/extensions propagam-se ao Explorer, pesquisa local e restantes consumidores já existentes
- `Vista compacta` reduz espaçamento da command bar, address bar, linhas e ícones sem substituir o modo de vista escolhido pelo utilizador
- Compact View é aplicado em tempo real a janelas Explorer e Reciclagem já abertas
- `Abrir Explorador em: Home / Este PC` controla novas janelas Explorer
- `Home` resolve para o primeiro destino válido do Acesso rápido; fallback seguro para `C:/Documents`
- caminhos explícitos continuam a ter prioridade sobre a preferência `openTo`
- `Confirmar eliminação` controla a confirmação antes de mover itens para a Reciclagem e antes de eliminar itens já dentro dela
- `Shift+Delete` continua sempre com confirmação permanente própria, independentemente da preferência, para preservar a proteção contra eliminação irreversível
- a confirmação acontece antes de qualquer mutação do filesystem virtual
- desativar a confirmação permite a operação normal direta, mantendo Undo/History/Recycle existentes
- a Reciclagem e o Explorer partilham agora o refresh de preferências V9.8.4
- todas as preferências continuam isoladas por perfil e sujeitas ao schema V1 do Settings Core

## V9.8.4.1 Resource Monitor Contrast Hotfix

- corrige texto claro sobre fundo claro no Monitor de Recursos
- o fundo do `resmon-body` passa a acompanhar corretamente o tema ativo
- títulos CPU, Memória, Disco, Rede e Processos ficam legíveis nos dois temas
- separador ativo deixa de usar fundo branco com texto herdado claro no tema escuro
- tabs têm estados hover/focus com contraste explícito
- tabela de processos recebe fundo, cabeçalhos, texto, bordas e hover específicos para tema claro/escuro
- cartões e barra de progresso mantêm contraste consistente
- tabs passam a aceitar scroll horizontal em ecrãs estreitos
- layout móvel reduz paddings e mantém os quatro cartões da descrição geral legíveis em duas colunas
- folha dedicada `styles/resource-monitor-v9841.css` evita regressões noutras aplicações
- service worker/cache atualizado para forçar a entrega do hotfix em dispositivos que já tinham a V9.8.4 em cache
- browser audit mede contraste computado no tema claro e escuro

## V9.8.5 Apps & Default Applications

- nova `Win11AppRegistry` com aplicações allowlisted e metadados de compatibilidade
- nova `Win11FileAssociations` para resolver e alterar handlers por extensão
- nova `Win11ProtocolRegistry` para `http` e `https`
- nova `Win11DefaultApps` como API de alto nível sobre o Settings Core
- fonte canónica permanece o `Win11SettingsStore`; não foi criada uma segunda base de configuração
- associações antigas em `state.fileAssociations` são migradas e mantidas apenas como bridge de compatibilidade
- `state.protocolAssociations` mantém compatibilidade para protocolos sem substituir o Store
- associações exatas suportadas: `.txt`, `.html/.htm`, `.png`, `.jpg/.jpeg`, `.mp3`, `.mp4`, `.pdf`
- restantes extensões conhecidas continuam a usar os defaults genéricos de texto, imagem ou media
- handlers incompatíveis são rejeitados antes de persistência
- `Abrir com...` do Explorer utiliza agora a registry V9.8.5
- a página Definições > Aplicações mostra associações por extensão/protocolo e respetivos candidatos válidos
- alterar uma associação na UI passa por validação do Settings Core e gera eventos no System Bus
- Run aceita URLs HTTP/HTTPS e encaminha para a aplicação de protocolo predefinida
- Terminal `start https://...` usa o mesmo Protocol Registry
- URLs HTTP/HTTPS abrem num novo separador Edge e preservam a sessão existente
- HTML virtual pode abrir no Edge ou Bloco de Notas
- HTML local no Edge é sanitizado antes do preview: scripts, handlers, formulários, embeds e recursos remotos não permitidos são removidos
- preview HTML usa iframe sem permissões e CSP restritiva
- PDF virtual abre no visualizador local do Edge através de Blob sandboxed quando o browser o suporta
- caminhos locais são apresentados como `file://virtual/...`; não representam acesso ao filesystem real do host
- todos os módulos alterados receberam cache-bust V9.8.5 e o service worker usa `win11-simulator-v9.8.5`

## V9.8.6 Storage 2.0

- novo motor central `Win11Storage` usado por Settings, Explorer e Storage Sense
- capacidade do perfil simulada explicitamente como 128 GB virtuais; não representa o armazenamento real do PC ou telemóvel
- snapshot único com espaço utilizado, livre, percentagem, timestamp e definições de armazenamento
- categorias: Aplicações, Documentos, Imagens, Vídeos, Música, Transferências, Ficheiros temporários, Reciclagem e Outros
- ficheiros virtuais usam o tamanho efetivo do respetivo conteúdo/referência virtual
- a categoria Aplicações é uma estimativa interna controlada da instalação do simulador
- nova página Definições > Armazenamento com resumo de capacidade, barras por categoria, contagem de ficheiros e layout responsivo claro/escuro
- a opção `storage.cleanupEnabled` continua desativada por defeito
- `storage.recycleBinEnabled` controla se a limpeza automática inclui a Reciclagem
- limpeza manual exige confirmação e mostra o espaço aproximado antes da operação
- temporários são limitados a `C:/Temp`, `C:/Windows/Temp` e `C:/AppData/Local/Temp`
- referências de conteúdo importado são limpas através de `RealContentBridge.cleanupVirtualValue()` antes de remover o ficheiro virtual
- esvaziamento da Reciclagem reutiliza o motor auditado `Win11ExplorerRecycle`
- Storage Sense V7.7 passa a chamar `Win11Storage.runStorageSense()` e respeita as preferências do Settings Store
- alterações de armazenamento geram `storage:changed` no `Win11SystemBus`
- “Este PC” e o resumo V8.4 do Explorer leem o mesmo snapshot usado pelas Definições
- corrigida regressão em novas janelas Explorer: um caminho explicitamente pedido através de `openAppNewWindow()` tem prioridade sobre a restauração de tabs
- a janela Explorer principal mantém a restauração histórica da sessão quando é reaberta
- browser audit usa um sandbox temporário de `state.files` para testar limpeza sem apagar ficheiros reais do perfil
- módulos alterados receberam cache-bust V9.8.6 e o service worker usa `win11-simulator-v9.8.6`

## V9.8.7 System Integration & Hardening

- nova API central `Win11SystemHealth`
- nova página Definições > Integridade do sistema
- diagnóstico agregado de Settings, System Bus, bridges legadas, Aplicações, Storage, Taskbar, Explorer e Personalização
- score técnico de 0 a 100 com estados Saudável, Atenção e Degradado
- o diagnóstico é read-only por defeito; não altera ficheiros nem preferências
- botão `Reconciliar` reaplica apenas APIs públicas/idempotentes já auditadas
- o Settings Core ganhou `reconcileLegacy()` para sincronizar bridges antigas a partir da fonte canónica
- a reconciliação não incrementa a revisão do Settings Store porque os valores canónicos não são alterados
- a reconciliação só chama `saveState()` quando existe realmente uma divergência legada
- novos eventos `settings:reconciled` e `system-health:reconciled`
- aliases de associações endurecidos: `.html/.htm` usam `htmlApp` e `.jpg/.jpeg` usam `jpgApp`
- `.jpeg` deixa de ser tratado como fallback genérico de imagem, evitando divergência com `jpgApp`
- reparação reaplica Personalização, Explorer Settings, Explorer Filesystem, Taskbar System, Taskbar Window Pro e invalida o índice Search V9.2
- o histórico de diagnósticos é mantido apenas em memória e limitado a 20 entradas
- exportação de diagnóstico contém apenas estado técnico agregado; não inclui IDs de conta, nomes/conteúdo de ficheiros ou handles
- o System Bus continua a isolar erros de listeners; a página de saúde mostra apenas a contagem agregada
- reconciliação automática de boot é segura e write-on-change
- Browser audit testa deteção de divergência, reparação de aliases, imutabilidade do Settings canónico, eventos e idempotência
- service worker/cache atualizado para `win11-simulator-v9.8.7`

## V9.9.0 App Lifecycle & System Shell

- nova API central `Win11Shell`
- nova API `Win11AppLifecycle` para observar ciclo de vida das janelas virtuais
- router único de intents usado por Executar, Terminal e PowerShell
- deep links `ms-settings:` encaminham diretamente para páginas reais das Definições do simulador
- rotas suportadas incluem Sistema, Armazenamento, Integridade, Bluetooth, Rede, Personalização, Aplicações, Explorador, Contas, Hora/idioma, Jogos, Acessibilidade, Privacidade e Windows Update
- `ms-settings:defaultapps` e `ms-settings:appsfeatures` abrem a página Aplicações
- `shell:ThisPC`, `shell:Downloads`, `shell:Documents`, `shell:Pictures`, `shell:Music`, `shell:Videos`, `shell:OneDrive` e `shell:RecycleBinFolder` são resolvidos por allowlist
- `shell:AppsFolder` encaminha para Aplicações nas Definições
- intents `app:<id>` só podem iniciar aplicações presentes em `APPS`
- paths virtuais `C:/...` podem abrir pastas ou ficheiros existentes no filesystem virtual
- ficheiros virtuais usam `Win11DefaultApps`/`openFile`, preservando as associações V9.8.5
- paths com `..` ou `.` são rejeitados; não existe resolução para paths do host
- URLs ficam limitados a HTTP/HTTPS e continuam a passar por `Win11ProtocolRegistry`
- `javascript:`, schemes desconhecidos e páginas `ms-settings` não allowlisted são rejeitados
- Executar aceita diretamente `ms-settings:storage`, `shell:Downloads`, `app:calc`, URLs HTTP/HTTPS e paths virtuais suportados
- Terminal `start ...` usa o mesmo router
- PowerShell `Start-Process ...` usa o mesmo router
- `Win11AppLifecycle` observa criação, ativação, minimizar, restaurar, maximizar, mudança de desktop e fecho de janelas
- eventos de lifecycle são publicados no `Win11SystemBus` como `app:launched`, `app:activated`, `app:minimized`, `app:restored`, `app:maximized`, `app:unmaximized`, `app:moved-desktop` e `app:closed`
- histórico de intents limitado a 60 entradas e histórico de lifecycle limitado a 100 entradas, ambos apenas em memória
- o histórico técnico não guarda nomes de ficheiros nem conteúdo dos ficheiros virtuais
- browser audit valida deep links, rotas shell, rejeição de traversal/schemes inseguros, associação de ficheiros, Run/Terminal/PowerShell e transições reais de lifecycle
- service worker/cache atualizado para `win11-simulator-v9.9.0`

## V9.9.1 App Sessions & Activation

- nova API `Win11AppSessions`
- políticas explícitas `single` e `multi` por aplicação
- `openApp()` mantém a semântica anterior de reutilização
- `openAppNewWindow()` passa a respeitar aplicações single-instance
- Definições, Gestor de Tarefas, Segurança, ferramentas administrativas e outras apps de sistema usam política single-instance
- Explorer, Edge, Notepad, Calculator, Terminal, PowerShell, Paint e outras apps de conteúdo continuam multi-instance
- `activate(appId)` restaura e foca corretamente a sessão existente antes de criar uma nova
- `openNew(appId)` cria nova janela apenas quando a política permite múltiplas instâncias
- `activateWindow(windowId)` restaura e foca uma sessão exata
- `closeApp(appId,{all})` permite terminar uma sessão ou todas as janelas da aplicação no desktop selecionado
- `snapshot()` e `diagnostics()` expõem estado agregado das sessões sem conteúdo das aplicações
- histórico técnico de sessões limitado a 80 entradas e mantido apenas em memória
- novos eventos `app-session:launched`, `app-session:opened-new`, `app-session:reused`, `app-session:activated-window` e `app-session:closed`
- nova secção “Sessões de aplicações V9.9.1” em Definições > Aplicações
- a secção mostra aplicação, número de janelas, política single/multi e ações Ativar/Fechar
- a UI de sessões coexistente com Aplicações predefinidas V9.8.5
- Browser audit testa single-instance real em Definições, multi-instance em Calculadora, restauro de janela minimizada, ativação exata, fecho seletivo, UI e histórico bounded
- service worker/cache atualizado para `win11-simulator-v9.9.1`

## V9.9.2 Session Restore & App Reopen

- nova API `Win11SessionRestore`
- nova opção em Definições > Contas: “Reabrir aplicações após iniciar sessão”
- a opção fica desativada por defeito
- quando ativada, o simulador guarda incrementalmente um snapshot das aplicações/janelas abertas no perfil atual
- o snapshot é reconciliado após refresh com sessão ativa, novo login/desbloqueio e reinício virtual seguido de login
- a restauração reutiliza `Win11AppSessions`, portanto respeita as políticas single-instance e multi-instance da V9.9.1
- single-instance é reconciliado sem duplicação
- multi-instance cria apenas as instâncias em falta
- desktop virtual, estado minimizado/maximizado e foco são restaurados quando aplicável
- o desktop ativo é preservado durante a reconciliação
- máximo de 24 janelas por snapshot
- máximo de 4 instâncias multi por aplicação e por desktop virtual
- snapshots com mais de 30 dias não são restaurados automaticamente
- o snapshot guarda apenas app interna, desktop, flags de janela, ordem e um hint Explorer opcional
- não são persistidos conteúdos das aplicações, texto do Notepad, URLs do Edge, nomes de ficheiros, credenciais, IDs de conta ou File System Access handles
- destinos Explorer persistíveis estão limitados a This PC, Desktop, Documents, Downloads, Pictures, Music, Videos, OneDrive e Recycle Bin
- caminhos personalizados e real mounts nunca entram no hint persistido
- novos hooks neutros `win11-session-saving` e `win11-session-start` permitem capturar antes da gravação do perfil e restaurar depois de o perfil correto ficar ativo
- ações manuais disponíveis: Guardar agora, Restaurar agora e Limpar snapshot
- eventos `session-restore:captured`, `session-restore:restored`, `session-restore:enabled` e `session-restore:cleared` passam pelo `Win11SystemBus`
- `openApp()` e o lookup da Taskbar foram reforçados para pesquisar apenas `#window-layer > .window`
- esta correção impede que clones usados nas previews da Taskbar sejam confundidos com janelas realmente abertas
- Browser audit valida captura, sanitização, allowlist Explorer, limite por app, restauração, snapshot expirado, hooks de sessão, UI em Contas e boundary das janelas reais
- service worker/cache atualizado para `win11-simulator-v9.9.2`

## V9.9.3 Window Restore Fidelity

- `Win11SessionRestore` evolui para versão 9.9.3
- snapshot interno atualizado para schema 2, mantendo compatibilidade com entradas V9.9.2 sem geometria
- cada janela pode guardar um retângulo seguro com left, top, width, height e viewport de origem
- geometria é limitada e sanitizada antes de persistir
- ao restaurar noutro viewport, posição e tamanho são proporcionalmente adaptados e novamente limitados à área útil
- largura mínima de 300 px e altura mínima de 220 px
- nenhuma janela restaurada pode ficar fora do viewport ou por baixo da área reservada à Taskbar
- janelas maximizadas guardam o retângulo flutuante anterior, permitindo regressar ao tamanho/posição corretos depois de sair de Maximizar
- janelas em Snap guardam layout e slot, além do retângulo flutuante de fallback
- Snap é reaplicado através de `Win11WindowManager.applyLayoutSlot()`; a V9.9.3 não duplica a lógica do Window Manager
- layouts/slots inválidos são descartados durante a sanitização
- no desktop ativo, a ordem visual é reconstruída através de `focusWindow()`
- a janela previamente focada é ativada por último
- proteção anti-restauro duplicado de 2200 ms impede que hooks de login/boot idênticos restaurem a mesma sessão duas vezes
- um restore duplicado publica `session-restore:skipped` com `reason: "duplicate"`
- a captura pós-restauro atualiza o fingerprint durante a janela de deduplicação
- `snapshotInfo()` passa a expor schemaVersion, geometryCount e snapCount
- Definições > Contas mostra agora quantas sessões têm geometria e quantas estão em Snap
- `Win11RealFunctions.step` atualizado para 41
- novas capabilities: `session-snapshot-schema-2`, `window-geometry-session-restore`, `viewport-aware-restore`, `snap-session-restore`, `focus-order-restore` e `duplicate-restore-guard`
- Browser audit valida captura flutuante, fallback de Snap, clamp ao viewport atual, restauração Snap, maximização/retângulo de retorno e deduplicação
- service worker/cache atualizado para `win11-simulator-v9.9.3`

## V9.9.4 Session Recovery & Crash Resume

- nova API `Win11SessionRecovery`
- novo estado de saúde por perfil: idle, running, locked e clean
- heartbeat de sessão a cada 30 segundos enquanto existe sessão autenticada e desbloqueada
- encerramentos explícitos por Terminar sessão, Reiniciar/Encerrar, mudança de conta e forced-end são classificados como clean
- Bloquear/Desbloquear é tratado como continuação da mesma sessão e não cria falso crash
- se a aplicação voltar a iniciar com o marcador anterior ainda em running, a sessão anterior é classificada como interrupted
- a deteção utiliza apenas o snapshot seguro do `Win11SessionRestore`; não existe um segundo snapshot de janelas
- `Win11SessionRestore` consulta primeiro o Recovery Manager no evento `win11-session-start`
- sessões interrompidas podem ser recuperadas automaticamente ou deixadas pendentes para decisão manual
- auto-resume fica ativo por defeito para preservar o comportamento de reabertura das versões V9.9.2/V9.9.3
- o utilizador pode desligar auto-resume em Definições > Contas
- com auto-resume desligado, a UI apresenta as ações Recuperar sessão e Descartar
- Descartar remove apenas o pedido de recovery; não apaga o snapshot V9.9.3
- recuperação manual/automática reutiliza `Win11SessionRestore.restore()`, incluindo geometria, Snap, desktops e políticas single/multi-instance
- novo evento `session-recovery:detected` quando é identificada uma interrupção
- eventos adicionais: `session-recovery:clean`, `session-recovery:completed`, `session-recovery:discarded`, `session-recovery:auto-resume`, `session-recovery:session-start` e `session-recovery:history-cleared`
- histórico técnico em memória limitado a 24 entradas
- contadores por perfil para interrupções, recoveries e pedidos descartados
- novo cartão “Recuperação de sessão” em Definições > Contas
- a UI mostra estado atual, heartbeat, contadores, auto-resume e decisão de recovery quando aplicável
- BFCache e retorno de visibilidade apenas atualizam o heartbeat; continuam a coexistir com o recovery visual V8.0
- `Win11RealFunctions.step` atualizado para 42
- novas capabilities: `session-recovery-manager`, `clean-exit-detection`, `unexpected-session-detection`, `session-heartbeat`, `crash-resume`, `manual-recovery-choice`, `auto-crash-resume`, `session-recovery-history` e `accounts-recovery-center`
- Browser audit valida heartbeat, clean exit, lock/unlock, interrupção inesperada, recovery pendente, UI, descarte, recovery manual, auto-recovery e histórico bounded
- service worker/cache atualizado para `win11-simulator-v9.9.4`

## V9.9.5 Recovery UX & Safe Mode

- nova API `Win11SafeMode`
- novo overlay de escolha quando existe recovery pendente e auto-resume está desligado
- o utilizador pode escolher Recuperar sessão, Continuar sem recuperar ou Modo de Segurança
- o overlay mostra apenas diagnóstico agregado: número de janelas recuperáveis, último heartbeat e motivo técnico da interrupção
- novo Modo de Segurança exclusivamente virtual do Windows Simulator
- conjunto de aplicações essenciais permitido: Explorer, Definições, Terminal, PowerShell, Gestor de Tarefas, Segurança, Informação do Sistema, Recuperação, Ajuda, Visualizador de Eventos e Gestor de Dispositivos
- tentativas de abrir aplicações fora da allowlist através do shell são recusadas com feedback visual
- o Modo de Segurança fecha as janelas correntes e inicia Definições > Contas como centro de recuperação
- o motor de tarefas/background virtual é pausado durante Safe Mode e retomado ao sair quando estava ativo
- novo banner persistente “Modo de Segurança” no topo do simulador
- banner permite Recuperar sessão ou Sair sem recuperar
- novo cartão “Modo de Segurança virtual” em Definições > Contas
- o cartão mostra último encerramento, heartbeat, recovery pendente, janelas recuperáveis e número de lançamentos bloqueados
- o estado Safe Mode pertence ao perfil e pode sobreviver a refresh enquanto o utilizador não sair explicitamente
- `Win11SessionRestore` evolui para versão 9.9.5 e ganha `setCaptureSuspended()`
- enquanto Safe Mode está ativo, a captura automática de sessões fica suspensa para não sobrescrever o snapshot da sessão interrompida
- a preferência original “Reabrir aplicações” não é desligada nem apagada
- ao sair do Safe Mode, a captura normal é reativada antes de qualquer recovery
- Safe Mode pode regressar à shell normal e reconstruir a sessão através do mesmo snapshot seguro V9.9.3/schema 2
- `win11-session-start` passa a verificar primeiro Safe Mode ativo, depois Session Recovery e finalmente Session Restore normal
- eventos adicionais: `safe-mode:entered`, `safe-mode:exited`, `safe-mode:resumed`, `safe-mode:launch-blocked` e `safe-mode:recovery-choice-shown`
- novos eventos do Session Restore para coordenação: `session-restore:capture-suspended`
- `Win11RealFunctions.step` atualizado para 43
- novas capabilities: `recovery-choice-ui`, `virtual-safe-mode`, `safe-mode-launch-policy`, `safe-mode-background-pause`, `safe-mode-snapshot-preservation`, `safe-mode-session-resume`, `safe-mode-diagnostics` e `safe-mode-settings-center`
- Browser audit valida overlay automático, allowlist, bloqueio de app, app essencial permitida, preservação do snapshot, UI, resume, saída e reconstrução da shell
- service worker/cache atualizado para `win11-simulator-v9.9.5`
