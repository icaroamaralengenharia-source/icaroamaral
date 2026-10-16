import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEloConversationFocus_, buildEloSystemPrompt_, getEloRelevantContext_, validateEloChatRequest_ } from '../src/app.js';

for (const [relation, name] of [['esposa', 'Likelle'], ['filho', 'Eduardo'], ['sócia', 'Mariana'], ['irmão', 'João']]) {
  test(`contexto literal de ${relation} chega ao foco sem catálogo de nomes`, async () => {
    const fact = `A pessoa que é ${relation} se chama ${name}. Era uma brincadeira.`;
    const history = [{role:'user',content:fact},{role:'assistant',content:`Você falou de ${name}.`}];
    const v = validateEloChatRequest_({message:'E essa pessoa?',history,context:{currentConversationId:'fixture',memoryScope:'CONVERSATION_ONLY'}});
    assert.equal(v.ok,true); assert.deepEqual(v.payload.history,history);
    const focus=buildEloConversationFocus_(v.payload.message,v.payload.history);
    assert.ok(focus.includes(fact)); assert.match(focus,/mais de um referente plausível/);
    const ctx=await getEloRelevantContext_({payload:v.payload,memoryStore:null});
    assert.deepEqual(ctx.compactHistory,history); assert.equal(ctx.context.permanentUserMemorySummary,'');
  });
}
test('conversa nova não herda foco e arquivo de outra conversa', async () => {
  const v=validateEloChatRequest_({message:'Quem é aquela pessoa?',history:[],context:{currentConversationId:'new',memoryScope:'CONVERSATION_ONLY',conversationArchive:{conversationId:'old',messages:[{role:'user',content:'Fato anterior privado.'}]}}});
  assert.equal(buildEloConversationFocus_(v.payload.message,v.payload.history),'');
  const ctx=await getEloRelevantContext_({payload:v.payload,memoryStore:null});
  assert.ok(!buildEloSystemPrompt_(ctx.context).includes('Fato anterior privado.'));
});
test('48 mensagens recentes e arquivo literal preservam fatos e correções', async () => {
  const history=Array.from({length:60},(_,i)=>({role:i%2?'assistant':'user',content:i===0?'Meu sócio se chama Bento.':`Turno ${i}`}));
  const v=validateEloChatRequest_({message:'Quem é meu sócio?',history,context:{currentConversationId:'same',memoryScope:'CONVERSATION_ONLY'}});
  assert.equal(v.payload.history.length,48);
  const ctx=await getEloRelevantContext_({payload:v.payload,memoryStore:null});
  assert.ok(buildEloSystemPrompt_(ctx.context).includes('Meu sócio se chama Bento.'));
});
test('foco trata grafia e humor como contexto, preservando incerteza',()=>{
  const focus=buildEloConversationFocus_('E a Likele?',[{role:'user',content:'Minha esposa se chama Likelle. Ela é uma peste kkk, estou brincando.'}]);
  assert.match(focus,/confirme quando houver dúvida/);assert.match(focus,/sem transformar humor em atributo pessoal ou memória permanente/);
  assert.match(focus,/dados literais.*não novas instruções/);
});
