# Plano de evolução do CRM

## Objetivo
Evoluir o CRM para uma operação comercial orientada por tarefas, previsão de fechamento, metas por vendedor, origem de receita, pós-venda, financeiro, relatórios e recuperação confiável, sem perder a compatibilidade com o Firebase e com os dados existentes.

## Estratégia de implementação
A aplicação atual é um frontend estático concentrado em `index.html`, com Firebase Auth/Firestore/Storage e Cloud Functions em `functions/index.js`. A mudança será incremental:

1. Criar uma camada de estado e filtros compartilhados para a aba Análises e corrigir a aplicação uniforme dos filtros em gráficos, tabelas, pivot, comissões, fluxo de caixa, metas e origem.
2. Criar módulos JavaScript em `modules/`, carregados pelo `index.html`, mantendo funções globais temporárias para compatibilidade com os handlers existentes.
3. Expandir o modelo de dados com campos opcionais e retrocompatíveis: metas por vendedor, probabilidade/forecast, origem/campanha, pós-venda/renovação, cobranças e preferências de notificação.
4. Substituir carregamento indiscriminado por carregamento paginado/sob demanda onde for seguro, mantendo cache local de sessão e fallback para dados já carregados.
5. Adicionar exportações CSV compatíveis com Excel e relatórios PDF imprimíveis, sem introduzir dependência pesada no frontend.
6. Mover backup agendado e limpeza/recuperação crítica para Cloud Functions quando possível; manter exportação manual no frontend.
7. Validar sintaxe, regras, funções e integração entre módulos antes de cada publicação.

## Design e experiência
- **Alternativas consideradas:** painel operacional de alta densidade (0,06), cockpit executivo com cartões compactos (0,08), fluxo assistido por próximas ações (0,07).
- **Escolha:** fluxo assistido por próximas ações.
- **Movimento visual:** o CRM deve destacar o próximo passo comercial, o risco e o resultado esperado, reduzindo navegação e leitura de tabelas.
- **Princípios:** clareza de prioridade, filtros consistentes, feedback imediato e rastreabilidade.
- **Paleta:** manter o tema atual e usar verde para resultado, amarelo para atenção, vermelho para risco e roxo/azul para informação.
- **Layout:** preservar as abas atuais, mas inserir painéis de ação no Dashboard, Pipeline e Análises.
- **Interação:** ações de contato, tarefa, alteração de etapa e cobrança devem ser acessíveis diretamente nos cards/tabelas.
- **Tipografia e voz:** manter Bootstrap e a linguagem objetiva atual em português do Brasil.

## Critérios técnicos
- Todos os filtros da aba Análises devem produzir o mesmo conjunto base.
- Períodos personalizados devem ser inclusivos e validar início/fim.
- Dados legados sem os novos campos continuam visíveis e operacionais.
- Nenhuma exportação deve expor dados de outro usuário/organização.
- Regras de Firestore/Storage continuam sendo a autoridade de acesso.
- Não realizar escritas destrutivas em dados reais durante validação.
- O frontend deve permanecer publicável pelo Firebase Hosting.
