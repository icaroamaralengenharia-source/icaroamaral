package br.com.icaroamaral.elophotobridge

class EloPhotoBridgeAdapter(private val classifier: PhotoCategoryClassifier = HeuristicPhotoCategoryClassifier()) {
  fun buildPayload(command: ParsedCommand, group: VisitGroup, preparedPhotos: List<ClassifiedPhoto>? = null): EloPhotoBridgePayload {
    val classified = preparedPhotos ?: group.photos.map { ClassifiedPhoto(it, classifier.classify(it), source = "heuristic") }
    return EloPhotoBridgePayload(
      reportType = command.reportType,
      city = group.city ?: "UNKNOWN",
      visitDate = group.date?.toString() ?: "AMBIGUOUS",
      confidenceCity = group.confidenceCity,
      confidenceDate = group.confidenceDate,
      photos = classified.groupBy { it.category }
    )
  }

  fun toJson(payload: EloPhotoBridgePayload): String {
    fun q(value: String): String = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
    fun photoJson(photo: ClassifiedPhoto): String {
      val metadata = photo.metadata
      return "{" +
        "\"uri\":" + q(metadata.uri.toString()) + "," +
        "\"displayName\":" + q(metadata.displayName) + "," +
        "\"mimeType\":" + q(metadata.mimeType ?: "") + "," +
        "\"width\":" + (metadata.width ?: "null") + "," +
        "\"height\":" + (metadata.height ?: "null") + "," +
        "\"category\":" + q(photo.category.name) + "," +
        "\"classification\":{\"source\":" + q(photo.source) + ",\"confidence\":" + photo.confidence + ",\"reason\":" + q(photo.reason) + "}" +
        "}"
    }
    val categories = reportCategories.joinToString(",") { category ->
      val items = payload.photos[category].orEmpty().joinToString(",") { photoJson(it) }
      q(category.jsonKey()) + ":[" + items + "]"
    }
    return "{" +
      "\"source\":\"ELO_PHOTO_BRIDGE\"," +
      "\"reportType\":" + q(payload.reportType.name) + "," +
      "\"city\":" + q(payload.city) + "," +
      "\"visitDate\":" + q(payload.visitDate) + "," +
      "\"confidence\":{\"city\":${payload.confidenceCity},\"date\":${payload.confidenceDate}}," +
      "\"photos\":{" + categories + "}" +
      "}"
  }

  companion object {
    private val reportCategories = listOf(
      PhotoCategory.CAMERAS,
      PhotoCategory.TOMADAS,
      PhotoCategory.RACK,
      PhotoCategory.CAIXA_FUNDO_MADEIRA,
      PhotoCategory.MASTRO_ANTENA,
      PhotoCategory.UNKNOWN
    )
    fun PhotoCategory.jsonKey(): String {
      return when (this) {
        PhotoCategory.CAIXA_FUNDO_MADEIRA -> "caixaFundoMadeira"
        PhotoCategory.MASTRO_ANTENA -> "mastroAntena"
        PhotoCategory.TOMADA_DADOS -> "tomadaDados"
        PhotoCategory.TOMADA_CABO_PRETO -> "tomadaCaboPreto"
        else -> name.lowercase()
      }
    }
  }
}



