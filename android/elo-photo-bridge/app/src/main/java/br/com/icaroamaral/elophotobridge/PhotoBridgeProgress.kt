package br.com.icaroamaral.elophotobridge

data class PhotoBridgeProgress(
  val status: PhotoBridgeFlowStatus,
  val message: String,
  val current: Int? = null,
  val total: Int? = null,
  val photoCount: Int? = null,
  val categoryCounts: Map<String, Int>? = null
)
