# Matriz de dependências externas

| Feature | Local/harness | Backend | Netlify | Apps Script | Drive |
|---|---|---|---|---|---|
| Auth/obra | PASS com auth mock e fixture | Necessário no caminho real | Hospeda a UI | Não | Não |
| Stock | PASS com Stock demo em memória | Opcional para demo local; necessário para dados reais | UI | Não | Não |
| RDO | PASS com serviço transacional local | Necessário no caminho real | UI | Para PDF real | Para PDF real |
| PDF | Artefato pré-validado disponível | Orquestra o fluxo | UI/abertura | Gerador externo | Armazenamento externo |
| Vistoria | PASS com fixture e serviço file | Necessário no caminho real | UI | Não | Opcional |
| Anexos | PASS para ingestão local autenticada | Necessário para chat/parser | UI | Não | Opcional |
| Análise | Parser local/harness; modelo não é simulado | Backend e provedor configurado | UI | Não | Não |
| Memória | PASS em store temporário | Necessário no caminho real | UI | Não | Não |
| Relatório | PASS em documento controlado local | Necessário no caminho real | UI | Se PDF externo | Se registry externo |

## Bloqueio conhecido

`Netlify production: BLOCKED EXTERNALLY` por pausa de deploys por créditos. Isso não é bug do Pilot RC. Quando liberar, será necessário um único production release smoke autenticado.
