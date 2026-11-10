
// === FIREBASE INIT ===
const firebaseConfig = {apiKey:"AIzaSyBif04HjzzagJFkaOQGtrsodkMEpEwPBbs",authDomain:"crm-recuperacao.firebaseapp.com",projectId:"crm-recuperacao",storageBucket:"crm-recuperacao.firebasestorage.app",messagingSenderId:"347011763386",appId:"1:347011763386:web:158c1ca6f512a1cde1c683"};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(); const db = firebase.firestore(); const storage = firebase.storage();

// Ativar Persistência Offline (mantém API compatível; warning de deprecation é inofensivo)
try {
  db.enablePersistence({synchronizeTabs: true}).catch((err) => {
    console.warn("Offline persistence error:", err.code || err.message);
  });
} catch(e) {
  console.warn("Offline persistence não disponível:", e.message);
}

let notificationTimer=null, currentUser=null, userRole='vendedor', clients=[],tarefas=[],leadsData=[],pessoas=[],dependentesTemp=[],pagamentosTemp=[],anexosTemp=[],interacoesTemp=[],statuses=[],leadStatuses=[],pracas=[],administradoras=[],acomodacoes=[],coparticipacoes=[],modalidades=[],fontesVenda=[],charts={},calendarioMesTarefa=new Date().getMonth(),calendarioAnoTarefa=new Date().getFullYear(),diaSelecionadoTarefa=new Date().toISOString().split('T')[0],selectedIds=new Set(),sortColumn='numeroProposta',sortDir='asc',paginaLead=1,leadsPorPagina=10,leadView='lista',isLoading=false,backupIntervalId=null,backupRunning=false,lastBackupTime=null,nextBackupTime=null,filtrosSalvos=[],tarefaView='lista',mapaBrasilInstance=null,notificacoesCache=[],buscaGlobalTimeout=null,paginaClientes=1,clientesPorPagina=25,paginaTarefas=1,tarefasPorPagina=20;
const AUTOSAVE_KEY='rascunhoFichaCliente';let autosaveInterval=null;
Object.defineProperties(window,{db:{configurable:true,get:()=>db},storage:{configurable:true,get:()=>storage},auth:{configurable:true,get:()=>auth},currentUser:{configurable:true,get:()=>currentUser},userRole:{configurable:true,get:()=>userRole},clients:{configurable:true,get:()=>clients},tarefas:{configurable:true,get:()=>tarefas},leadsData:{configurable:true,get:()=>leadsData},pessoas:{configurable:true,get:()=>pessoas},statuses:{configurable:true,get:()=>statuses},pracas:{configurable:true,get:()=>pracas},administradoras:{configurable:true,get:()=>administradoras},acomodacoes:{configurable:true,get:()=>acomodacoes},coparticipacoes:{configurable:true,get:()=>coparticipacoes},modalidades:{configurable:true,get:()=>modalidades},fontesVenda:{configurable:true,get:()=>fontesVenda},charts:{configurable:true,get:()=>charts},notificacoesCache:{configurable:true,get:()=>notificacoesCache}});
/* ===== HELPERS GLOBAIS ===== */
function _setText(id, val){const el=document.getElementById(id); if(el) el.innerText=val;}
function _setVal(id, val){const el=document.getElementById(id); if(el) el.value=val;}

function _stripUndefined(obj){
  if(obj===null) return null;
  if(obj===undefined) return undefined;
  const t=typeof obj;
  if(t==='function'||t==='symbol'||t==='bigint') return undefined;
  if(typeof File!=='undefined' && obj instanceof File) return undefined;
  if(typeof Blob!=='undefined' && obj instanceof Blob) return undefined;
  if(obj instanceof Date) return obj.toISOString();
  if(Array.isArray(obj)){
    const out=[];
    for(const v of obj){
      const c=_stripUndefined(v);
      if(c!==undefined) out.push(c);
    }
    return out;
  }
  if(t==='object'){
    const out={};
    for(const k of Object.keys(obj)){
      const c=_stripUndefined(obj[k]);
      if(c!==undefined) out[k]=c;
    }
    return out;
  }
  return obj;
}

function _asDate(v){if(!v)return null;if(v&&typeof v.toDate==='function')return v.toDate();const d=new Date(v);return isNaN(d.getTime())?null:d;}
function _iso(v){const d=_asDate(v);return d?d.toISOString():'';}
function _nowIso(){return new Date().toISOString();}
function _normalizarTelefone(v){const d=String(v||'').replace(/\D/g,'');if(!d)return '';const n=d.startsWith('55')?d.slice(2):d;return (n.length===10||n.length===11)?'+55'+n:'';}
function _normalizarDocumento(v){const d=String(v||'').replace(/\D/g,'');return d.length===11||d.length===14?d:'';}
function _normalizarEmail(v){return String(v||'').trim().toLowerCase();}
function _normalizarValor(v){if(typeof v==='number')return Number.isFinite(v)?Math.round(v*100)/100:0;const t=String(v||'').replace(/R\$\s?/g,'').trim();if(!t)return 0;const n=Number(t.includes(',')?t.replace(/\./g,'').replace(',','.'):t);return Number.isFinite(n)?Math.round(n*100)/100:0;}

// FUNÇÃO CENTRALIZADORA: Retorna o valor correto baseado no botão Sim/Não
function _getValorEfetivo(c) {
    if (!c) return 0;
    const temDesc = c.temDesconto !== false && c.temDesconto !== 'nao';
    if (temDesc) {
        return _normalizarValor(c.valorComDesconto || c.valorSemDesconto || 0);
    } else {
        return _normalizarValor(c.valorSemDesconto || c.valorComDesconto || 0);
    }
}

function _organizationId(){return currentUser?.organizationId||currentUser?.uid||'';}
function _serverNow(){return firebase.firestore.Timestamp.now();}
function _statusFinal(s){return ['Implantado','Vendido','Perdido','Desistiu'].includes(s);}
function _motivoObrigatorio(s){return ['Perdido','Desistiu'].includes(s);}
function _validarTransicaoLead(status,motivo){if(_motivoObrigatorio(status)&&!String(motivo||'').trim()){showToast('Informe o motivo da perda/desistência.','warning');return false;}return true;}
function showToast(msg,type='info',duration=3500){let c=document.getElementById('toastContainer');if(!c){c=document.createElement('div');c.id='toastContainer';document.body.appendChild(c);}const colors={info:'#0984e3',success:'#00b894',warning:'#f9a825',danger:'#e17055'};const icons={info:'bi-info-circle',success:'bi-check-circle',warning:'bi-exclamation-triangle',danger:'bi-x-circle'};const t=document.createElement('div');t.style.cssText=`background:${colors[type]||colors.info};color:white;padding:12px 18px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.15);font-weight:600;font-size:0.85rem;display:flex;align-items:center;gap:10px;min-width:280px;max-width:400px;animation:slideIn 0.3s ease;`;t.innerHTML=`<i class="bi ${icons[type]||icons.info}"></i><span>${msg}</span>`;c.appendChild(t);setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity 0.3s';setTimeout(()=>t.remove(),300);},duration);}
function getNotifRead(){try{return JSON.parse(localStorage.getItem('notifRead')||'[]');}catch(e){return[];}}
function saveNotifRead(a){localStorage.setItem('notifRead',JSON.stringify(a.slice(-500)));}
function isNotifRead(id){return getNotifRead().includes(id);}
function toggleNotifRead(id,ev){if(ev){ev.stopPropagation();ev.preventDefault();}const r=getNotifRead();const i=r.indexOf(id);if(i===-1)r.push(id);else r.splice(i,1);saveNotifRead(r);carregarNotificacoes();renderNotificacoesDropdown();}
function marcarTodasNotificacoesLidas(){const r=getNotifRead().concat(notificacoesCache.map(n=>n.id));saveNotifRead([...new Set(r)]);carregarNotificacoes();renderNotificacoesDropdown();showToast('Todas marcadas como lidas','success');}

function buscaGlobal(){clearTimeout(buscaGlobalTimeout);buscaGlobalTimeout=setTimeout(()=>{const termo=(document.getElementById('buscaGlobal')?.value||'').trim().toLowerCase(),c=document.getElementById('resultadosBuscaGlobal');if(!c)return;if(termo.length<2){c.style.display='none';c.innerHTML='';return;}const hit=v=>String(v||'').toLowerCase().includes(termo),rs=[];clients.forEach(x=>{if([x.nomeTitular,x.cpfTitular,x.cnpjTitular,x.telefoneTitular,x.emailTitular,x.numeroProposta,x.codigo,x.id].some(hit))rs.push({tipo:'Proposta/Cliente',i:'bi-person-badge',cor:'primary',label:x.nomeTitular||'Cliente',sub:[x.numeroProposta,x.telefoneTitular,x.cpfTitular].filter(Boolean).join(' · '),action:()=>editarCliente(x.id)});});leadsData.forEach(l=>{if([l.nome,l.telefone,l.email,l.cpf_cnpj,l.id,l.status].some(hit))rs.push({tipo:'Lead',i:'bi-funnel',cor:'info',label:l.nome||'Lead',sub:[l.telefone,l.email,l.status].filter(Boolean).join(' · '),action:()=>editarLead(l.id)});});tarefas.forEach(t=>{if([t.titulo,t.leadNome,t.descricao,t.id].some(hit))rs.push({tipo:'Tarefa',i:'bi-check2-square',cor:'warning',label:t.titulo||'Tarefa',sub:[t.leadNome,t.data].filter(Boolean).join(' · '),action:()=>editarTarefa(t.id)});});clients.forEach(x=>(x.pagamentos||[]).forEach(pg=>{if([x.nomeTitular,pg.data,pg.status,pg.forma].some(hit))rs.push({tipo:'Pagamento',i:'bi-cash-coin',cor:'success',label:x.nomeTitular||'Pagamento',sub:[pg.data,pg.status,formatarMoeda(_normalizarValor(pg.valor))].filter(Boolean).join(' · '),action:()=>editarCliente(x.id)});}));if(!rs.length){c.innerHTML='<div class="p-3 text-muted small">Nenhum resultado.</div>';c.style.display='block';return;}window._buscaGlobalResults=rs;c.innerHTML=rs.slice(0,15).map((r,i)=>`<a class="dropdown-item d-flex align-items-center gap-2 py-2" href="#" onclick="event.preventDefault();executarBuscaGlobal(${i});"><i class="bi ${r.i} text-${r.cor}" style="font-size:1.1rem"></i><div style="min-width:0"><div class="fw-bold small text-truncate">${_esc(r.label)}</div><div class="text-muted" style="font-size:.7rem">${_esc(r.tipo)}${r.sub?' · '+_esc(r.sub):''}</div></div></a>`).join('');c.style.display='block';},250);}
function executarBuscaGlobal(idx){const r=(window._buscaGlobalResults||[])[idx];if(r&&typeof r.action==='function')r.action();const c=document.getElementById('resultadosBuscaGlobal');if(c)c.style.display='none';const inp=document.getElementById('buscaGlobal');if(inp)inp.value='';}

async function logAuditoria(acao,detalhes={}){if(!currentUser)return;try{await aguardarComTimeout(db.collection('audit_events').add({userId:currentUser.uid,userEmail:currentUser.email||'',acao,detalhes,timestamp:new Date().toISOString(),userAgent:navigator.userAgent.substring(0,200)}),10000,'Auditoria não respondeu.');}catch(e){console.warn('audit:',e);}}

/* === THEME & DARK READER === */
function setTheme(t){document.body.classList.remove('dark-mode','oled');if(t==='dark')document.body.classList.add('dark-mode');if(t==='oled'){document.body.classList.add('dark-mode','oled');}else if(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches){document.body.classList.add('dark-mode');}localStorage.setItem('theme',t);atualizarBotoesTema(t);}
function atualizarBotoesTema(t){document.querySelectorAll('.tema-opcoes .btn').forEach(b=>b.classList.toggle('active',b.dataset.theme===t));}
function setFontSize(s){document.body.classList.remove('fonte-menor','fonte-padrao','fonte-maior','fonte-extra');document.body.classList.add('fonte-'+s);localStorage.setItem('fontSize',s);atualizarBotoesFonte(s);}
function atualizarBotoesFonte(s){document.querySelectorAll('.fonte-opcoes .btn').forEach(b=>b.classList.toggle('active',b.dataset.size===s));}
function aplicarFiltrosTela() {
  const b = document.getElementById('rangeBrightness').value; const c = document.getElementById('rangeContrast').value; const s = document.getElementById('rangeSepia').value; const g = document.getElementById('rangeGrayscale').value;
  document.getElementById('valBrightness').innerText = b + '%'; document.getElementById('valContrast').innerText = c + '%'; document.getElementById('valSepia').innerText = s + '%'; document.getElementById('valGrayscale').innerText = g + '%';
  document.documentElement.style.setProperty('--filter-brightness', b + '%'); document.documentElement.style.setProperty('--filter-contrast', c + '%'); document.documentElement.style.setProperty('--filter-sepia', s + '%'); document.documentElement.style.setProperty('--filter-grayscale', g + '%');
  localStorage.setItem('telaFiltros', JSON.stringify({b, c, s, g}));
}
function resetarFiltrosTela() { document.getElementById('rangeBrightness').value = 100; document.getElementById('rangeContrast').value = 100; document.getElementById('rangeSepia').value = 0; document.getElementById('rangeGrayscale').value = 0; aplicarFiltrosTela(); }
function carregarPreferencias(){setTheme(localStorage.getItem('theme')||'light');setFontSize(localStorage.getItem('fontSize')||'padrao');const savedFilters = JSON.parse(localStorage.getItem('telaFiltros') || '{}');if(savedFilters.b){document.getElementById('rangeBrightness').value = savedFilters.b;document.getElementById('rangeContrast').value = savedFilters.c;document.getElementById('rangeSepia').value = savedFilters.s;document.getElementById('rangeGrayscale').value = savedFilters.g;aplicarFiltrosTela();}}

/* === AUTH & CAPTCHA === */
let recaptchaVerifier;
auth.onAuthStateChanged(async user=>{
  if(user){
    currentUser=user;document.getElementById('loginScreen').style.display='none';
    try{
      const doc=await db.collection('usuarios').doc(user.uid).get();
      const d=doc.exists?doc.data():{};
      userRole=d.role||'vendedor';
      const nome=d.nome||user.displayName||'Usuário',email=user.email||'',foto=d.fotoURL||null,perfil=d.perfil||'Gerente';
      const membro=user.metadata.creationTime?new Date(user.metadata.creationTime).toLocaleDateString('pt-BR'):'---';
      document.getElementById('userName').innerText=nome;document.getElementById('userEmail').innerText=email;
      document.getElementById('userAvatarTexto').innerText=(nome[0]||'U').toUpperCase();
      if(foto){document.getElementById('userAvatarImg').src=foto;document.getElementById('userAvatarImg').style.display='block';document.getElementById('userAvatarTexto').style.display='none';document.getElementById('perfilAvatarImg').src=foto;document.getElementById('perfilAvatarImg').style.display='block';document.getElementById('perfilAvatarTexto').style.display='none';}
      document.getElementById('userRole').innerText=userRole.toUpperCase();document.getElementById('sistemaPermissao').innerText=userRole.toUpperCase();
      document.getElementById('perfilNome').value=nome;document.getElementById('perfilTelefone').value=d.telefone||'';document.getElementById('perfilCidade').value=d.cidade||'';document.getElementById('perfilInstagram').value=d.instagram||'';document.getElementById('perfilEmailAtual').value=email;document.getElementById('sistemaEmail').innerText=email;document.getElementById('sistemaMembro').innerText=membro;document.getElementById('sistemaServico').value=d.servico||"Amel's Conceito";

      document.getElementById('adminRBACSection').style.display = userRole === 'admin' ? 'block' : 'none';
      if(userRole === 'admin') carregarUsuariosRBAC();

    }catch(e){console.warn(e);}
    logAuditoria('LOGIN',{});loadAll();setTimeout(()=>{if('Notification' in window&&localStorage.getItem('notifOptIn')==='granted'&&Notification.permission==='granted')verificarTarefasVencidas();},5000);setTimeout(()=>{if(typeof iniciarBackupAutomatico==='function')iniciarBackupAutomatico();},3000);
  }else{if(notificationTimer){clearInterval(notificationTimer);notificationTimer=null;}pararBackupAutomatico();document.getElementById('loginScreen').style.display='flex';initCaptcha();}
});

function initCaptcha(){ if(!document.getElementById('recaptcha-container')) return; if(recaptchaVerifier) return; recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {'size': 'normal'}); }
function login(){const e=document.getElementById('loginEmail').value,p=document.getElementById('loginPassword').value;auth.signInWithEmailAndPassword(e,p).catch(x=>document.getElementById('loginError').innerText=x.message);}
function googleLogin(){const p=new firebase.auth.GoogleAuthProvider();auth.signInWithPopup(p).catch(e=>document.getElementById('loginError').innerText=e.message);}
function register(){const e=document.getElementById('loginEmail').value,p=document.getElementById('loginPassword').value;auth.createUserWithEmailAndPassword(e,p).then(async r=>{await db.collection('usuarios').doc(r.user.uid).set({nome:r.user.displayName||'Usuário',email:r.user.email,role:'vendedor',servico:"Amel's Conceito",createdAt:new Date().toISOString()});}).catch(x=>document.getElementById('loginError').innerText=x.message);}
function recoverPassword(){const e=document.getElementById('loginEmail').value;if(e)auth.sendPasswordResetEmail(e).then(()=>showToast('Email enviado!','success')).catch(x=>showToast(x.message,'danger'));else showToast('Digite seu email','warning');}
function togglePassword(){const i=document.getElementById('loginPassword');i.type=i.type==='password'?'text':'password';}
function logout(){auth.signOut();}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('collapsed');document.getElementById('mainContent').classList.toggle('expanded');}
function toggleMobileSidebar(){document.getElementById('sidebar').classList.toggle('mobile-open');}
function toggleTheme(){setTheme(document.body.classList.contains('dark-mode')?'light':'dark');}
function toggleModoApresentacao(){document.body.classList.toggle('modo-apresentacao');const ativo=document.body.classList.contains('modo-apresentacao');showToast(ativo?'Modo apresentação ATIVO (ESC para sair)':'Desativado','info',3000);localStorage.setItem('modoApresentacao',ativo?'1':'0');}

function switchTab(id){
  try {
    document.querySelectorAll('.sidebar .nav-link').forEach(e=>e.classList.remove('active'));
    document.querySelector(`.sidebar .nav-link[data-tab="${id}"]`)?.classList.add('active');
    document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('show','active'));
    const pane=document.getElementById(id);if(pane)pane.classList.add('show','active');
    document.getElementById('sidebar').classList.remove('mobile-open');
    if(id==='dashboardTab') setTimeout(()=>{try{updateDashboard()}catch(e){console.error('updateDashboard:',e)}},20);
    if(id==='leadsTab')renderLeads();
    if(id==='tarefasTab'){renderTarefasPaginadas();renderCalendarioTarefa();renderDashboardTarefas();}
    if(id==='pesquisaTab'){renderTable();renderFiltrosSalvos();}
    if(id==='clientesTab'){switchInternalTab('dadosPrincipais');carregarVendedoresSelect();setTimeout(restaurarRascunho,300);}
    if(id==='analisesTab'){switchAnalisesView();popularFiltroVendedorAnalises();setTimeout(initPivotTable,100);}
    if(id==='perfilTab'){carregarPreferencias();renderLeadStatuses();renderStatuses();renderPracasList();renderAdministradorasList();renderAcomodacoesList();renderCoparticipacoesList();renderModalidadesList();renderFontesVendaList();renderPessoasList();}
    if(id==='importarTab')irParaPassoImport(1);
  } catch (error) {
    console.error('Error switching tab:', error);
    showToast('Erro ao mudar de aba. Verifique o console.', 'danger');
  }
}
function switchInternalTab(id){document.querySelectorAll('#clientesTab .tab-pane').forEach(p=>p.style.display='none');const pane=document.getElementById(id);if(pane)pane.style.display='block';document.querySelectorAll('#fichaTabs .nav-link').forEach(b=>b.classList.remove('active'));document.querySelector(`#fichaTabs .nav-link[data-tab="${id}"]`)?.classList.add('active');if(id==='pagamentosTab')setTimeout(()=>renderPrevisaoPagamentos(),50);}

async function loadPaged(query,pageSize=500){const docs=[];let last=null;while(true){let q=query.limit(pageSize);if(last)q=q.startAfter(last);const snap=await q.get();docs.push(...snap.docs);if(snap.size<pageSize)break;last=snap.docs[snap.docs.length-1];}return docs;}
function descricaoErroFirestore(e){const c=e?.code||'unknown';if(c==='permission-denied')return 'permissão negada (publique as regras e confirme o usuário)';if(c==='failed-precondition')return 'índice/configuração pendente';if(c==='unavailable')return 'Firestore indisponível ou sem conexão';if(c==='not-found')return 'banco ou documento não encontrado';if(c==='unauthenticated')return 'sessão não autenticada';return `${c}: ${e?.message||'erro desconhecido'}`;}
async function loadAll(){
  if(isLoading)return;isLoading=true;
  try {
    let qClients=db.collection('clients'),qTarefas=db.collection('tarefas'),qLeads=db.collection('leads');
    if(userRole!=='admin'){
      qClients=qClients.where('userId','==',currentUser.uid);
      qTarefas=qTarefas.where('userId','==',currentUser.uid);
      qLeads=qLeads.where('userId','==',currentUser.uid);
    }
    const tasks=[
      ['clients',()=>loadPaged(qClients).then(docs=>clients=docs.map(d=>({id:d.id,...d.data()})))],
      ['tarefas',()=>loadPaged(qTarefas).then(docs=>tarefas=docs.map(d=>({id:d.id,...d.data()})))],
      ['statuses',loadStatuses],['pracas',loadPracas],['administradoras',loadAdministradoras],['acomodacoes',loadAcomodacoes],['coparticipacoes',loadCoparticipacoes],['modalidades',loadModalidades],['fontesVenda',loadFontesVenda],
      ['leads',()=>loadPaged(qLeads).then(docs=>leadsData=docs.map(d=>({id:d.id,...d.data()})))],
      ['leadStatuses',loadLeadStatuses],['pessoas',loadPessoas],['filtrosSalvos',loadFiltrosSalvos]
    ];
    const fails = [];
    await Promise.all(tasks.map(async ([n,fn])=>{try{await fn();}catch(e){const detalhe=`${n}: ${descricaoErroFirestore(e)}`;console.warn('Falha '+detalhe,e);fails.push(detalhe);}}));
    if (fails.length){const resumo=fails.slice(0,4).join(' · ')+(fails.length>4?` · +${fails.length-4} outra(s)`:'' );showToast(`Firestore: ${fails.length} carga(s) falharam. ${resumo}`, 'danger', 15000);}
    popularFiltroPraca();preencherSelectsFicha();popularFiltroCodigo();
    renderTable();updateDashboard();renderTarefasPaginadas();renderCalendarioTarefa();renderDashboardTarefas();renderLeads();renderFiltrosSalvos();carregarVendedoresSelect();carregarNotificacoes();if(notificationTimer)clearInterval(notificationTimer);notificationTimer=setInterval(carregarNotificacoes,60000);
    setTimeout(()=>{try{updateDashboard()}catch(e){console.warn(e)}},400);
  }catch(e){console.error('Erro pós-load:',e);}
  finally{isLoading=false;iniciarAutosave();}
}
async function loadStatuses(){if(!currentUser)return;const s=await db.collection('statuses').where('userId','==',currentUser.uid).get();statuses=s.docs.map(d=>({id:d.id,name:d.data().name||'Status'}));}
async function loadPracas(){if(!currentUser)return;const s=await db.collection('pracas').where('userId','==',currentUser.uid).get();pracas=s.docs.map(d=>({id:d.id,name:d.data().name||'Praça'}));}
async function loadAdministradoras(){if(!currentUser)return;const s=await db.collection('administradoras').where('userId','==',currentUser.uid).get();administradoras=s.docs.map(d=>({id:d.id,name:d.data().name||'Admin'}));}
async function loadAcomodacoes(){if(!currentUser)return;const s=await db.collection('acomodacoes').where('userId','==',currentUser.uid).get();acomodacoes=s.docs.map(d=>({id:d.id,name:d.data().name||'Acomodação'}));}
async function loadCoparticipacoes(){if(!currentUser)return;const s=await db.collection('coparticipacoes').where('userId','==',currentUser.uid).get();coparticipacoes=s.docs.map(d=>({id:d.id,name:d.data().name||'Coop'}));}
async function loadModalidades(){if(!currentUser)return;const s=await db.collection('modalidades').where('userId','==',currentUser.uid).get();modalidades=s.docs.map(d=>({id:d.id,name:d.data().name||'Modalidade'}));}
async function loadFontesVenda(){if(!currentUser)return;const s=await db.collection('fontesVenda').where('userId','==',currentUser.uid).get();fontesVenda=s.docs.map(d=>({id:d.id,name:d.data().name||'Fonte'}));}
async function loadLeadStatuses(){if(!currentUser)return;const s=await db.collection('leadStatuses').where('userId','==',currentUser.uid).get();leadStatuses=s.docs.map(d=>({id:d.id,name:d.data().name||'Status'}));}
async function loadPessoas(){if(!currentUser)return;const s=await db.collection('pessoas').where('userId','==',currentUser.uid).get();pessoas=s.docs.map(d=>({id:d.id,...d.data()}));}
async function loadFiltrosSalvos(){if(!currentUser)return;const s=await db.collection('filtrosSalvos').where('userId','==',currentUser.uid).get();filtrosSalvos=s.docs.map(d=>({id:d.id,...d.data()}));}
