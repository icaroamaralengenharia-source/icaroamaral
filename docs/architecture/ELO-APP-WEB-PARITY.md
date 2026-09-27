# ELO — App/Web Parity

## Escopo

O App Android oficial e o Web usam a mesma identidade lógica de usuário e tenant, com backend canônico compartilhado. A paridade validada cobre os contratos locais/RC do Step 12; o smoke físico do App permanece pendente enquanto `adb` não estiver disponível.

## Dados persistentes compartilhados

- Works / obras
- RDO
- Stock
- Vistorias
- Documents
- Attachments persistidos, quando aplicável
- Memory
- Prefeitura e units

O contexto de trabalho é client-local. Isso inclui `currentWork`, `currentUnit`, `currentAttachment` e `lastAnalysis` quando estiver limitado à sessão.

Sessões e tokens podem ser diferentes entre os clientes. O logout de um cliente é independente do outro. Cache potencialmente stale deve ser revalidado contra o backend antes de ser usado como estado atual.

## Segurança e conflitos

A política de conflito é definida pelos contratos e testes do Step 12. Dados e ações fora do escopo são bloqueados: cross-user, cross-tenant e cross-work não podem atravessar o contexto autorizado.

## Estado de release

- Parity matrix: 17/17 PASS
- Prompt parity: 30/30 PASS
- Stress: 54/54 PASS
- Physical App smoke: PENDING — `adb` indisponível
- Production smoke: não declarado PASS; depende da liberação do hosting de produção

Este documento não adiciona capacidades funcionais; registra somente o contrato validado do App/Web.
