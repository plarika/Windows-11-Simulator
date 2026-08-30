# Windows 11 Simulator

Simulador interativo do Windows 11 executado integralmente no navegador.

## Abrir o simulador

**GitHub Pages:** https://plarika.github.io/Windows-11-Simulator/

## Versão atual

**V7.6 Real Device Integration** — Centro do dispositivo real, estado em tempo real, permissões, armazenamento e diagnóstico exportável.

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
- página YouTube própria dentro do Edge
- URLs youtube.com/watch, youtu.be, shorts, live e embed são convertidas para o player oficial
- playlists YouTube usam o player oficial videoseries
- pesquisa YouTube oferece abertura dos resultados no site real
- atalhos Google, YouTube, Wikipedia e GitHub no novo separador
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
- Google e YouTube V7.2 mantidos

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
