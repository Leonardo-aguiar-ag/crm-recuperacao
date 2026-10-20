const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

// 1. Automação de Inatividade de Negócio (Roda todos os dias à meia-noite)
exports.alertaInatividade = functions.pubsub.schedule('0 0 * * *').timeZone('America/Sao_Paulo').onRun(async (context) => {
    const hoje = new Date();
    const tresDiasAtras = new Date(hoje.getTime() - (3 * 24 * 60 * 60 * 1000));

    const snap = await db.collection('clients')
        .where('status', '==', 'Em Análise')
        .where('updatedAt', '<=', tresDiasAtras.toISOString())
        .get();

    const batch = db.batch();
    snap.forEach(doc => {
        // Cria uma notificação para o vendedor responsável
        const notificacaoRef = db.collection('notificacoes').doc();
        batch.set(notificacaoRef, {
            userId: doc.data().vendedorId || doc.data().userId,
            titulo: '⚠️ Proposta Parada',
            mensagem: `A proposta de ${doc.data().nomeTitular} está em análise há mais de 3 dias.`,
            lida: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });
    await batch.commit();
    console.log(`Verificação de inatividade concluída. ${snap.size} alertas gerados.`);
});

// 2. Criação automática de perfil de usuário no Firestore ao registrar
exports.boasVindasNovoUsuario = functions.auth.user().onCreate(async (user) => {
    await db.collection('usuarios').doc(user.uid).set({
        email: user.email,
        role: 'vendedor',
        criadoEm: admin.firestore.FieldValue.serverTimestamp()
    });
});
