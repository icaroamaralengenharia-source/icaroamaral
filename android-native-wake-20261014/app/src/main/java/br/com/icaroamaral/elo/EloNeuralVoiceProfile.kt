package br.com.icaroamaral.elo

import org.json.JSONObject

/** Exact approved /elo.html PR #208 instructions; provider, model and voice stay server-owned. */
object EloNeuralVoiceProfile {
    const val INSTRUCTIONS = "Fale em português brasileiro nativo e natural, com sotaque paulista leve e neutro de São Paulo. Use pronúncia brasileira cotidiana, clara e espontânea. Evite qualquer sotaque estrangeiro, especialmente pronúncia de falante de inglês. Não faça caricatura regional. Mantenha ritmo conversacional, entonação humana e profissional, preservando a naturalidade e o timbre da voz atual, sem teatralidade e sem acelerar excessivamente. Para termos técnicos, use a pronúncia brasileira comum em obras: RDO como erre dê ó; SINAPI como sinápi; ORSE como órse; CREA como créa; BIM como bim. Pronuncie megapascais, milímetros, metros quadrados e por cento em português brasileiro."
    fun payload(text: String, voice: String) = JSONObject().put("text", text).put("voice", voice).put("instructions", INSTRUCTIONS)
}
