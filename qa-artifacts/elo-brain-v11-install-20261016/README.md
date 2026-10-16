# ELO Brain v11 — QA e atualização do Samsung

Entrega: APK v11 r2 instalado, sessão autenticada e 236 mensagens preservadas. QA 52eccdb, APK 957301002219, Web v4/worker v46. Certificação acústica nova pendente.

| Evidência | Conteúdo |
|---|---|
| 01a–01f | Recuperação de espaço, arquivos preservados e dependências compartilhadas |
| 02, 03b | Serviço QA, deploys, limites e screenshot final |
| 04, 04c | Quatro cenários fictícios reais PASS, sem persistência |
| 04a, 04b, 04d | Falhas e resultado anterior preservados |
| 05 | APK final, assinatura, 14 hashes Web e catálogo offline |
| 05a, 08a | Primeira revisão v11, sucedida pela r2 |
| 06, 06b, 06c | Logs de build e preflight final |
| 07 | Lotes de testes e E2E; reruns sem soma |
| 08, 09 | Atualização r2 e versão observada no runtime |
| 10, 11 | Autenticação/histórico e package/hash instalado |
| 12 | Limpeza final de intermediários e recuperação de espaço |
| 13 | Mock Stock: falha idêntica preexistente na main e candidata |
| 14 | Gates de token, QA, ausência de failover e reteste físico |
| 15, 15a | PASS humano de interrupção, continuação e desligamento; reativação posterior voluntária |

SHA256 APK: `3b25a82295a47f5023256b208785262fd7bae3adedc27696977042f01e596d15`. Package/certificado inalterados; nenhuma limpeza de dados. Sem PR/main/produção.

Os arquivos não contêm tokens, chave OpenAI ou conteúdo do histórico pessoal. Uma captura privada de ferramenta durante a configuração exibiu a chave apesar da máscara; o valor não foi salvo aqui. Rotação deverá ser coordenada com produção. O QA gratuito pode demorar a acordar.

Primeira rodada física PASS: interrupção, continuação sem ELO e desligamento; usuário reativou depois para continuar. Rodada de 15 turnos/tela bloqueada/silêncio orientada, retorno pendente. Outros gates no Checkpoint 19.
