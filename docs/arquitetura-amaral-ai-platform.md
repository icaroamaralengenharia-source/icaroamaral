# Arquitetura alvo: Amaral AI Platform

## Objetivo

A Amaral AI Platform deve organizar ELO, CADISTA AI, ObraReport, Stock Obras, Stock Full e Stock Saude Jovem4 como uma plataforma SaaS modular. A diretriz e reaproveitar os produtos existentes, criar uma base comum e evitar reescrita pesada.

## Principios

- ELO e a camada de inteligencia transversal.
- Projeto, Cliente e Empresa devem ser entidades centrais.
- Cada modulo pode ser vendido separado, mas compartilha auth, usuarios, permissoes, billing, documentos e auditoria.
- Regras locais devem ficar fora do motor principal para permitir internacionalizacao.
- Saude deve ter regras sensiveis isoladas de estoque comum.
- Modulos publicados continuam funcionando durante a migracao.

## Camadas da plataforma

### Auth/Login

Camada unica de autenticacao. Deve suportar login por email/senha, convites, recuperacao de acesso e sessao segura. Stock Full e Stock Saude ja indicam caminho com Supabase/token; ObraReport tem painel de acesso e deve convergir para o mesmo contrato.

### Empresas

Entidade `company` ou `institution` como fronteira de isolamento. Todo dado operacional deve pertencer a uma empresa/instituicao, ainda que em modo local use `companyId="local"`.

### Usuarios

Usuario deve ter perfil global e vinculos por empresa/modulo. Um mesmo usuario pode ser admin em uma empresa e leitura em outra.

### Permissoes

Permissoes devem ser declarativas por modulo, usando chaves como `products:create`, `reports:view`, `health-stock:approve` e `elo:orchestrate`. A UI consome permissoes, mas a validacao final deve acontecer no backend.

### Projetos/Clientes

`projectId` e `clientId` devem ser entidades centrais para ObraReport, ELO e CADISTA. Stock Obras deve vincular consumo por obra. CADISTA deve salvar plantas como documentos/projetos versionados.

### Documentos

Documentos gerados por relatorio, RDO, orcamento, PDF de estoque, CADISTA PDF/DXF e propostas devem usar uma tabela/camada comum de documentos, com origem, versao, emissor e empresa.

### ELO Brain

ELO deve orquestrar modulos por contrato, nao por acoplamento direto. O registry informa capacidades, rota, permissoes e integracoes. O ELO consulta o modulo, entende o contexto e encaminha para a tarefa correta.

### Billing/Assinaturas

Billing deve ser central, com planos por empresa, limites por modulo e recursos habilitados. O ObraReport ja possui tela de planos/billing demo; ela deve virar cliente da camada central.

### Auditoria

Toda acao critica deve gerar evento: login, exportacao, alteracao de estoque, aprovacao em saude, geracao de PDF, envio/preparacao de e-mail, mudanca de permissao e alteracao de documento.

### Modulos

Os modulos ficam independentes, mas registrados em `src/platform/module-registry.js`.

## Modulos iniciais

### ELO

Camada transversal de inteligencia, memoria, roteamento, relatorios, orcamentos, RDO e assistencia tecnica. Deve acessar dados por empresa/projeto e respeitar permissoes do modulo acionado.

### CADISTA AI

Modulo de projeto tecnico para plantas, PDF, DXF e futura leitura de croqui. Deve compartilhar projeto/cliente/documento com ObraReport e ser acionavel pelo ELO.

### ObraReport

Modulo central de engenharia: clientes, obras, relatorios, RDO, fotos, documentos, Stock Obras e comunicacao com cliente.

### Stock Obras

Modulo de materiais por obra. Deve permanecer estavel, conectado a ObraReport/RDO e ELO, com regras BR de composicoes e bases oficiais quando aplicavel.

### Stock Full

Modulo horizontal de estoque comercial. Deve compartilhar auth, empresa, usuario, billing e auditoria, mas nao herdar regras de obra nem de saude.

### Stock Saude Jovem4

Modulo vertical sensivel para saude. Deve ter permissao, auditoria, lote, validade, unidade/setor, aprovacao e compliance separados do estoque comum.

## Entidades alvo

```text
Company
  id
  name
  country
  billingPlan
  status

User
  id
  email
  name
  globalStatus

Membership
  userId
  companyId
  role
  modulePermissions[]

Client
  id
  companyId
  name
  contact

Project
  id
  companyId
  clientId
  moduleOrigin
  name
  type
  countryMode

Document
  id
  companyId
  projectId
  clientId
  moduleId
  type
  version
  status
  fileRef

AuditEvent
  id
  companyId
  userId
  moduleId
  entityType
  entityId
  action
  metadata
```

## Internacionalizacao

A plataforma deve separar:

- idioma e textos de UI;
- moeda e formato numerico;
- impostos, BDI, encargos e regras de preco;
- bases oficiais locais, como SINAPI/ORSE;
- regras reguladas, como saude;
- unidades e normas tecnicas.

`countryMode` deve indicar se o modulo e `BR`, `GLOBAL_READY`, `BR_HEALTH_RULES` ou outro modo futuro. O motor de regras locais deve ser plugavel.

## Sequencia segura de implementacao

1. Manter produtos atuais funcionando.
2. Usar `module-registry` apenas como leitura/teste.
3. Criar camada comum de auth/empresa/permissao em paralelo.
4. Migrar primeiro Stock Full para contrato central, pois ja tem multiempresa e permissoes.
5. Ligar ObraReport ao contrato central sem mexer no fluxo de RDO/PDF.
6. Manter Stock Obras acoplado ao ObraReport ate ter adaptador seguro.
7. Integrar CADISTA por projeto/documento.
8. Tratar Stock Saude como vertical sensivel, com compliance proprio.
9. Fazer ELO consumir o registry para decidir integracoes e limites.
