// migrar-trello-github.mjs
import { execSync } from "node:child_process";

const REPO = "IgorMH1/churrasco-da-hora";
// Se já tiver criado um Project no GitHub, informe o número dele abaixo (ex: 1).
// Deixe null caso queira apenas criar as Issues com as colunas via Labels primeiro.
const PROJECT_NUMBER = null;
const PROJECT_OWNER = "IgorMH1";

const LIST_LABELS = [
  { name: "Quadro: Funcionalidades", color: "1D76DB", desc: "Lista Funcionaildades do Trello" },
  { name: "Quadro: Area de Login", color: "5319E7", desc: "Lista Aréa de login do Trello" },
  { name: "Quadro: Dashboard ADM", color: "0E8A16", desc: "Lista Dashboar - ADM do Trello" },
  { name: "Quadro: Gestao de Eventos ADM", color: "006B75", desc: "Lista Gestão de Eventos - ADM do Trello" },
  { name: "Quadro: Cadastros ADM", color: "FBCA04", desc: "Lista Cadastros - ADM do Trello" },
  { name: "Quadro: Backup", color: "D93F0B", desc: "Lista BAackup do Trello" },
  { name: "Quadro: Dashboard Cliente", color: "0052CC", desc: "Lista Dashboard - Cliente do Trello" },
  { name: "Quadro: Minha Conta Cliente", color: "C2E0C6", desc: "Lista Minha conta - Cliente do Trello" },
  { name: "Status: Resolvido", color: "2EA44F", desc: "Lista Resolvidos do Trello" },
];

const TRELLO_CARDS = [
  // Resolvidos (1 a 36)
  { id: 1, title: "Mudar seleção das opções: Login, esqueci minha senha e Agende seu evento", list: "Quadro: Area de Login", resolved: true, url: "https://trello.com/c/CJAf9WZt" },
  { id: 2, title: "Retirar: botão de preencher automatico; o texto", list: "Quadro: Area de Login", resolved: true, url: "https://trello.com/c/9gYHR3Kv" },
  { id: 3, title: "Retirar: 17/11/2026 às 14:19:22 (GMT-3)", list: "Quadro: Dashboard Cliente", resolved: true, url: "https://trello.com/c/YOVUO6YJ" },
  { id: 4, title: "CORRIGIR LOGIN: Ele não cria um usuario novo, apenas redireciona a um ja existente no banco de dados", list: "Quadro: Funcionalidades", resolved: true, url: "https://trello.com/c/kKrmkptz" },
  { id: 5, title: "Cards Interativos (Dashboard ADM)", list: "Quadro: Dashboard ADM", resolved: true, url: "https://trello.com/c/Cp1Xcw9H" },
  { id: 6, title: "Cards Interativos (Dashboard Cliente)", list: "Quadro: Dashboard Cliente", resolved: true, url: "https://trello.com/c/GdROVn8P" },
  { id: 7, title: "Editar Escala - Mais detalhes", list: "Quadro: Dashboard ADM", resolved: true, url: "https://trello.com/c/sTxHjmF5" },
  { id: 8, title: "Retirar KPI expecificada", list: "Quadro: Dashboard ADM", resolved: true, url: "https://trello.com/c/BGmJT17Y" },
  { id: 9, title: "alterar (Agenda de hoje) para (Agenda da semana)", list: "Quadro: Dashboard ADM", resolved: true, url: "https://trello.com/c/agXaLmBW" },
  { id: 10, title: "Retirar opções especificadas - GMT-3; Ver area do cliente; Resetar dados.", list: "Quadro: Dashboard ADM", resolved: true, url: "https://trello.com/c/2nNWIUTz" },
  { id: 11, title: "Alterar aba principal para o design fixado", list: "Quadro: Gestao de Eventos ADM", resolved: true, url: "https://trello.com/c/LJhm7X27" },
  { id: 12, title: "Possibilidade de Edição de dados dos eventos", list: "Quadro: Gestao de Eventos ADM", resolved: true, url: "https://trello.com/c/CM3gzxJ8" },
  { id: 13, title: "Novo agendamento - retira Categorias, deixar lebel de texto", list: "Quadro: Gestao de Eventos ADM", resolved: true, url: "https://trello.com/c/3ZIu7BfF" },
  { id: 14, title: "aumentar a função de Adicionar uma pessoa para cobrir de uma ponta a outra", list: "Quadro: Cadastros ADM", resolved: true, url: "https://trello.com/c/SvKJwdrj" },
  { id: 15, title: "Colocar o filtro e visualização de perfis, abaixo da tela de Adicionar pessoa", list: "Quadro: Cadastros ADM", resolved: true, url: "https://trello.com/c/aKXAb7SQ" },
  { id: 16, title: "Modelo de exemplo (Cadastros ADM)", list: "Quadro: Cadastros ADM", resolved: true, url: "https://trello.com/c/fZpe0EFp" },
  { id: 17, title: "adicioanar status, edição de informações, id, ultima atualização de senha", list: "Quadro: Cadastros ADM", resolved: true, url: "https://trello.com/c/yy1l8APa" },
  { id: 18, title: "Add opção de exluir o ultimo backup e resetar sistema", list: "Quadro: Backup", resolved: true, url: "https://trello.com/c/wkTxfWqJ" },
  { id: 19, title: "Conectar - Google Calendar", list: "Quadro: Funcionalidades", resolved: true, url: "https://trello.com/c/cv7pDnoj" },
  { id: 20, title: "Configurar - Envio de Email de recuperação", list: "Quadro: Funcionalidades", resolved: true, url: "https://trello.com/c/jRblEpH4" },
  { id: 21, title: "Ao adicionar um evento como ADM, ele adicionar na agenda automaticamente.", list: "Quadro: Funcionalidades", resolved: true, url: "https://trello.com/c/RBYZdOc4" },
  { id: 22, title: "Ao confirmar um evento, ele coloca na agenda automaticamente", list: "Quadro: Funcionalidades", resolved: true, url: "https://trello.com/c/4mUCHtsA" },
  { id: 23, title: "Agenda Cobrir area toda", list: "Quadro: Gestao de Eventos ADM", resolved: true, url: "https://trello.com/c/qUCfAnsC" },
  { id: 24, title: "Esconder Novo agendamento rapido, trazer ao clicar botão na parte de cima", list: "Quadro: Gestao de Eventos ADM", resolved: true, url: "https://trello.com/c/qPdtRziB" },
  { id: 25, title: "Trocar quem é o evento para Quantidade de pessoas", list: "Quadro: Gestao de Eventos ADM", resolved: true, url: "https://trello.com/c/RBQwgxa1" },
  { id: 26, title: "Deve ser possivel aprovar os eventos na area de gestão também", list: "Quadro: Gestao de Eventos ADM", resolved: true, url: "https://trello.com/c/8FCw2iRm" },
  { id: 27, title: "Mostrar quantidade de eventos de acordo com o Status", list: "Quadro: Gestao de Eventos ADM", resolved: true, url: "https://trello.com/c/TOCWEiUV" },
  { id: 28, title: "Mudar todas os dashboards para mes e não semana", list: "Quadro: Gestao de Eventos ADM", resolved: true, url: "https://trello.com/c/HMP3m9px" },
  { id: 29, title: "Esse botão deve estar a esquerda, separado do login", list: "Quadro: Area de Login", resolved: true, url: "https://trello.com/c/Fk586Fgv" },
  { id: 30, title: "Mudar questões de cores: Confirmado - Verde; Cancelado - Vermelho; Pendente - Laranja (Gestão ADM)", list: "Quadro: Gestao de Eventos ADM", resolved: true, url: "https://trello.com/c/IW6nKG0m" },
  { id: 31, title: "Mudar questões de cores: Confirmado - Verde; Cancelado - Vermelho; Pendente - Laranja (Cliente)", list: "Quadro: Dashboard Cliente", resolved: true, url: "https://trello.com/c/LAG7HV8P" },
  { id: 32, title: "Mudar questões de cores: Confirmado - Verde; Cancelado - Vermelho; Pendente - Laranja (Dashboard ADM)", list: "Quadro: Dashboard ADM", resolved: true, url: "https://trello.com/c/UY9rMNQr" },
  { id: 33, title: "a equipe interna deve ter acesso a tudo, menos o backup", list: "Quadro: Funcionalidades", resolved: true, url: "https://trello.com/c/pS7vwQKT" },
  { id: 34, title: "Precisa ser possivel acessar todos os meses do ano", list: "Quadro: Gestao de Eventos ADM", resolved: true, url: "https://trello.com/c/kIKMBvyg" },
  { id: 35, title: "Mostrar a confirmação da equipe interna/externa", list: "Quadro: Gestao de Eventos ADM", resolved: true, url: "https://trello.com/c/f9knFo5F" },
  { id: 36, title: "A equipe externa e interna devem ter apenas visão do local (sem editar cadastros/eventos) e editar a própria conta", list: "Quadro: Funcionalidades", resolved: true, url: "https://trello.com/c/7ozHVqHI" },

  // Abertos no Trello / Sprint 3 (37 a 50)
  { id: 37, title: "KPI - Abrir lista não ir para a pagina", list: "Quadro: Dashboard ADM", resolved: false, url: "https://trello.com/c/foknX6Yn" },
  { id: 38, title: "Retirar opção de confirmar equipe por Sessão de ADM", list: "Quadro: Dashboard ADM", resolved: false, url: "https://trello.com/c/WYLvXHk2" },
  { id: 39, title: "Email de confirmação de evento para o Cliente", list: "Quadro: Funcionalidades", resolved: false, url: "https://trello.com/c/tIapLvLn" },
  { id: 40, title: "Tirar CPF/CNPJ", list: "Quadro: Minha Conta Cliente", resolved: false, url: "https://trello.com/c/7hC7ncvD" },
  { id: 41, title: "Tela de parametros de regra para os usuarios. EX: valor de diaria(diurna, vespertina,noturna), tipo de função, hibrido, periodo, etc", list: "Quadro: Funcionalidades", resolved: false, url: "https://trello.com/c/3Bt1opby" },
  { id: 42, title: "Ao logar pela primeira vez, obrigar trocar a senha(para todos os perfis)", list: "Quadro: Funcionalidades", resolved: false, url: "https://trello.com/c/0Wh4hWXW" },
  { id: 43, title: "Melhorar Status de funcionamento das APIS (exemplo fixado)", list: "Quadro: Funcionalidades", resolved: false, url: "https://trello.com/c/iSeHZ2rG" },
  { id: 44, title: "Restore do ultimo backup", list: "Quadro: Funcionalidades", resolved: false, url: "https://trello.com/c/vKzoKaGy" },
  { id: 45, title: "Botão de Emergencia/Manutenção(Bloqueia todos os usuarios ativos no momento menos o ADM) + Botão de desbloqueio", list: "Quadro: Funcionalidades", resolved: false, url: "https://trello.com/c/if3RbqXq" },
  { id: 46, title: "add status de bloqueio ao usuario de email após as tentativas de erro", list: "Quadro: Funcionalidades", resolved: false, url: "https://trello.com/c/3KzM5o02" },
  { id: 47, title: "Sistema de Identidade Corporativa", list: "Quadro: Funcionalidades", resolved: false, url: "https://trello.com/c/xo1jxaSz" },
  { id: 48, title: "Mudar envio de gmail para funcionar via netfly", list: "Quadro: Funcionalidades", resolved: false, url: "https://trello.com/c/G2rEevcx" },
  { id: 49, title: "Restrição de pagina por perfil (bloquear acesso direto via URL sem login)", list: "Quadro: Funcionalidades", resolved: false, url: "https://trello.com/c/vx73DwQ9" },
  { id: 50, title: "Restruturar Site por conteiner", list: "Quadro: Funcionalidades", resolved: false, url: "https://trello.com/c/0HQo15F2" },
];

function run(cmd) {
  return execSync(cmd, { stdio: "pipe", encoding: "utf-8" }).trim();
}

console.log("1. Criando Labels equivalentes às listas do Trello...");
for (const lbl of LIST_LABELS) {
  try {
    run(
      `gh label create "${lbl.name}" --repo ${REPO} --color "${lbl.color}" --description "${lbl.desc}" --force`
    );
    console.log(`  ✓ Label criada: ${lbl.name}`);
  } catch (err) {
    console.error(`  ! Erro na label ${lbl.name}:`, err.message);
  }
}

console.log("\n2. Criando os 50 cartões do Trello como Issues no GitHub...");
for (const card of TRELLO_CARDS) {
  const fullTitle = `[Trello #${card.id}] ${card.title}`;
  const labels = card.resolved ? `${card.list},Status: Resolvido` : card.list;
  const body = `Importado do quadro Trello **Churrasco dos da Hora**.\n- **Cartão original:** ${card.url}\n- **Quadro/Lista de origem:** ${card.list}\n- **Status no Trello:** ${card.resolved ? "Resolvido" : "Em aberto (Sprint 3)"}`;

  try {
    const issueUrl = run(
      `gh issue create --repo ${REPO} --title ${JSON.stringify(fullTitle)} --body ${JSON.stringify(body)} --label ${JSON.stringify(labels)}`
    );
    console.log(`  ✓ Criado: ${fullTitle} -> ${issueUrl}`);

    if (PROJECT_NUMBER) {
      run(`gh project item-add ${PROJECT_NUMBER} --owner ${PROJECT_OWNER} --url ${issueUrl}`);
    }

    if (card.resolved) {
      run(`gh issue close ${issueUrl} --repo ${REPO} --reason "completed"`);
    }
  } catch (err) {
    console.error(`  ! Falha no cartão #${card.id}:`, err.message);
  }
}

console.log("\n✓ Migração Trello -> GitHub concluída com sucesso!");