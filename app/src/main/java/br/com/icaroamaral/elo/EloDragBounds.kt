package br.com.icaroamaral.elo

data class EloPoint(val x: Float, val y: Float)

object EloDragBounds {
    fun clamp(
        x: Float,
        y: Float,
        parentWidth: Int,
        parentHeight: Int,
        viewWidth: Int,
        viewHeight: Int,
        margin: Int
    ): EloPoint {
        val maxX = (parentWidth - viewWidth - margin).coerceAtLeast(margin).toFloat()
        val maxY = (parentHeight - viewHeight - margin).coerceAtLeast(margin).toFloat()
        return EloPoint(
            x.coerceIn(margin.toFloat(), maxX),
            y.coerceIn(margin.toFloat(), maxY)
        )
    }
}
