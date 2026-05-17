package com.xiangfei.citylord;

import android.content.Context;
import android.media.AudioManager;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AudioFocus")
public class AudioFocusPlugin extends Plugin {
    private static final String TAG = "AudioFocusPlugin";
    private AudioManager audioManager;

    @Override
    public void load() {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    @PluginMethod
    public void requestDucking(PluginCall call) {
        if (audioManager == null) {
            call.reject("AudioManager not available");
            return;
        }

        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Android 8.0+ uses AudioFocusRequest
            // For simplicity and matching user request "AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK"
            // we use the legacy method which is still supported and simpler for this case.
            result = audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
        } else {
            result = audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
        }

        if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
            Log.d(TAG, "Audio focus granted (Ducking enabled)");
            call.resolve();
        } else {
            Log.w(TAG, "Audio focus request failed");
            call.reject("Audio focus request failed");
        }
    }

    @PluginMethod
    public void abandonDucking(PluginCall call) {
        if (audioManager == null) {
            call.reject("AudioManager not available");
            return;
        }

        int result = audioManager.abandonAudioFocus(null);
        if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
            Log.d(TAG, "Audio focus abandoned (Ducking disabled)");
            call.resolve();
        } else {
            call.reject("Failed to abandon audio focus");
        }
    }
}
