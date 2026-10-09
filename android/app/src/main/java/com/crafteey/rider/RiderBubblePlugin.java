package com.crafteey.rider;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.view.Window;

import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RiderBubble")
public class RiderBubblePlugin extends Plugin {

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(BubbleService.PREFS, Context.MODE_PRIVATE);
    }

    // The web app hands over the rider's login so the bubble can ask the server
    // for new requests while the web page is asleep.
    @PluginMethod
    public void setSession(PluginCall call) {
        String apiKey = call.getString("apiKey", "");
        String refreshToken = call.getString("refreshToken", "");
        prefs().edit().putString("apiKey", apiKey).putString("refreshToken", refreshToken).apply();
        BubbleService.clearTokenCache();
        call.resolve();
    }

    @PluginMethod
    public void setOnline(PluginCall call) {
        boolean online = Boolean.TRUE.equals(call.getBoolean("online", false));
        prefs().edit().putBoolean("online", online).apply();
        Context ctx = getContext();
        Intent intent = new Intent(ctx, BubbleService.class);
        try {
            if (online) {
                ContextCompat.startForegroundService(ctx, intent);
            } else {
                ctx.stopService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not change the bubble: " + e.getMessage());
        }
    }

    // True once if the rider accepted a job from the bubble.
    @PluginMethod
    public void consumeAccepted(PluginCall call) {
        boolean accepted = prefs().getBoolean("accepted", false);
        if (accepted) prefs().edit().putBoolean("accepted", false).apply();
        JSObject result = new JSObject();
        result.put("accepted", accepted);
        call.resolve(result);
    }

    // Colours the Android top bar to match the app (light or dark mode).
    @PluginMethod
    public void setStatusBar(final PluginCall call) {
        final String color = call.getString("color", "#121212");
        final boolean lightBar = Boolean.TRUE.equals(call.getBoolean("lightBar", false));
        if (getActivity() == null) {
            call.resolve();
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                int c = Color.parseColor(color);
                Window w = getActivity().getWindow();
                w.setStatusBarColor(c);
                w.setBackgroundDrawable(new ColorDrawable(c));
                WindowInsetsControllerCompat ctl = WindowCompat.getInsetsController(w, w.getDecorView());
                ctl.setAppearanceLightStatusBars(lightBar);
                call.resolve();
            } catch (Exception e) {
                call.reject("Could not set the top bar colour");
            }
        });
    }
}