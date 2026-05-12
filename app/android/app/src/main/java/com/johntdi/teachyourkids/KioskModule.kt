package com.johntdi.teachyourkids

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Bridges Android lock-task ("screen pinning") and immersive mode to JS.
 *
 * Without device-owner privileges the first call to startLockTask() shows
 * a system confirmation dialog; once the parent accepts it the app is pinned
 * and the only way out is the long-press back+overview gesture, after which
 * our PIN gate kicks in. We pair the lock-task with sticky immersive so
 * status/nav bars also stay hidden.
 */
class KioskModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "KioskModule"

    private fun applyImmersive(activity: Activity) {
        val window = activity.window ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            val controller = window.insetsController ?: return
            controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
            controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_FULLSCREEN
            )
        }
    }

    private fun clearImmersive(activity: Activity) {
        val window = activity.window ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(true)
            val controller = window.insetsController ?: return
            controller.show(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
        }
    }

    @ReactMethod
    fun enableKioskMode(promise: Promise) {
        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity == null) { promise.reject("E_NO_ACTIVITY", "No current activity"); return }
        activity.runOnUiThread {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) activity.startLockTask()
                applyImmersive(activity)
                promise.resolve(true)
            } catch (e: Throwable) {
                promise.reject("E_LOCK_FAIL", e.message, e)
            }
        }
    }

    @ReactMethod
    fun disableKioskMode(promise: Promise) {
        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity == null) { promise.reject("E_NO_ACTIVITY", "No current activity"); return }
        activity.runOnUiThread {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) activity.stopLockTask()
                clearImmersive(activity)
                promise.resolve(true)
            } catch (e: Throwable) {
                promise.reject("E_UNLOCK_FAIL", e.message, e)
            }
        }
    }

    @ReactMethod
    fun isKioskActive(promise: Promise) {
        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity == null) { promise.resolve(false); return }
        val am = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val active = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
        } else {
            @Suppress("DEPRECATION")
            am.isInLockTaskMode
        }
        promise.resolve(active)
    }
}
