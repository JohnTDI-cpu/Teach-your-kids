package com.teachyourkids.app

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Bridges Android lock-task ("screen pinning") to JS.
 *
 * Without device-owner privileges the first call to startLockTask() will show
 * a system confirmation dialog. Once the user accepts it, the app is pinned —
 * status/nav bars are hidden and the only way out is the long-press
 * back+overview gesture, after which our PIN gate kicks in.
 */
class KioskModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "KioskModule"

    @ReactMethod
    fun enableKioskMode(promise: Promise) {
        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "No current activity")
            return
        }
        activity.runOnUiThread {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    activity.startLockTask()
                }
                promise.resolve(true)
            } catch (e: Throwable) {
                promise.reject("E_LOCK_FAIL", e.message, e)
            }
        }
    }

    @ReactMethod
    fun disableKioskMode(promise: Promise) {
        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "No current activity")
            return
        }
        activity.runOnUiThread {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    activity.stopLockTask()
                }
                promise.resolve(true)
            } catch (e: Throwable) {
                promise.reject("E_UNLOCK_FAIL", e.message, e)
            }
        }
    }

    @ReactMethod
    fun isKioskActive(promise: Promise) {
        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.resolve(false)
            return
        }
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
