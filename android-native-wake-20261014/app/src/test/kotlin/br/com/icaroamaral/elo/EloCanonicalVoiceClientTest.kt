package br.com.icaroamaral.elo

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.After
import org.junit.Test
import java.util.Base64

class EloCanonicalVoiceClientTest {
    private fun raw(user:String="user-qa", claim:String=user, conversation:String="conv_qa", expires:Long=System.currentTimeMillis()/1000+3600):String {
        fun encode(s:String)=Base64.getUrlEncoder().withoutPadding().encodeToString(s.toByteArray())
        val token=encode("""{"alg":"test-only"}""")+"."+encode(JSONObject().put("sub",claim).put("exp",expires).toString())+".test_signature"
        return JSONObject().put("accessToken",token).put("identity",JSONObject().put("userId",user).put("institutionId","institution-qa"))
            .put("conversationId",conversation).put("chatContext",JSONObject().put("memoryScope","CONVERSATION_ONLY")).toString()
    }
    private fun context()=EloCanonicalVoiceContext.parse(raw()).also { EloNativeVoiceSession.replace(it);EloNativeVoiceSession.confirm(it) }
    @After fun clear() { EloNativeVoiceSession.clear() }
    @Test fun renewalCannotChangeProjectScope() {
        val old=context();val json=JSONObject(raw(expires=old.expiresAt+3600))
        json.getJSONObject("identity").put("projectId","another-project")
        val next=EloCanonicalVoiceContext.parse(json.toString())
        assertFalse(old.sameScope(next));assertFalse(EloNativeVoiceSession.renew(old,next))
    }
    @Test fun renewalKeepsValidatedScopeAndRejectsLateOrDifferentAccount() {
        val old=context();val next=EloCanonicalVoiceContext.parse(raw(expires=old.expiresAt+3600))
        assertTrue(EloNativeVoiceSession.renew(old,next));assertSame(next,EloNativeVoiceSession.current())
        assertFalse(EloNativeVoiceSession.renew(old,next))
        assertFalse(EloNativeVoiceSession.renew(next,EloCanonicalVoiceContext.parse(raw(user="other",expires=next.expiresAt+3600))))
        EloNativeVoiceSession.clear();assertFalse(EloNativeVoiceSession.renew(next,EloCanonicalVoiceContext.parse(raw(expires=next.expiresAt+3600))))
    }
    @Test fun renewalValidationUsesNewTokenWithoutReplacingLiveContext() {
        val old=context();val next=EloCanonicalVoiceContext.parse(raw(expires=old.expiresAt+3600))
        val validator=EloCanonicalVoiceClient { _,_,_ -> JSONObject().put("conversation",JSONObject().put("id","conv_qa")).put("messages",JSONArray()) }
        assertEquals(0,validator.validate(next,old));assertSame(old,EloNativeVoiceSession.current())
    }
    @Test fun musicToolReusesCanonicalPersistenceAndBypassesGenericChat() {
        val c=context();val writes=mutableListOf<String>();var chats=0
        val client=EloCanonicalVoiceClient { method,path,body ->
            if(method=="GET") JSONObject().put("conversation",JSONObject().put("id","conv_qa")).put("messages",JSONArray())
            else { if(path=="/api/elo/chat") chats++;writes.add(body?.optString("role").orEmpty());JSONObject().put("ok",true) }
        }
        assertEquals("Player confirmou.",client.ask(c,"Toque uma música") { EloVoiceToolResult("Player confirmou.",played=true) })
        assertEquals(0,chats);assertEquals(listOf("user","assistant"),writes)
    }
    @Test fun cancelledMusicToolCannotPersistLateAssistant() {
        val c=context();var assistants=0
        val client=EloCanonicalVoiceClient { method,_,body ->
            if(method=="GET") JSONObject().put("conversation",JSONObject().put("id","conv_qa")).put("messages",JSONArray())
            else { if(body?.optString("role")=="assistant") assistants++;JSONObject().put("ok",true) }
        }
        assertThrows(EloNativeVoiceFailure::class.java) { client.ask(c,"Toque música") { EloNativeVoiceSession.clear();EloVoiceToolResult("atrasada") } }
        assertEquals(0,assistants)
    }
    @Test fun contextNeverPrintsToken() { val c=context();assertEquals("EloCanonicalVoiceContext(redacted)",c.toString());assertFalse(c.toString().contains(c.token)) }
    @Test fun mismatchedSubjectIsRejected() { assertThrows(IllegalArgumentException::class.java) { EloCanonicalVoiceContext.parse(raw(claim="another-user")) } }
    @Test fun expiredTokenIsRejected() { assertThrows(IllegalArgumentException::class.java) { EloCanonicalVoiceContext.parse(raw(expires=1)) } }
    @Test fun unsafeConversationPathIsRejected() { assertThrows(IllegalArgumentException::class.java) { EloCanonicalVoiceContext.parse(raw(conversation="../other")) } }
    @Test fun scopeChangeIsObservable() { val a=context();val b=EloCanonicalVoiceContext.parse(raw(conversation="conv_other"));assertFalse(a.sameScope(b));EloNativeVoiceSession.replace(b);assertNull(EloNativeVoiceSession.current()) }
    @Test fun contextMustBeServerValidated() { val c=EloCanonicalVoiceContext.parse(raw());EloNativeVoiceSession.replace(c);assertNull(EloNativeVoiceSession.current());EloNativeVoiceSession.confirm(c);assertSame(c,EloNativeVoiceSession.current()) }
    @Test fun canonicalTurnPersistsEachRoleOnceAndUsesOfficialChat() {
        val c=context();val requests=mutableListOf<Pair<String,JSONObject?>>()
        val transport=EloCanonicalVoiceClient.JsonTransport { method,path,body ->
            requests.add(path to body)
            when {
                method=="GET" -> JSONObject().put("conversation",JSONObject().put("id","conv_qa")).put("messages",JSONArray().put(JSONObject().put("id","msg_qa").put("role","user").put("content","projeto Aurora")))
                path=="/api/elo/chat" -> JSONObject().put("ok",true).put("answer","Aurora e planejamento.")
                else -> JSONObject().put("ok",true)
            }
        }
        val answer=EloCanonicalVoiceClient(transport).ask(c,"Qual é a etapa?")
        assertEquals("Aurora e planejamento.",answer)
        val posts=requests.filter { it.first.endsWith("/messages") }
        assertEquals(2,posts.size)
        assertEquals(listOf("user","assistant"),posts.map { it.second!!.getString("role") })
        val chat=requests.single { it.first=="/api/elo/chat" }.second!!
        assertEquals("conv_qa",chat.getJSONObject("context").getString("currentConversationId"))
        assertEquals("CONVERSATION_ONLY",chat.getJSONObject("context").getString("memoryScope"))
        assertEquals(1,chat.getJSONArray("history").length())
    }
    @Test fun ambiguousPersistenceFailureIsNotRetried() {
        val c=context();var posts=0
        val client=EloCanonicalVoiceClient { method,_,_ ->
            if(method=="GET") JSONObject().put("conversation",JSONObject().put("id","conv_qa")).put("messages",JSONArray())
            else { posts++;throw EloNativeVoiceFailure("AMBIGUOUS_POST") }
        }
        assertThrows(EloNativeVoiceFailure::class.java) { client.ask(c,"pergunta") }
        assertEquals(1,posts)
    }
    @Test fun changedIdentityCancelsOldResponseBeforePersistence() {
        val c=context();var assistantPosts=0
        val client=EloCanonicalVoiceClient { method,path,body ->
            when {
                method=="GET" -> JSONObject().put("conversation",JSONObject().put("id","conv_qa")).put("messages",JSONArray())
                path=="/api/elo/chat" -> { EloNativeVoiceSession.clear();JSONObject().put("answer","atrasada") }
                else -> { if(body?.optString("role")=="assistant")assistantPosts++;JSONObject().put("ok",true) }
            }
        }
        assertThrows(EloNativeVoiceFailure::class.java) { client.ask(c,"pergunta") }
        assertEquals(0,assistantPosts)
    }
    @Test fun conversationReadMustMatchHandoff() {
        val c=context();val client=EloCanonicalVoiceClient { _,_,_->JSONObject().put("conversation",JSONObject().put("id","conv_other")) }
        assertThrows(EloNativeVoiceFailure::class.java) { client.validate(c) }
    }
    @Test fun everyTurnRechecksConversationBeforeAnyWrite() {
        val c=context();var writes=0
        val client=EloCanonicalVoiceClient { method,_,_ ->
            if(method!="GET") writes++
            JSONObject().put("conversation",JSONObject().put("id","conv_other")).put("messages",JSONArray())
        }
        assertThrows(EloNativeVoiceFailure::class.java) { client.ask(c,"pergunta") }
        assertEquals(0,writes)
    }
}
