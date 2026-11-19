/* Busca global com ranking local, prefix search remoto e navegação acessível. */
(function (window, document) {
  'use strict';

  const PAGE_SIZE = 8;
  const DISPLAY_PAGE_SIZE = 15;
  const state = {
    timer: null,
    sequence: 0,
    term: '',
    results: [],
    visibleLimit: DISPLAY_PAGE_SIZE,
    cursors: new Map(),
    hasMore: new Map(),
    activeIndex: -1,
    loading: false,
    remoteFailed: false,
    list: null,
    status: null,
    moreButton: null
  };

  const normalize = value => String(value == null ? '' : value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const digits = value => String(value == null ? '' : value).replace(/\D/g, '');
  const textValues = values => values.filter(value => value !== undefined && value !== null && value !== '')
    .map(value => String(value));

  function getElements() {
    const input = document.getElementById('buscaGlobal');
    const container = document.getElementById('resultadosBuscaGlobal');
    if (!input || !container) return null;
    if (!state.list) {
      state.list = document.createElement('div');
      state.list.id = 'resultadosBuscaGlobalLista';
      state.list.setAttribute('role', 'listbox');
      state.list.setAttribute('aria-label', 'Resultados da busca global');
      container.replaceChildren(state.list);
      state.status = document.createElement('div');
      state.status.className = 'visually-hidden';
      state.status.setAttribute('role', 'status');
      state.status.setAttribute('aria-live', 'polite');
      state.status.setAttribute('aria-atomic', 'true');
      container.appendChild(state.status);
      state.moreButton = document.createElement('button');
      state.moreButton.type = 'button';
      state.moreButton.className = 'btn btn-sm btn-link w-100 crm-search-more';
      state.moreButton.textContent = 'Carregar mais resultados';
      state.moreButton.hidden = true;
      state.moreButton.addEventListener('click', loadMore);
      container.appendChild(state.moreButton);
      container.setAttribute('role', 'region');
      container.setAttribute('aria-label', 'Resultados da busca global');
      input.setAttribute('role', 'combobox');
      input.setAttribute('aria-autocomplete', 'list');
      input.setAttribute('aria-haspopup', 'listbox');
      input.setAttribute('aria-controls', state.list.id);
      input.setAttribute('aria-expanded', 'false');
      input.setAttribute('aria-keyshortcuts', '/');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('spellcheck', 'false');
      input.setAttribute('aria-label', 'Buscar clientes, leads, tarefas e pagamentos');
      input.addEventListener('keydown', onInputKeydown);
      state.list.addEventListener('click', event => {
        const option = event.target.closest('[role="option"][data-index]');
        if (option) selectResult(Number(option.dataset.index));
      });
      state.list.addEventListener('mousemove', event => {
        const option = event.target.closest('[role="option"][data-index]');
        if (option) setActive(Number(option.dataset.index));
      });
      document.addEventListener('click', event => {
        if (!event.target.closest('.left-actions')) close();
      });
    }
    return { input, container };
  }

  function setOpen(open) {
    const elements = getElements();
    if (!elements) return;
    elements.container.style.display = open ? 'block' : 'none';
    elements.input.setAttribute('aria-expanded', String(open));
    if (!open) {
      state.activeIndex = -1;
      elements.input.removeAttribute('aria-activedescendant');
    }
  }

  function close() {
    setOpen(false);
  }

  function localCandidates(term) {
    const collections = [
      {
        type: 'Proposta/Cliente', icon: 'bi-person-badge', color: 'primary',
        items: window.clients || [],
        title: item => item.nomeTitular || 'Cliente',
        fields: item => textValues([item.nomeTitular, item.cpfTitular, item.cnpjTitular,
          item.telefoneTitular, item.telefoneNormalizado, item.emailTitular,
          item.numeroProposta, item.codigo, item.status, item.id]),
        subtitle: item => textValues([item.numeroProposta, item.telefoneTitular,
          item.cpfTitular, item.status]).join(' · '),
        open: item => window.editarCliente?.(item.id)
      },
      {
        type: 'Lead', icon: 'bi-funnel', color: 'info',
        items: window.leadsData || [],
        title: item => item.nome || 'Lead',
        fields: item => textValues([item.nome, item.telefone, item.telefoneNormalizado,
          item.email, item.cpf_cnpj, item.id, item.status]),
        subtitle: item => textValues([item.telefone, item.email, item.status]).join(' · '),
        open: item => window.editarLead?.(item.id)
      },
      {
        type: 'Tarefa', icon: 'bi-check2-square', color: 'warning',
        items: window.tarefas || [],
        title: item => item.titulo || 'Tarefa',
        fields: item => textValues([item.titulo, item.leadNome, item.clientNome,
          item.descricao, item.id, item.data, item.status]),
        subtitle: item => textValues([item.leadNome || item.clientNome, item.data, item.status]).join(' · '),
        open: item => window.editarTarefa?.(item.id)
      }
    ];
    const candidates = [];
    const normalizedTerm = normalize(term);
    const terms = normalizedTerm.split(/\s+/).filter(Boolean);
    for (const group of collections) {
      for (const item of group.items) {
        const fields = group.fields(item);
        const normalizedFields = fields.map(normalize);
        const allText = normalizedFields.join(' ');
        if (!terms.every(part => allText.includes(part))) continue;
        const exact = normalizedFields.some(field => field === normalizedTerm);
        const starts = normalizedFields.some(field => field.startsWith(normalizedTerm));
        const tokenStarts = terms.every(part => normalizedFields.some(field => field.split(/\s+/).some(token => token.startsWith(part))));
        let score = exact ? 100 : starts ? 82 : tokenStarts ? 68 : 45;
        const phoneQuery = digits(term);
        if (phoneQuery.length >= 4 && fields.some(field => digits(field).includes(phoneQuery))) score = Math.max(score, 76);
        candidates.push({
          key: `${group.type}:${item.id}`,
          type: group.type,
          icon: group.icon,
          color: group.color,
          title: group.title(item),
          subtitle: group.subtitle(item),
          score,
          open: group.open(item)
        });
      }
    }
    (window.clients || []).forEach(client => {
      (client.pagamentos || []).forEach((payment, index) => {
        const fields = textValues([client.nomeTitular, payment.data, payment.status, payment.forma,
          payment.valor, payment.id]);
        const allText = fields.map(normalize).join(' ');
        if (!terms.every(part => allText.includes(part))) return;
        candidates.push({
          key: `Pagamento:${client.id}:${payment.id || index}`,
          type: 'Pagamento', icon: 'bi-cash-coin', color: 'success',
          title: client.nomeTitular || 'Pagamento',
          subtitle: textValues([payment.data, payment.status, payment.forma]).join(' · '),
          score: 40,
          open: () => window.editarCliente?.(client.id)
        });
      });
    });
    return candidates;
  }

  function queryFor(collection, field, term) {
    const db = window.db;
    const user = window.currentUser;
    if (!db || !user?.uid) return null;
    let query = db.collection(collection);
    if (window.userRole === 'vendedor') query = query.where('userId', '==', user.uid);
    else {
      const organizationId = window.crmOrganizationId?.() || user.uid;
      query = query.where('organizationId', '==', organizationId);
    }
    query = query.orderBy(field);
    const cursor = state.cursors.get(collection);
    if (cursor) query = query.startAfter(cursor);
    return query.startAt(term).endAt(`${term}\uf8ff`).limit(PAGE_SIZE);
  }

  function remoteSpecs() {
    return [
      { collection: 'clients', field: 'nomeTitular', type: 'Proposta/Cliente', icon: 'bi-person-badge', color: 'primary', title: data => data.nomeTitular || 'Cliente', subtitle: data => textValues([data.numeroProposta, data.telefoneTitular, data.status]).join(' · '), open: item => window.editarCliente?.(item.id) },
      { collection: 'leads', field: 'nome', type: 'Lead', icon: 'bi-funnel', color: 'info', title: data => data.nome || 'Lead', subtitle: data => textValues([data.telefone, data.email, data.status]).join(' · '), open: item => window.editarLead?.(item.id) },
      { collection: 'tarefas', field: 'titulo', type: 'Tarefa', icon: 'bi-check2-square', color: 'warning', title: data => data.titulo || 'Tarefa', subtitle: data => textValues([data.leadNome, data.data, data.status]).join(' · '), open: item => window.editarTarefa?.(item.id) }
    ];
  }

  async function loadRemotePage(term, sequence) {
    if (!window.currentUser?.uid || !window.db) return;
    state.loading = true;
    state.remoteFailed = false;
    render();
    const specs = remoteSpecs();
    const outcomes = await Promise.allSettled(specs.map(async spec => {
      const query = queryFor(spec.collection, spec.field, term);
      if (!query) return { spec, docs: [] };
      const snapshot = await query.get();
      return { spec, docs: snapshot.docs, hasMore: snapshot.size === PAGE_SIZE,
        cursor: snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null };
    }));
    if (sequence !== state.sequence) return;
    let succeeded = 0;
    outcomes.forEach(outcome => {
      if (outcome.status !== 'fulfilled') {
        state.remoteFailed = true;
        return;
      }
      succeeded++;
      const { spec, docs, hasMore, cursor } = outcome.value;
      state.hasMore.set(spec.collection, !!hasMore);
      if (cursor) state.cursors.set(spec.collection, cursor);
      docs.forEach(doc => {
        const data = doc.data();
        const fields = textValues(Object.values(data).filter(value => typeof value === 'string'));
        const queryTerms = normalize(term).split(/\s+/).filter(Boolean);
        if (!queryTerms.every(part => fields.map(normalize).join(' ').includes(part))) return;
        const normalizedTerm = normalize(term);
        const searchable = fields.map(normalize);
        const exact = searchable.some(value => value === normalizedTerm);
        const starts = searchable.some(value => value.startsWith(normalizedTerm));
        const key = `${spec.type}:${doc.id}`;
        const candidate = {
          key, type: spec.type, icon: spec.icon, color: spec.color,
          title: spec.title(data), subtitle: spec.subtitle(data),
          score: (exact ? 100 : starts ? 82 : 45) + 4,
          open: () => spec.open({ id: doc.id, ...data })
        };
        const existing = state.results.findIndex(result => result.key === key);
        if (existing < 0) state.results.push(candidate);
        else if (candidate.score > state.results[existing].score) state.results[existing] = candidate;
      });
    });
    if (!succeeded && outcomes.length) state.remoteFailed = true;
    state.loading = false;
    sortResults();
    render();
  }

  function sortResults() {
    state.results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'pt-BR'));
  }

  function hasRemoteMore() {
    return Array.from(state.hasMore.values()).some(Boolean);
  }

  function render() {
    const elements = getElements();
    if (!elements) return;
    const visible = state.results.slice(0, state.visibleLimit);
    state.list.innerHTML = visible.map((result, index) => `<div class="dropdown-item d-flex align-items-center gap-2 py-2 crm-global-search-option" role="option" tabindex="-1" id="crm-global-search-option-${index}" aria-selected="${index === state.activeIndex}" data-index="${index}"><i class="bi ${escapeHtml(result.icon)} text-${escapeHtml(result.color)}" aria-hidden="true"></i><div style="min-width:0"><div class="fw-bold small text-truncate">${escapeHtml(result.title)}</div><div class="text-muted crm-global-search-subtitle">${escapeHtml(result.type)}${result.subtitle ? ` · ${escapeHtml(result.subtitle)}` : ''}</div></div></div>`).join('');
    const moreLocal = state.results.length > visible.length;
    const moreRemote = hasRemoteMore();
    state.moreButton.hidden = !(moreLocal || moreRemote || state.loading);
    state.moreButton.disabled = state.loading;
    state.moreButton.textContent = state.loading ? 'Buscando…' : 'Carregar mais resultados';
    if (state.loading) state.status.textContent = `Buscando resultados para ${state.term}.`;
    else if (state.remoteFailed) state.status.textContent = `${visible.length} resultado(s) carregado(s). A busca remota não respondeu; confira a conexão e as regras do Firebase.`;
    else if (!state.results.length) state.status.textContent = state.term ? 'Nenhum resultado encontrado.' : '';
    else state.status.textContent = `${visible.length} de ${state.results.length} resultado(s) exibido(s)${moreRemote ? ', há mais resultados remotos' : ''}.`;
    elements.input.setAttribute('aria-expanded', String(elements.container.style.display === 'block'));
    if (state.activeIndex >= 0 && visible[state.activeIndex]) elements.input.setAttribute('aria-activedescendant', `crm-global-search-option-${state.activeIndex}`);
    else elements.input.removeAttribute('aria-activedescendant');
  }

  function setActive(index) {
    const max = Math.min(state.results.length, state.visibleLimit) - 1;
    if (index < 0 || index > max) return;
    state.activeIndex = index;
    render();
    state.list.querySelector(`#crm-global-search-option-${index}`)?.scrollIntoView({ block: 'nearest' });
  }

  function selectResult(index) {
    const result = state.results[index];
    if (!result) return;
    close();
    const elements = getElements();
    if (elements) elements.input.value = '';
    try { result.open?.(); } catch (_) { window.showToast?.('Não foi possível abrir esse registro. Atualize a página e tente novamente.', 'warning'); }
  }

  async function loadMore() {
    if (state.loading) return;
    const next = state.visibleLimit + DISPLAY_PAGE_SIZE;
    const localRemaining = state.results.length > state.visibleLimit;
    state.visibleLimit = next;
    if (!localRemaining && hasRemoteMore()) await loadRemotePage(state.term, state.sequence);
    else render();
  }

  function resetResults(term) {
    state.sequence++;
    state.term = term;
    state.results = [];
    state.visibleLimit = DISPLAY_PAGE_SIZE;
    state.cursors.clear();
    state.hasMore.clear();
    state.activeIndex = -1;
    state.remoteFailed = false;
    if (term.length < 2) {
      state.loading = false;
      render();
      close();
      return;
    }
    state.results = localCandidates(term);
    sortResults();
    setOpen(true);
    render();
    const sequence = state.sequence;
    loadRemotePage(term, sequence).catch(() => {
      if (sequence !== state.sequence) return;
      state.loading = false;
      state.remoteFailed = true;
      render();
    });
  }

  function search() {
    clearTimeout(state.timer);
    const elements = getElements();
    if (!elements) return;
    state.timer = setTimeout(() => resetResults(elements.input.value.trim()), 300);
  }

  function onInputKeydown(event) {
    const count = Math.min(state.results.length, state.visibleLimit);
    if (event.key === '/' && event.target === getElements()?.input) {
      // Slash typed inside the search field remains a literal character.
      event.stopPropagation();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (count) setActive(state.activeIndex < 0 ? 0 : Math.min(count - 1, state.activeIndex + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (count) setActive(state.activeIndex < 0 ? count - 1 : Math.max(0, state.activeIndex - 1));
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      if (count) setActive(Math.min(count - 1, Math.max(0, state.activeIndex) + 5));
    } else if (event.key === 'PageUp') {
      event.preventDefault();
      if (count) setActive(Math.max(0, state.activeIndex - 5));
    } else if (event.key === 'Home' && event.altKey) {
      event.preventDefault();
      if (count) setActive(0);
    } else if (event.key === 'End' && event.altKey) {
      event.preventDefault();
      if (count) setActive(count - 1);
    } else if (event.key === 'Enter') {
      if (state.activeIndex >= 0 || count) {
        event.preventDefault();
        selectResult(state.activeIndex >= 0 ? state.activeIndex : 0);
      }
    } else if (event.key === 'Escape') {
      close();
    } else if (event.key === 'Tab') {
      close();
    }
  }

  getElements();
  window.buscaGlobal = search;
  window.executarBuscaGlobal = selectResult;
  window.crmGlobalSearch = {
    search,
    close,
    getResults: () => state.results.map(({ key, type, title, subtitle, score }) => ({ key, type, title, subtitle, score })),
    loadMore
  };
})(window, document);
