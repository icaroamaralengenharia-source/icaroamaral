package br.com.icaroamaral.elophotobridge

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel

class PhotoBridgeViewModel(private val savedStateHandle: SavedStateHandle) : ViewModel() {
  var state: PhotoBridgeUiState
    get() = savedStateHandle[KEY_STATE] ?: PhotoBridgeUiState()
    set(value) { savedStateHandle[KEY_STATE] = value }

  var isProcessing: Boolean
    get() = savedStateHandle[KEY_PROCESSING] ?: false
    set(value) { savedStateHandle[KEY_PROCESSING] = value }

  companion object {
    private const val KEY_STATE = "photo_bridge_ui_state"
    private const val KEY_PROCESSING = "photo_bridge_processing"
  }
}
