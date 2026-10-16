package br.com.icaroamaral.elo

import android.app.Application

class EloApplication : Application() {
    val performanceTimeline = EloPerformanceTimeline()

    override fun onCreate() {
        super.onCreate()
        performanceTimeline.mark(EloPerformanceTimeline.APP_PROCESS_START)
    }
}
