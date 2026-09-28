# ELO — Pilot Offline Checklist

- [ ] identidade “quem é você?” responde localmente;
- [ ] data/hora e calculadora respondem sem backend;
- [ ] conversões e cálculos determinísticos não fazem request remoto;
- [ ] backend 500/timeout aparece como serviço degradado;
- [ ] auth 401/403 aparece como sessão requerida;
- [ ] capability 404 aparece como recurso remoto indisponível;
- [ ] Service Worker instala/recarrega o shell offline;
- [ ] música local só anuncia faixa realmente disponível;
- [ ] memória local permanece no escopo do usuário/tenant;
- [ ] RDO/Stock/Vistoria distinguem cache, draft e sincronizado;
- [ ] nenhuma escrita oficial ocorre sem confirmação online;
- [ ] troca de usuário/tenant não lê cache anterior;
- [ ] 200 capacidades estão registradas e cobertas pelo contrato local;
- [ ] Android local mantém `EloOfflineDispatchGate` e wake do Step 13;
- [ ] smoke físico quando ADB estiver disponível;
- [ ] produção somente após deploy e smoke integrado posterior.
