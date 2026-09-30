package expo.modules.screensleep

import android.Manifest
import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Читает из UsageStatsManager моменты включения/выключения экрана.
 * По ним JS-код находит самый длинный ночной период «экран выключен» = сон.
 */
class ScreenSleepModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is not available")

  override fun definition() = ModuleDefinition {
    Name("ScreenSleep")

    Function("hasUsageAccess") {
      hasUsageAccess()
    }

    Function("openUsageAccessSettings") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
    }

    AsyncFunction("getScreenEvents") { startMs: Double, endMs: Double ->
      readScreenEvents(startMs.toLong(), endMs.toLong())
    }
  }

  private fun hasUsageAccess(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    return if (mode == AppOpsManager.MODE_DEFAULT) {
      context.checkCallingOrSelfPermission(Manifest.permission.PACKAGE_USAGE_STATS) == PackageManager.PERMISSION_GRANTED
    } else {
      mode == AppOpsManager.MODE_ALLOWED
    }
  }

  private fun readScreenEvents(startMs: Long, endMs: Long): List<Map<String, Any>> {
    if (!hasUsageAccess()) {
      return emptyList()
    }
    val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val events = manager.queryEvents(startMs, endMs) ?: return emptyList()
    val event = UsageEvents.Event()
    val result = ArrayList<Map<String, Any>>()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val type = event.eventType
      if (type in TRACKED_EVENT_TYPES) {
        result.add(mapOf("type" to type, "time" to event.timeStamp.toDouble()))
      }
    }
    return result
  }

  companion object {
    // UsageEvents.Event: SCREEN_INTERACTIVE = 15, SCREEN_NON_INTERACTIVE = 16 (API 28+),
    // KEYGUARD_SHOWN = 17, KEYGUARD_HIDDEN = 18, DEVICE_SHUTDOWN = 26, DEVICE_STARTUP = 27 (API 29+)
    private val TRACKED_EVENT_TYPES = setOf(15, 16, 17, 18, 26, 27)
  }
}
