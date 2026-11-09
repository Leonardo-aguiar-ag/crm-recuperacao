/* CRM Enhancements — camada incremental de evolução do CRM. */
(function (window, document) {
  'use strict';

  const state = { lastFilters: null };
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => {
    if (typeof window.formatarMoeda === 'function') return window.formatarMoeda(Number(value) || 0);
    return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };
  const valueOf = client => typeof window._getValorEfetivo === 'function' ? Number(window._getValorEfetivo(client) || 0) : Number(client?.valorComDesconto || 0);
  const today = () => new Date().toISOString().slice(0, 10);
  const monthKey = date => String(date || '').slice(0, 7);
  const selectedPeriod = () => {
    const period = document.getElementById('anPeriodo')?.value || '90';
    let start = document.getElementById('anDataInicio')?.value || '';
    let end = document.getElementById('anDataFim')?.value || '';
    if (period !== 'custom') {
      const days = parseInt(period, 10) || 90;
      const d = new Date();
      d.setDate(d.getDate() - days);
      start = d.toISOString().slice(0, 10);
      end = '';
    }
    return { period, start, end, praca: document.getElementById('anPraca')?.value || '', vendedor: document.getElementById('anVendedor')?.value || '', valid: period !== 'custom' || Boolean(start && end && start <= end) };
  };
  const getFilters = () => {
    const f = selectedPeriod();
    state.lastFilters = f;
    return f;
  };
  const clientMatches = (client, f) => {
    if (!f.valid || !client || !client.data || client.data < f.start) return false;
    if (f.end && client.data > f.end) return false;
    if (f.praca && client.praca !== f.praca) return false;
    if (f.vendedor) {
      const person = (window.pessoas || []).find(p => p.id === f.vendedor);
      if (client.vendedorId !== f.vendedor && client.codigo !== person?.codigo) return false;
    }
    return true;
  };
  const filteredClients = () => (window.clients || []).filter(c => clientMatches(c, getFilters()));
  const filteredLeads = () => {
    const f = getFilters();
    if (!f.valid) return [];
    return (window.leadsData || []).filter(l => {
      const d = String(l.abertura || l.createdAt || '').slice(0, 10);
      if (d && d < f.start) return false;
      if (f.end && d && d > f.end) return false;
      if (f.praca && l.praca !== f.praca) return false;
      if (f.vendedor && l.vendedorId !== f.vendedor && l.responsavelId !== f.vendedor) return false;
      return true;
    });
  };
  const installCard = (id, title, html, className = 'card card-custom mb-4') => {
    let card = document.getElementById(id);
    if (!card) {
      card = document.createElement('div');
      card.id = id;
      card.className = className;
      const anchor = document.querySelector('#analisesTab .card-custom:last-child') || document.getElementById('analisesTab');
      anchor?.parentNode?.insertBefore(card, anchor.nextSibling);
    }
    card.innerHTML = `<h6 class="fw-bold mb-3">${title}</h6>${html}`;
    return card;
  };

  function renderSourceDashboard() {
    const clients = filteredClients();
    const leads = filteredLeads();
    const rows = {};
    leads.forEach(l => { const k = l.fonteVenda || l.fonte || l.source || 'Não informado'; rows[k] ||= { leads: 0, propostas: 0, vendas: 0, valor: 0 }; rows[k].leads++; });
    clients.forEach(c => { const k = c.fonteVenda || c.fonte || c.source || 'Não informado'; rows[k] ||= { leads: 0, propostas: 0, vendas: 0, valor: 0 }; rows[k].propostas++; if (c.status === 'Implantado' || c.status === 'Vendido') rows[k].vendas++; rows[k].valor += valueOf(c); });
    const body = Object.entries(rows).sort((a, b) => b[1].valor - a[1].valor).map(([name, x]) => `<tr><td>${esc(name)}</td><td>${x.leads}</td><td>${x.propostas}</td><td>${x.vendas}</td><td>${x.propostas ? Math.round(x.vendas / x.propostas * 100) : 0}%</td><td>${money(x.valor)}</td></tr>`).join('') || '<tr><td colspan="6" class="text-muted">Sem dados no período.</td></tr>';
    installCard('crmOrigemDashboard', `Origem e retorno comercial <span class="small text-muted fw-normal">(${clients.length} propostas · ${leads.length} leads)</span>`, `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Origem</th><th>Leads</th><th>Propostas</th><th>Vendas</th><th>Conversão</th><th>Valor</th></tr></thead><tbody>${body}</tbody></table></div>`);
  }

  function renderSalesGoals() {
    const people = window.pessoas || [];
    const data = filteredClients();
    const by = {};
    data.forEach(c => { const key = c.vendedorId || c.codigo || '(sem vendedor)'; by[key] ||= { value: 0, sales: 0, people: 0 }; by[key].value += valueOf(c); if (c.status !== 'Desistiu') by[key].sales++; });
    const body = people.map(p => {
      const key = p.id || p.codigo; const actual = by[key] || by[p.codigo] || { value: 0, sales: 0 }; const goalValue = Number(p.metaValor || 0); const goalSales = Number(p.metaVendas || 0); const pctV = goalValue ? Math.round(actual.value / goalValue * 100) : 0; const pctS = goalSales ? Math.round(actual.sales / goalSales * 100) : 0;
      const action = window.userRole === 'admin' ? `<button class="btn btn-sm btn-outline-primary" type="button" onclick="crmEditSellerGoal('${esc(p.id)}','${esc(p.nome || p.codigo || 'Vendedor')}')">Editar</button>` : '<span class="text-muted">—</span>';
      return `<tr><td>${esc(p.nome || p.codigo || 'Vendedor')}</td><td>${actual.sales}</td><td>${goalSales}</td><td>${pctS}%</td><td>${money(actual.value)}</td><td>${money(goalValue)}</td><td>${pctV}%</td><td>${action}</td></tr>`;
    }).join('') || '<tr><td colspan="7" class="text-muted">Cadastre vendedores para acompanhar metas.</td></tr>';
    installCard('crmMetasVendedores', 'Metas por vendedor', `<p class="small text-muted">As metas configuradas no cadastro de cada vendedor são comparadas com o período selecionado. Administradores podem editar as metas diretamente aqui.</p><div class="table-responsive"><table class="table table-sm"><thead><tr><th>Vendedor</th><th>Vendas</th><th>Meta</th><th>%</th><th>Valor</th><th>Meta R$</th><th>%</th><th></th></tr></thead><tbody>${body}</tbody></table></div>`);
  }

  window.crmEditSellerGoal = async function (id, name) {
    if (window.userRole !== 'admin' || !id || !window.db) return window.showToast?.('Apenas administradores podem editar metas.', 'warning');
    const sales = prompt(`Meta de vendas para ${name}:`, String((window.pessoas || []).find(p => p.id === id)?.metaVendas || 0));
    if (sales === null) return;
    const value = prompt(`Meta em R$ para ${name}:`, String((window.pessoas || []).find(p => p.id === id)?.metaValor || 0));
    if (value === null) return;
    try { await window.db.collection('pessoas').doc(id).update({ metaVendas: Math.max(0, parseInt(sales, 10) || 0), metaValor: Math.max(0, Number(String(value).replace(',', '.')) || 0), metaAtualizadaEm: new Date().toISOString() }); const p = (window.pessoas || []).find(x => x.id === id); if (p) { p.metaVendas = parseInt(sales, 10) || 0; p.metaValor = Number(String(value).replace(',', '.')) || 0; } renderSalesGoals(); window.showToast?.('Meta atualizada.', 'success'); } catch (error) { window.showToast?.('Não foi possível atualizar a meta: ' + error.message, 'danger'); }
  };

  function renderPostSaleAndFinance() {
    const data = filteredClients();
    const todayValue = today();
    const postSale = data.filter(c => c.status === 'Implantado' && (!c.dataImplantacao || c.dataImplantacao >= state.lastFilters.start));
    const renewals = data.filter(c => c.dataVigencia && c.dataVigencia >= todayValue && c.dataVigencia <= new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10));
    let paid = 0, pending = 0, overdue = 0;
    data.forEach(c => (c.pagamentos || []).forEach(p => { const v = Number(String(p.valor || 0).replace(/\./g, '').replace(',', '.')) || 0; if (p.status === 'Pago') paid += v; else if (p.status === 'Atrasado') overdue += v; else pending += v; }));
    const tasks = (window.tarefas || []).filter(t => !t.concluida && t.data && t.data <= todayValue).length;
    const renewalRows = renewals.slice(0, 8).map(c => `<tr><td>${esc(c.nomeTitular || 'Cliente')}</td><td>${esc(c.dataVigencia)}</td><td>${money(valueOf(c))}</td><td><button class="btn btn-sm btn-outline-primary" type="button" onclick="editarCliente('${esc(c.id)}')">Abrir</button></td></tr>`).join('') || '<tr><td colspan="4" class="text-muted">Nenhuma renovação nos próximos 90 dias.</td></tr>';
    const overdueRows = data.flatMap(c => (c.pagamentos || []).filter(p => p.status === 'Atrasado').map(p => ({ c, p }))).slice(0, 8).map(({ c, p }) => `<tr><td>${esc(c.nomeTitular || 'Cliente')}</td><td>${esc(p.data || '')}</td><td>${money(Number(String(p.valor || 0).replace(/\./g, '').replace(',', '.')) || 0)}</td><td><button class="btn btn-sm btn-outline-danger" type="button" onclick="editarCliente('${esc(c.id)}')">Cobrar</button></td></tr>`).join('') || '<tr><td colspan="4" class="text-muted">Nenhum pagamento atrasado.</td></tr>';
    installCard('crmPosVendaFinanceiro', 'Pós-venda, renovação e financeiro', `<div class="row g-2 mb-3"><div class="col-md-3"><div class="border rounded p-2"><div class="small text-muted">Pós-venda</div><strong>${postSale.length}</strong></div></div><div class="col-md-3"><div class="border rounded p-2"><div class="small text-muted">Renovações em 90 dias</div><strong>${renewals.length}</strong></div></div><div class="col-md-3"><div class="border rounded p-2"><div class="small text-muted">Tarefas vencidas</div><strong class="text-danger">${tasks}</strong></div></div><div class="col-md-3"><div class="border rounded p-2"><div class="small text-muted">Recebido / pendente / atraso</div><strong>${money(paid)} / ${money(pending)} / ${money(overdue)}</strong></div></div></div><div class="row g-3"><div class="col-lg-6"><h6 class="small fw-bold">Próximas renovações</h6><div class="table-responsive"><table class="table table-sm"><thead><tr><th>Cliente</th><th>Vigência</th><th>Valor</th><th></th></tr></thead><tbody>${renewalRows}</tbody></table></div></div><div class="col-lg-6"><h6 class="small fw-bold">Cobranças atrasadas</h6><div class="table-responsive"><table class="table table-sm"><thead><tr><th>Cliente</th><th>Data</th><th>Valor</th><th></th></tr></thead><tbody>${overdueRows}</tbody></table></div></div></div>`);
  }

  function renderFilteredCommissions() {
    const table = document.querySelector('#tabelaComissoes tbody'); if (!table) return;
    const pct = Number(document.getElementById('comissaoPct')?.value || 5); const grouped = {};
    filteredClients().filter(c => c.status !== 'Desistiu').forEach(c => { const key = c.codigo || c.vendedorId || '(sem vendedor)'; grouped[key] ||= { sales: 0, lives: 0, value: 0 }; grouped[key].sales++; grouped[key].lives += Number(c.qtdVidas || 0); grouped[key].value += valueOf(c); });
    const rows = Object.entries(grouped).sort((a, b) => b[1].value - a[1].value).map(([key, x]) => `<tr><td><strong>${esc((window.pessoas || []).find(p => p.codigo === key || p.id === key)?.nome || key)}</strong></td><td>${x.sales}</td><td>${x.lives}</td><td>${money(x.value)}</td><td><strong class="text-success">${money(x.value * pct / 100)}</strong></td></tr>`).join('');
    table.innerHTML = rows || '<tr><td colspan="5" class="text-center text-muted">Nenhuma venda no período.</td></tr>';
  }

  function renderFilteredMetas() {
    const data = filteredClients(); const value = data.reduce((sum, c) => sum + valueOf(c), 0); const sales = data.filter(c => c.status !== 'Desistiu').length;
    const goalValue = Number(document.getElementById('anMetaValor')?.value || 0); const goalSales = Number(document.getElementById('anMetaVendas')?.value || 0);
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; }; const pct = (a, b) => b ? Math.min(100, Math.round(a / b * 100)) : 0;
    set('metaValorBar', ''); const barValue = document.getElementById('metaValorBar'); if (barValue) barValue.style.width = pct(value, goalValue) + '%'; set('metaValorPct', pct(value, goalValue) + '%'); set('metaValorReal', money(value)); set('metaValorMeta', money(goalValue));
    const barSales = document.getElementById('metaVendasBar'); if (barSales) barSales.style.width = pct(sales, goalSales) + '%'; set('metaVendasPct', pct(sales, goalSales) + '%'); set('metaVendasReal', sales); set('metaVendasMeta', goalSales);
  }

  function renderFilteredCashflow() {
    const ctx = document.getElementById('fluxoCaixaChart')?.getContext('2d'); if (!ctx) return;
    const f = getFilters(), end = f.end || today(), months = []; if (!f.valid) { if (window.charts?.fluxoCaixa) window.charts.fluxoCaixa.destroy(); ['fluxoTotalPago','fluxoTotalPendente','fluxoTotalAtrasado','fluxoSaldoLiquido'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = money(0); }); return; } let cursor = new Date(`${f.start.slice(0, 7)}-01T12:00:00`); const last = new Date(`${end.slice(0, 7)}-01T12:00:00`);
    while (cursor <= last && months.length < 24) { months.push({ key: cursor.toISOString().slice(0, 7), label: cursor.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) }); cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12); }
    const totals = {}; let paid = 0, pending = 0, overdue = 0;
    filteredClients().forEach(c => (c.pagamentos || []).forEach(p => { if (!p.data || p.data < f.start || p.data > end) return; const key = p.data.slice(0, 7); totals[key] ||= { paid: 0, pending: 0, overdue: 0 }; const value = Number(String(p.valor || 0).replace(/\./g, '').replace(',', '.')) || 0; if (p.status === 'Pago') { totals[key].paid += value; paid += value; } else if (p.status === 'Atrasado') { totals[key].overdue += value; overdue += value; } else { totals[key].pending += value; pending += value; } }));
    if (window.charts?.fluxoCaixa) window.charts.fluxoCaixa.destroy(); window.charts.fluxoCaixa = new Chart(ctx, { type: 'bar', data: { labels: months.map(x => x.label), datasets: [{ label: 'Recebido', data: months.map(x => totals[x.key]?.paid || 0), backgroundColor: '#00b894' }, { label: 'Pendente', data: months.map(x => totals[x.key]?.pending || 0), backgroundColor: '#fdcb6e' }, { label: 'Atrasado', data: months.map(x => totals[x.key]?.overdue || 0), backgroundColor: '#e17055' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = money(value); }; set('fluxoTotalPago', paid); set('fluxoTotalPendente', pending); set('fluxoTotalAtrasado', overdue); set('fluxoSaldoLiquido', paid - overdue);
  }

  function renderFilteredPivot() {
    const target = document.getElementById('pivotOutput'); if (!target || !window.$ || typeof $.fn.pivotUI !== 'function') return;
    const data = filteredClients().map(c => ({ Vendedor: c.vendedorId || c.codigo || 'Não Atribuído', Praça: c.praca || 'N/A', Status: c.status || 'Sem status', Produto: c.produto || 'Saúde', Origem: c.fonteVenda || 'Não informado', Valor: valueOf(c) }));
    $(target).empty().pivotUI(data, { rows: ['Vendedor'], cols: ['Status'], vals: ['Valor'], aggregatorName: 'Sum', rendererName: 'Table' }, true);
  }

  function forecastFor(client) {
    if (Number.isFinite(Number(client.probabilidadeFechamento))) return Math.max(0, Math.min(100, Number(client.probabilidadeFechamento)));
    return ({'Novo': 10, 'Em contato': 25, 'Proposta enviada': 45, 'Em análise': 60, 'Documentação pendente': 75, 'Em Cadência': 30, 'Implantado': 100, 'Vendido': 100, 'Perdido': 0, 'Desistiu': 0}[client.status] ?? 20);
  }

  function enhancePipeline() {
    if (typeof window.renderPipelinePropostas !== 'function' || window.renderPipelinePropostas.__crmEnhanced) return;
    const original = window.renderPipelinePropostas;
    const wrapped = function () {
      original.apply(this, arguments);
      const container = document.getElementById('pipelinePropostasContainer');
      if (!container) return;
      const rows = {};
      (window.clients || []).forEach(c => { const key = c.status || 'Sem status'; rows[key] ||= { count: 0, value: 0, forecast: 0 }; rows[key].count++; rows[key].value += valueOf(c); rows[key].forecast += valueOf(c) * forecastFor(c) / 100; });
      container.querySelectorAll('.pipeline-column').forEach(col => { const status = col.querySelector('h6')?.textContent?.trim(); const x = rows[status]; if (!x || col.querySelector('.crm-forecast')) return; const details = document.createElement('div'); details.className = 'crm-forecast small text-muted px-2 pb-2'; details.innerHTML = `${x.count} proposta(s) · ${money(x.value)}<br><strong>Previsão: ${money(x.forecast)}</strong>`; col.querySelector('.pipeline-column-header')?.after(details); });
      const total = Object.values(rows).reduce((a, x) => a + x.forecast, 0); let summary = document.getElementById('crmForecastSummary'); if (!summary) { summary = document.createElement('div'); summary.id = 'crmForecastSummary'; summary.className = 'alert alert-info py-2 mb-3'; container.parentNode?.insertBefore(summary, container); } summary.innerHTML = `<strong>Previsão ponderada do pipeline:</strong> ${money(total)} <span class="small">(baseada na etapa e na probabilidade individual)</span>`;
    };
    wrapped.__crmEnhanced = true;
    window.renderPipelinePropostas = wrapped;
  }

  function exportRows() { return filteredClients().map(c => ({ Proposta: c.numeroProposta || '', Cliente: c.nomeTitular || '', Status: c.status || '', Vendedor: c.codigo || c.vendedorId || '', Origem: c.fonteVenda || '', Praça: c.praca || '', Administradora: c.administradora || '', Valor: valueOf(c), Vidas: Number(c.qtdVidas || 0), Data: c.data || '' })); }
  function exportExcel() {
    const rows = exportRows();
    if (!window.XLSX) return window.showToast?.('Biblioteca Excel indisponível.', 'warning');
    const sheet = XLSX.utils.json_to_sheet(rows); const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Análises'); XLSX.writeFile(book, `crm-analises-${today()}.xlsx`); window.logAuditoria?.('EXPORT_ANALISES_XLSX', { rows: rows.length });
  }
  function exportPdf() {
    const f = getFilters(), rows = exportRows(); const win = window.open('', '_blank'); if (!win) return window.showToast?.('Permita pop-ups para gerar o relatório.', 'warning');
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório CRM</title><style>body{font:12px Arial;padding:24px;color:#222}h1{color:#6c5ce7}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#ede9fe}.meta{color:#555;margin-bottom:16px}</style></head><body><h1>Relatório Comercial</h1><div class="meta">Período: ${esc(f.start)} a ${esc(f.end || 'hoje')} · Praça: ${esc(f.praca || 'Todas')} · Vendedor: ${esc(f.vendedor || 'Todos')}</div><table><thead><tr><th>Proposta</th><th>Cliente</th><th>Status</th><th>Vendedor</th><th>Origem</th><th>Valor</th><th>Vidas</th><th>Data</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.Proposta)}</td><td>${esc(r.Cliente)}</td><td>${esc(r.Status)}</td><td>${esc(r.Vendedor)}</td><td>${esc(r.Origem)}</td><td>${money(r.Valor)}</td><td>${r.Vidas}</td><td>${esc(r.Data)}</td></tr>`).join('')}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),200)<\/script></body></html>`); win.document.close(); window.logAuditoria?.('EXPORT_ANALISES_PDF', { rows: rows.length });
  }

  function addReportActions() {
    const header = document.querySelector('#analisesTab .card-custom h6');
    if (!header || document.getElementById('crmReportActions')) return;
    const actions = document.createElement('span'); actions.id = 'crmReportActions'; actions.className = 'float-end d-flex gap-1'; actions.innerHTML = '<button class="btn btn-sm btn-outline-success" type="button" title="Exportar Excel">Excel</button><button class="btn btn-sm btn-outline-danger" type="button" title="Gerar PDF">PDF</button>'; header.parentNode.appendChild(actions); actions.children[0].onclick = exportExcel; actions.children[1].onclick = exportPdf;
  }

  function refreshEnhancements() {
    if (!document.getElementById('analisesTab')) return;
    getFilters(); addReportActions(); renderSourceDashboard(); renderSalesGoals(); renderPostSaleAndFinance();
  }

  function installWrappers() {
    enhancePipeline();
    if (typeof window.renderComissoes === 'function' && !window.renderComissoes.__crmEnhanced) { window.renderComissoes = function () { renderFilteredCommissions(); renderSourceDashboard(); renderSalesGoals(); renderPostSaleAndFinance(); }; window.renderComissoes.__crmEnhanced = true; }
    if (typeof window.renderMetas === 'function' && !window.renderMetas.__crmEnhanced) { window.renderMetas = function () { renderFilteredMetas(); renderSalesGoals(); }; window.renderMetas.__crmEnhanced = true; }
    if (typeof window.renderFluxoCaixa === 'function' && !window.renderFluxoCaixa.__crmEnhanced) { window.renderFluxoCaixa = function () { renderFilteredCashflow(); renderPostSaleAndFinance(); }; window.renderFluxoCaixa.__crmEnhanced = true; }
    if (typeof window.initPivotTable === 'function' && !window.initPivotTable.__crmEnhanced) { window.initPivotTable = function () { renderFilteredPivot(); }; window.initPivotTable.__crmEnhanced = true; }
  }

  window.crmEnhancements = { getFilters, filteredClients, filteredLeads, refresh: refreshEnhancements, exportExcel, exportPdf, forecastFor };
  const originalSwitch = window.switchTab;
  if (typeof originalSwitch === 'function' && !originalSwitch.__crmEnhanced) { window.switchTab = function (id) { const result = originalSwitch.apply(this, arguments); if (id === 'analisesTab') setTimeout(refreshEnhancements, 80); if (id === 'dashboardTab') setTimeout(renderPostSaleAndFinance, 80); return result; }; window.switchTab.__crmEnhanced = true; }
  const originalRenderAnalysis = window.renderAnalises;
  if (typeof originalRenderAnalysis === 'function' && !originalRenderAnalysis.__crmEnhanced) { window.renderAnalises = function () { const result = originalRenderAnalysis.apply(this, arguments); setTimeout(refreshEnhancements, 0); return result; }; window.renderAnalises.__crmEnhanced = true; }
  installWrappers();
})(window, document);
