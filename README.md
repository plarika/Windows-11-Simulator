# Windows 11 Simulator

Simulador interativo do Windows 11 executado integralmente no navegador.

## Abrir o simulador

**GitHub Pages:** https://plarika.github.io/Windows-11-Simulator/

## Versão atual

**V8.5.0 Explorer Modern Context & Properties** — o Explorador ganha menus de contexto modernos com ações rápidas, `Mostrar mais opções` e Propriedades com separadores Geral/Detalhes.

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
