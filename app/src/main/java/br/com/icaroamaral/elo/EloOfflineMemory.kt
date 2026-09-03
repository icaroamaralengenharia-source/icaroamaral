package br.com.icaroamaral.elo

import android.content.Context

interface EloOfflineMemoryContract {
    fun remember(command: String): String?
    fun answer(command: String): String?
}

class EloOfflineMemory(context: Context) : EloOfflineMemoryContract {
    private val prefs = context.getSharedPreferences("elo_offline_lab_memory", Context.MODE_PRIVATE)

    override fun remember(command: String): String? {
        val normalized = EloOfflineRouter.normalize(command)
        val dogMatch = Regex("(cachorro|cao).{0,20}(se chama|chama|e)\\s+([a-z0-9_-]+)").find(normalized)
        if (dogMatch != null) {
            val displayName = Regex("(se\\s+chama|chama|é| e )\\s*([\\p{L}0-9_-]+)", RegexOption.IGNORE_CASE)
                .find(command)
                ?.groupValues
                ?.get(2)
                ?: dogMatch.groupValues[3]
            prefs.edit().putString("dog_name", displayName).apply()
            return "Certo. Vou lembrar no lab offline que seu cachorro se chama $displayName."
        }

        val projectMatch = Regex("(projeto atual|nosso projeto|projeto)\\s+(é|e|chama|se chama)\\s+(.+)$", RegexOption.IGNORE_CASE)
            .find(command)
        if (projectMatch != null) {
            val project = projectMatch.groupValues[3].trim().trimEnd('.', '!', '?')
            prefs.edit().putString("project_name", project).apply()
            return "Certo. Vou lembrar no lab offline que o projeto atual é $project."
        }

        return null
    }

    override fun answer(command: String): String? {
        val normalized = EloOfflineRouter.normalize(command)
        if (normalized.contains("cachorro")) {
            val dog = prefs.getString("dog_name", null)
            if (!dog.isNullOrBlank()) return "Você me disse que seu cachorro se chama $dog."
        }
        if (normalized.contains("projeto") || normalized.contains("photo bridge")) {
            val project = prefs.getString("project_name", null)
            if (!project.isNullOrBlank()) return "O projeto atual registrado no lab é $project."
        }
        return null
    }
}
