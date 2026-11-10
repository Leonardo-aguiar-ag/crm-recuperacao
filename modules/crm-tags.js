/* Etiquetas, validação real de Storage e filtros adicionais do CRM. */
(function (window, document) {
  'use strict';

  const state = { tags: [], loadedFor: null, loading: null };
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const colors = ['#6c5ce7', '#0984e3', '#00b894', '#fdcb6e', '#e17055', '#a29bfe', '#fd79a8', '#636e72'];
  const uid = () => window.currentUser?.uid || null;

  function normalizeTag(tag) {
    if (typeof tag === 'string') return { name: tag.trim(), color: colors[0] };
    return { name: String(tag?.name || '').trim(), color: tag?.color || colors[0] };
  }
  function currentNames(client) {
    return (client?.etiquetas || client?.tags || []).map(normalizeTag).map(x => x.name).filter(Boolean);
  }
  async function loadTags() {
    if (!uid() || !window.db) return [];
    if (state.loadedFor === uid()) { renderPicker(); renderSettings(); populateFilter(); window.renderTable?.(); return state.tags; }
    if (state.loading) return state.loading;
    state.loading = window.db.collection('configuracoes').doc(uid() + '_etiquetas').get().then(snap => {
      const data = snap.exists ? snap.data() : {};
      state.tags = Array.isArray(data.etiquetas) ? data.etiquetas.map(normalizeTag).filter(x => x.name).slice(0, 80) : [];
      state.loadedFor = uid();
      state.loading = null;
      renderPicker(); renderSettings(); populateFilter(); window.renderTable?.();
      return state.tags;
    }).catch(error => { state.loading = null; window.showToast?.('Não foi possível carregar as etiquetas: ' + (error.message || error), 'danger', 6000); return []; });
    return state.loading;
  }
  async function saveTags() {
    if (!uid() || !window.db) throw new Error('Sessão não disponível.');
    await window.db.collection('configuracoes').doc(uid() + '_etiquetas').set({ etiquetas: state.tags, userId: uid(), updatedAt: new Date().toISOString() }, { merge: true });
  }
  function renderPicker(client) {
    const box = document.getElementById('clienteEtiquetasPicker');
    if (!box) return;
    const selected = new Set(currentNames(client || window.__crmEditingClient));
    if (!state.tags.length) { box.innerHTML = '<span class="text-muted small">Configure etiquetas na aba Meu Perfil.</span>'; return; }
    box.innerHTML = state.tags.map(tag => `<label class="crm-tag-option" style="--tag-color:${esc(tag.color)}"><input type="checkbox" value="${esc(tag.name)}" ${selected.has(tag.name) ? 'checked' : ''}><span>${esc(tag.name)}</span></label>`).join('');
  }
  function selectedTags() {
    return [...document.querySelectorAll('#clienteEtiquetasPicker input:checked')].map(input => {
      const tag = state.tags.find(x => x.name === input.value);
      return { name: input.value, color: tag?.color || colors[0] };
    });
  }
  function badges(client) {
    const tags = currentNames(client).map(name => state.tags.find(x => x.name === name) || { name, color: colors[0] });
    return tags.length ? tags.map(tag => `<span class="crm-tag-badge" style="--tag-color:${esc(tag.color)}">${esc(tag.name)}</span>`).join('') : '<span class="text-muted small">—</span>';
  }
  function renderSettings() {
    const box = document.getElementById('crmEtiquetasList');
    if (!box) return;
    box.innerHTML = state.tags.length ? state.tags.map((tag, index) => `<div class="status-item"><span><span class="crm-tag-badge" style="--tag-color:${esc(tag.color)}">${esc(tag.name)}</span></span><button class="btn btn-danger btn-sm" onclick="crmRemoveTag(${index})"><i class="bi bi-trash"></i></button></div>`).join('') : '<p class="text-muted small">Nenhuma etiqueta configurada.</p>';
  }
  function populateFilter() {
    const select = document.getElementById('filterEtiqueta');
    if (!select) return;
    const value = select.value;
    select.innerHTML = '<option value="ALL">Todas</option>' + state.tags.map(tag => `<option value="${esc(tag.name)}">${esc(tag.name)}</option>`).join('');
    select.value = state.tags.some(x => x.name === value) ? value : 'ALL';
  }
  async function addTag() {
    const input = document.getElementById('novaEtiqueta');
    const color = document.getElementById('novaEtiquetaCor')?.value || colors[state.tags.length % colors.length];
    const name = input?.value.trim();
    if (!name) return window.showToast?.('Informe o nome da etiqueta.', 'warning');
    if (state.tags.some(x => x.name.toLowerCase() === name.toLowerCase())) return window.showToast?.('Essa etiqueta já existe.', 'warning');
    state.tags.push({ name, color });
    try { await saveTags(); if (input) input.value = ''; renderPicker(); renderSettings(); populateFilter(); window.showToast?.('Etiqueta criada.', 'success'); }
    catch (error) { state.tags.pop(); window.showToast?.('Não foi possível salvar a etiqueta: ' + (error.message || error), 'danger', 6000); }
  }
  window.crmRemoveTag = async function (index) {
    const removed = state.tags[index]; if (!removed || !confirm(`Excluir a etiqueta "${removed.name}"? Ela será removida das configurações, mas não apaga históricos.`)) return;
    state.tags.splice(index, 1);
    try { await saveTags(); renderPicker(); renderSettings(); populateFilter(); window.showToast?.('Etiqueta excluída.', 'success'); }
    catch (error) { state.tags.splice(index, 0, removed); window.showToast?.('Não foi possível excluir: ' + (error.message || error), 'danger', 6000); }
  };
  window.crmAddTag = addTag;
  window.crmGetSelectedTags = selectedTags;
  window.crmRenderTagPicker = client => { window.__crmEditingClient = client || null; loadTags().then(() => renderPicker(client)); };
  window.crmGetTagBadges = badges;
  window.crmMatchesTag = (client, value) => value === 'ALL' || currentNames(client).includes(value);

  window.crmTestStorageUpload = async function () {
    if (!uid() || !window.storage) return window.showToast?.('Faça login para testar o Storage.', 'warning');
    const btn = document.getElementById('btnTestarStorage');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loading-spinner"></span> Testando...'; }
    try {
      const ref = window.storage.ref(`usuarios/${uid()}/testes/storage-check-${Date.now()}.txt`);
      const blob = new Blob(['CRM Storage check ' + new Date().toISOString()], { type: 'text/plain' });
      const snap = await ref.put(blob, { contentType: 'text/plain', customMetadata: { purpose: 'storage-check', userId: uid() } });
      const url = await snap.ref.getDownloadURL();
      if (!url) throw new Error('O Firebase não retornou a URL do arquivo.');
      await snap.ref.delete();
      window.showToast?.('Storage funcionando: teste de envio, leitura e exclusão concluído.', 'success', 6000);
    } catch (error) { window.showToast?.('Teste do Storage falhou: ' + (error.code === 'storage/unauthorized' ? 'sem permissão. Publique as regras do Storage.' : (error.message || error)), 'danger', 8000); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-cloud-check"></i> Testar envio do Storage'; } }
  };

  function patchTable() {
    if (typeof window.renderTable !== 'function' || window.renderTable.__crmTags) return;
    const original = window.renderTable;
    const wrapped = function () {
      original.apply(this, arguments);
      const value = document.getElementById('filterEtiqueta')?.value || 'ALL';
      const rows = document.querySelectorAll('#tableBody tr');
      if (value !== 'ALL') rows.forEach(row => { const id = row.querySelector('.row-checkbox')?.dataset.id; const client = (window.clients || []).find(x => x.id === id); if (!window.crmMatchesTag(client, value)) row.remove(); });
      document.querySelectorAll('#pesquisaTable thead th[data-col="etiquetas"], #pesquisaTable thead th[data-col="tags"]').forEach(th => { th.textContent = 'Etiquetas'; });
    };
    wrapped.__crmTags = true; window.renderTable = wrapped;
  }
  function patchSave() {
    if (typeof window.saveClient !== 'function' || window.saveClient.__crmTags) return;
    const original = window.saveClient;
    const wrapped = async function () {
      const old = window._crmTagSaveHook;
      window._crmTagSaveHook = selectedTags();
      try { return await original.apply(this, arguments); } finally { window._crmTagSaveHook = old; }
    };
    wrapped.__crmTags = true; window.saveClient = wrapped;
  }
  function init() {
    patchTable(); patchSave();
    if (uid()) loadTags();
    const originalSwitch = window.switchTab;
    if (typeof originalSwitch === 'function' && !originalSwitch.__crmTags) {
      window.switchTab = function (id) { const result = originalSwitch.apply(this, arguments); if (id === 'clientesTab' || id === 'perfilTab') loadTags(); return result; };
      window.switchTab.__crmTags = true;
    }
  }
  window.crmTags = { load: loadTags, get tags() { return state.tags; }, badges };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
})(window, document);
