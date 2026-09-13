package br.com.icaroamaral.elo.offlinev2
import org.json.JSONArray
import java.text.Normalizer
import java.util.Locale

data class TechnicalEntry(val topic: String, val keywords: List<String>, val answer: String)

class TechnicalKnowledgeEngine(private val entries: List<TechnicalEntry>) {
    fun answer(input: String): Pair<String, String>? {
        val normalized = normalize(input)
        val entry = entries.maxByOrNull { candidate: TechnicalEntry ->
            candidate.keywords.count { keyword: String -> matches(normalized, keyword) }
        } ?: return null
        val score = entry.keywords.count { keyword: String -> matches(normalized, keyword) }
        return entry.takeIf { score > 0 }?.let { it.answer to it.topic }
    }

    private fun matches(normalizedInput: String, keyword: String): Boolean {
        val term = normalize(keyword)
        if (term.length < 2) return false
        return Regex("(^| )${Regex.escape(term)}( |$)").containsMatchIn(normalizedInput)
    }

    companion object {
        fun fromJson(json: String): TechnicalKnowledgeEngine {
            val array = JSONArray(json)
            val entries = (0 until array.length()).mapNotNull { index ->
                val item = array.optJSONObject(index) ?: return@mapNotNull null
                val keywords = item.optJSONArray("keywords")?.let { values ->
                    (0 until values.length()).map { values.optString(it) }
                }.orEmpty()
                TechnicalEntry(item.optString("topic"), keywords, item.optString("answer"))
            }
            return TechnicalKnowledgeEngine(entries)
        }

        fun defaults(): TechnicalKnowledgeEngine = TechnicalKnowledgeEngine(listOf(
            TechnicalEntry("concreto", listOf("concreto", "fck"), "Concreto é uma mistura de cimento, agregados, água e, quando necessário, aditivos. A resistência e o controle devem seguir o projeto estrutural."),
            TechnicalEntry("alvenaria", listOf("alvenaria", "assentar bloco", "parede"), "A sequência básica é: conferir projeto e locação, preparar a base, iniciar pelos cantos, assentar fiadas com prumo e nível, conferir vãos e finalizar amarrações e instalações previstas."),
            TechnicalEntry("argamassa", listOf("argamassa", "traço"), "A argamassa deve ser compatível com o serviço, aplicada sobre base preparada e protegida contra perda rápida de água."),
            TechnicalEntry("impermeabilização", listOf("impermeabilização", "infiltração", "umidade"), "Impermeabilização é o conjunto de camadas e detalhes que impede a passagem de água. A base deve estar preparada, os encontros tratados e a proteção mecânica executada quando prevista."),
            TechnicalEntry("revestimentos", listOf("revestimento", "fissura", "reboco", "chapisco"), "Fissuras em revestimentos podem resultar de retração, base sem preparo, espessura excessiva, movimentação da estrutura, cura inadequada ou incompatibilidade entre camadas."),
            TechnicalEntry("cobertura", listOf("cobertura", "telhado", "telha"), "Uma cobertura exige caimento, estrutura compatível, arremates, rufos, calhas e verificação da estanqueidade."),
            TechnicalEntry("instalações", listOf("instalações", "hidráulica", "elétrica"), "Instalações devem seguir projeto, compatibilização, traçados acessíveis, testes e registros antes do fechamento das paredes."),
            TechnicalEntry("fiscalização", listOf("fiscalização", "inspeção", "conferir obra"), "A fiscalização deve comparar serviço executado com projeto, registrar evidências, apontar não conformidades e acompanhar a correção."),
            TechnicalEntry("medição", listOf("medição", "medir serviço"), "A medição deve usar critérios definidos em contrato, conferir dimensões executadas e separar serviço aceito de pendências."),
            TechnicalEntry("quantitativos", listOf("quantitativo", "quantidade", "m2", "m³"), "Quantitativos dependem de geometria, unidades, vãos, perdas justificadas e critérios de medição claramente registrados."),
            TechnicalEntry("patologias", listOf("patologia", "corrosão", "desplacamento"), "Patologias devem ser descritas por localização, manifestação, extensão, possível causa e evidência, sem concluir além do que a vistoria permite."),
            TechnicalEntry("vistoria", listOf("vistoria", "laudo", "anomalia"), "Uma vistoria organizada registra ambiente, elemento, estado observado, fotos, risco aparente e recomendação de verificação."),
            TechnicalEntry("orçamento", listOf("orçamento", "custo", "composição"), "Um orçamento confiável separa serviço, unidade, quantidade, composição, fonte de preço, premissas e itens ainda pendentes."),
            TechnicalEntry("arquitetura", listOf("arquitetura", "planta", "ambiente"), "A arquitetura organiza usos, fluxos, dimensões, iluminação, ventilação, acessos e compatibilização com os demais projetos."),
            TechnicalEntry("acessibilidade", listOf("acessibilidade", "rota acessível", "pessoa com deficiência"), "Acessibilidade deve ser considerada desde a implantação, garantindo rota contínua, circulação, uso e sinalização conforme o projeto aplicável."),
            TechnicalEntry("sequência executiva", listOf("sequência executiva", "etapas da obra", "ordem de execução"), "A sequência executiva deve considerar preparação, estrutura, vedações, instalações, revestimentos, esquadrias, acabamentos, testes e entrega."),
        ))

        private fun normalize(value: String): String = Normalizer.normalize(value.lowercase(Locale.ROOT), Normalizer.Form.NFD)
            .replace("\\p{Mn}+".toRegex(), "")
            .replace("[^a-z0-9 ]".toRegex(), " ")
            .replace("\\s+".toRegex(), " ")
            .trim()
    }
}
