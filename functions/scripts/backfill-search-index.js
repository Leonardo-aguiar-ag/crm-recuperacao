#!/usr/bin/env node
'use strict';

const admin = require('firebase-admin');
const PAGE_SIZE = 250;
const DEFINITIONS = {
  clients: data => ({
    searchNome: normalizeText(data.nomeTitular),
    searchTelefone: digits(data.telefoneTitular || data.telefoneNormalizado),
    searchEmail: normalizeText(data.emailTitular)
  }),
  leads: data => ({
    searchNome: normalizeText(data.nome),
    searchTelefone: digits(data.telefone),
    searchEmail: normalizeText(data.email)
  }),
  tarefas: data => ({ searchTitulo: normalizeText(data.titulo) })
};

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR').trim().replace(/\s+/g, ' ');
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function parseArgs(argv) {
  const options = { apply: false, all: false, collection: '', after: '', limit: PAGE_SIZE };
  for (const arg of argv) {
    if (arg === '--apply') options.apply = true;
    else if (arg === '--all') options.all = true;
    else if (arg.startsWith('--collection=')) options.collection = arg.slice('--collection='.length);
    else if (arg.startsWith('--after=')) options.after = arg.slice('--after='.length);
    else if (arg.startsWith('--limit=')) options.limit = Number(arg.slice('--limit='.length));
    else if (arg === '--help') options.help = true;
    else throw new Error(`Argumento não reconhecido: ${arg}`);
  }
  if (!options.help && !DEFINITIONS[options.collection]) throw new Error('Informe --collection=clients, leads ou tarefas.');
  if (!options.help && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 5000)) throw new Error('--limit deve ser um inteiro entre 1 e 5000.');
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Uso: node scripts/backfill-search-index.js --collection=clients|leads|tarefas [--limit=250] [--after=DOC_ID] [--all] [--apply]');
    console.log('Sem --apply, apenas analisa e conta mudanças; --limit é o máximo por execução e --all percorre a coleção restante.');
    return;
  }
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.applicationDefault() });
  const db = admin.firestore();
  const makeFields = DEFINITIONS[options.collection];
  let cursor = options.after || null;
  let scanned = 0;
  let changed = 0;
  let nextCursor = cursor;
  const maxDocs = options.all ? Infinity : options.limit;

  while (scanned < maxDocs) {
    const pageLimit = Math.min(PAGE_SIZE, maxDocs - scanned);
    let query = db.collection(options.collection).orderBy(admin.firestore.FieldPath.documentId()).limit(pageLimit);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    const batch = db.batch();
    let pageChanges = 0;
    for (const doc of snapshot.docs) {
      const desired = makeFields(doc.data());
      const patch = Object.fromEntries(Object.entries(desired).filter(([key, value]) => doc.get(key) !== value));
      if (!Object.keys(patch).length) continue;
      changed += 1;
      pageChanges += 1;
      if (options.apply) batch.set(doc.ref, patch, { merge: true });
    }
    if (options.apply && pageChanges) await batch.commit();
    scanned += snapshot.size;
    cursor = snapshot.docs[snapshot.docs.length - 1];
    nextCursor = cursor.id;
  }

  console.log(JSON.stringify({
    collection: options.collection,
    mode: options.apply ? 'apply' : 'dry-run',
    scanned,
    documentsNeedingChanges: changed,
    nextAfter: nextCursor,
    continueWith: scanned && !options.all ? `--after=${nextCursor}` : null
  }, null, 2));
}

main().catch(error => {
  console.error(`Falha no backfill: ${error.message}`);
  process.exitCode = 1;
});
