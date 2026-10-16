package br.com.icaroamaral.elo

object EloNativeMusicIntent {
    fun matches(text: String): Boolean {
        val clean = EloVoiceMediaCommand.normalizeVoiceCommand(text).removePrefix("elo ").trim()
        val verb = clean.substringBefore(' ')
        val play = verb in setOf("toque", "toca", "tocar", "toqui", "coloque", "coloca", "colocar", "poe", "ponha", "bota", "bote", "botar", "reproduza", "reproduzir", "play") && clean.contains(' ')
        return play || EloVoiceMediaCommand.isPauseCommand(clean) || EloVoiceMediaCommand.isResumeCommand(clean, true) ||
            EloVoiceMediaCommand.isNextCommand(clean) || EloVoiceMediaCommand.isPreviousCommand(clean) || EloVoiceMediaCommand.isStopCommand(clean)
    }
}
