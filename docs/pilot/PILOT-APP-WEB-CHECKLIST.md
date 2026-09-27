# ELO — App/Web Pilot Checklist

## Identidade e dados

- [ ] Mesmo usuário
- [ ] Mesmo tenant
- [ ] Mesma lista de obras
- [ ] Mesmo RDO
- [ ] Mesmo Stock
- [ ] Mesma Vistoria
- [ ] Mesmos documentos
- [ ] Attachment persistido visível quando aplicável

## Contexto e sincronização

- [ ] Memória App → Web
- [ ] Memória Web → App
- [ ] Prefeitura/units coerentes
- [ ] App → Web write
- [ ] Web → App write
- [ ] Stale cache refresh
- [ ] Logout independente
- [ ] User switch
- [ ] Continuity/reload

## Segurança e release

- [ ] Cross-user blocked
- [ ] Cross-tenant blocked
- [ ] Physical App smoke quando `adb` disponível
- [ ] Production smoke quando Netlify liberar
