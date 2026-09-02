package br.com.icaroamaral.elophotobridge

import android.content.Context
import android.location.Geocoder
import java.util.Locale

class AndroidGeocoderCityResolver(private val context: Context) {
  fun resolveCity(photo: PhotoMetadata): PhotoMetadata {
    val lat = photo.latitude ?: return photo.copy(city = null)
    val lng = photo.longitude ?: return photo.copy(city = null)
    return try {
      val result = Geocoder(context, Locale("pt", "BR")).getFromLocation(lat, lng, 1).orEmpty().firstOrNull()
      photo.copy(city = result?.locality ?: result?.subAdminArea ?: result?.adminArea)
    } catch (_: Exception) {
      photo.copy(city = null)
    }
  }
}
