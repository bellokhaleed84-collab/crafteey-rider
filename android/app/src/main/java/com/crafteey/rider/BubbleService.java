package com.crafteey.rider;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// Floating bubble. Runs while the rider is online. When the app is not on
// screen it shows a draggable logo bubble and checks for new requests every
// few seconds. A new request shows as a card for 8 seconds.
public class BubbleService extends Service {

    static final String PREFS = "crafteey_bubble";
    private static final String BASE_URL = "https://crafteey-rider.vercel.app";
    private static final String CHANNEL_ID = "bubble_service";
    private static final int NOTIF_ID = 4101;
    private static final long CARD_SECONDS = 8;
    private static final long POLL_MS = 4000;

    private static volatile BubbleService instance;
    private static volatile boolean appInBackground = false;

    private static final Object tokenLock = new Object();
    private static String cachedToken = null;
    private static long tokenExpiresAt = 0;

    static void setAppInBackground(boolean background) {
        appInBackground = background;
        final BubbleService s = instance;
        if (s != null) s.main.post(s::refresh);
    }

    static void clearTokenCache() {
        synchronized (tokenLock) {
            cachedToken = null;
            tokenExpiresAt = 0;
        }
    }

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService net = Executors.newSingleThreadExecutor();
    private final Set<String> dismissed = ConcurrentHashMap.newKeySet();

    private WindowManager wm;
    private View bubble;
    private WindowManager.LayoutParams bubbleLp;
    private View card;
    private Runnable cardTick;

    private volatile boolean polling = false;
    private volatile boolean pollInFlight = false;
    private volatile boolean cardShowing = false;
    // Set when the server says the rider already has a delivery.
    private volatile boolean busy = false;

    private final Runnable pollRunnable = new Runnable() {
        @Override
        public void run() {
            if (!polling) return;
            if (!pollInFlight) {
                pollInFlight = true;
                net.execute(() -> {
                    try {
                        pollOnce();
                    } finally {
                        pollInFlight = false;
                    }
                });
            }
            main.postDelayed(this, POLL_MS);
        }
    };

    // ---------------------------------------------------------------- lifecycle

    @Override
    public void onCreate() {
        super.onCreate();
        wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        instance = this;
        try {
            startAsForeground();
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        refresh();
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        instance = null;
        stopPolling();
        removeCard();
        removeBubble();
        net.shutdownNow();
        super.onDestroy();
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private void startAsForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) {
            nm.createNotificationChannel(
                new NotificationChannel(CHANNEL_ID, "Floating bubble", NotificationManager.IMPORTANCE_MIN)
            );
        }
        Notification n = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_tracking)
            .setContentTitle("Crafteey Rider bubble")
            .setContentText("New delivery requests pop up when you leave the app.")
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .build();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIF_ID, n);
        }
    }

    // Decides what should be on screen right now.
    private void refresh() {
        boolean online = prefs().getBoolean("online", false);
        if (!online) {
            stopPolling();
            removeCard();
            removeBubble();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return;
        }
        boolean canDraw = Settings.canDrawOverlays(this);
        if (appInBackground && canDraw) {
            showBubble();
            startPolling();
        } else {
            stopPolling();
            removeCard();
            removeBubble();
            if (!appInBackground) {
                // App is open again: it handles requests itself. Start fresh next time.
                dismissed.clear();
                busy = false;
            }
        }
    }

    private void startPolling() {
        if (polling) return;
        polling = true;
        main.post(pollRunnable);
    }

    private void stopPolling() {
        polling = false;
        main.removeCallbacks(pollRunnable);
    }

    private void openApp() {
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
            | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        try {
            startActivity(i);
        } catch (Exception ignored) {
        }
    }

    // ---------------------------------------------------------------- helpers

    private int dp(float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private int overlayType() {
        return Build.VERSION.SDK_INT >= 26
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
    }

    // ---------------------------------------------------------------- bubble

    private void showBubble() {
        if (bubble != null) return;

        final int size = dp(60);
        final int screenW = getResources().getDisplayMetrics().widthPixels;
        final int screenH = getResources().getDisplayMetrics().heightPixels;

        FrameLayout root = new FrameLayout(this);
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(0xFF3F04AC);
        bg.setStroke(dp(2), 0xFFFFB400);
        root.setBackground(bg);
        root.setElevation(dp(6));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.bubble_logo);
        root.addView(logo, new FrameLayout.LayoutParams(size, size));

        final WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
            size,
            size,
            overlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        lp.gravity = Gravity.TOP | Gravity.START;
        lp.x = prefs().getInt("bx", screenW - size);
        lp.y = prefs().getInt("by", dp(220));
        bubbleLp = lp;

        root.setOnTouchListener(new View.OnTouchListener() {
            int startX;
            int startY;
            float touchX;
            float touchY;
            boolean moved;

            @Override
            public boolean onTouch(View v, MotionEvent e) {
                switch (e.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        startX = lp.x;
                        startY = lp.y;
                        touchX = e.getRawX();
                        touchY = e.getRawY();
                        moved = false;
                        return true;
                    case MotionEvent.ACTION_MOVE: {
                        float dx = e.getRawX() - touchX;
                        float dy = e.getRawY() - touchY;
                        if (Math.abs(dx) > dp(6) || Math.abs(dy) > dp(6)) moved = true;
                        if (moved) {
                            lp.x = Math.max(0, Math.min(screenW - size, startX + (int) dx));
                            lp.y = Math.max(0, Math.min(screenH - size - dp(24), startY + (int) dy));
                            try {
                                wm.updateViewLayout(bubble, lp);
                            } catch (Exception ignored) {
                            }
                        }
                        return true;
                    }
                    case MotionEvent.ACTION_UP:
                        if (!moved) {
                            openApp();
                        } else {
                            // Snap to the nearest side so it stays out of the way.
                            lp.x = (lp.x + size / 2 < screenW / 2) ? 0 : screenW - size;
                            try {
                                wm.updateViewLayout(bubble, lp);
                            } catch (Exception ignored) {
                            }
                            prefs().edit().putInt("bx", lp.x).putInt("by", lp.y).apply();
                        }
                        return true;
                    default:
                        return false;
                }
            }
        });

        try {
            wm.addView(root, lp);
            bubble = root;
        } catch (Exception e) {
            bubble = null;
        }
    }

    private void removeBubble() {
        if (bubble == null) return;
        try {
            wm.removeView(bubble);
        } catch (Exception ignored) {
        }
        bubble = null;
    }

    // ---------------------------------------------------------------- polling

    private void pollOnce() {
        if (!polling || cardShowing || busy) return;
        String token = getIdToken();
        if (token == null) return;

        Resp r = request("GET", "/api/courier-requests/queue", token, null);
        if (r == null) return;
        if (r.code == 401) {
            clearTokenCache();
            return;
        }
        if (r.code != 200) return;

        try {
            JSONArray arr = new JSONObject(r.body).optJSONArray("requests");
            if (arr == null) return;
            for (int i = 0; i < arr.length(); i++) {
                final JSONObject o = arr.getJSONObject(i);
                String id = o.optString("_id", "");
                if (id.isEmpty() || dismissed.contains(id)) continue;
                if (cardShowing) return;
                cardShowing = true;
                main.post(() -> showCard(o));
                return;
            }
        } catch (Exception ignored) {
        }
    }

    // ---------------------------------------------------------------- card

    private TextView text(String value, float sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(value);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private Button button(String label, int bgColor, int textColor) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextColor(textColor);
        GradientDrawable d = new GradientDrawable();
        d.setColor(bgColor);
        d.setCornerRadius(dp(14));
        b.setBackground(d);
        b.setStateListAnimator(null);
        return b;
    }

    private void showCard(JSONObject o) {
        if (!polling || bubble == null || card != null) {
            cardShowing = (card != null);
            return;
        }

        final String id = o.optString("_id", "");
        boolean isHub = "hub".equals(o.optString("source", ""));
        String title = isHub ? "New order to deliver" : "New delivery request";

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(16), dp(14), dp(16), dp(14));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xFF1C1C1E);
        bg.setCornerRadius(dp(20));
        bg.setStroke(dp(2), 0xFFFFB400);
        box.setBackground(bg);
        box.setElevation(dp(10));

        box.addView(text(title, 18, 0xFFFFFFFF, true));

        if (o.has("riderEarningKobo") && !o.isNull("riderEarningKobo")) {
            long naira = Math.round(o.optLong("riderEarningKobo", 0) / 100.0);
            TextView earn = text("Earn \u20A6" + String.format(Locale.US, "%,d", naira), 24, 0xFFFFB400, true);
            LinearLayout.LayoutParams elp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            elp.topMargin = dp(4);
            box.addView(earn, elp);
        }

        TextView pickup = text("Pickup: " + o.optString("pickup", ""), 14, 0xFFDDDDDD, false);
        pickup.setMaxLines(2);
        pickup.setEllipsize(TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams plp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        plp.topMargin = dp(8);
        box.addView(pickup, plp);

        TextView dropoff = text("Drop-off: " + o.optString("dropoff", ""), 14, 0xFFDDDDDD, false);
        dropoff.setMaxLines(2);
        dropoff.setEllipsize(TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams dlp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        dlp.topMargin = dp(4);
        box.addView(dropoff, dlp);

        final TextView countdown = text("Time left: " + CARD_SECONDS + "s", 13, 0xFF9A9AA0, false);
        LinearLayout.LayoutParams clp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        clp.topMargin = dp(8);
        box.addView(countdown, clp);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        final Button decline = button("Decline", 0xFF3A3A3C, 0xFFFFFFFF);
        final Button accept = button("Accept", 0xFFFFB400, 0xFF000000);
        LinearLayout.LayoutParams b1 = new LinearLayout.LayoutParams(0, dp(54), 1f);
        b1.rightMargin = dp(6);
        LinearLayout.LayoutParams b2 = new LinearLayout.LayoutParams(0, dp(54), 1.4f);
        b2.leftMargin = dp(6);
        row.addView(decline, b1);
        row.addView(accept, b2);
        LinearLayout.LayoutParams rlp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        rlp.topMargin = dp(10);
        box.addView(row, rlp);

        decline.setOnClickListener(v -> {
            dismissed.add(id);
            removeCard();
        });

        accept.setOnClickListener(v -> {
            accept.setEnabled(false);
            decline.setEnabled(false);
            accept.setText("Accepting...");
            if (cardTick != null) main.removeCallbacks(cardTick);
            net.execute(() -> {
                String token = getIdToken();
                Resp r = (token == null)
                    ? null
                    : request("PATCH", "/api/courier-requests/" + id + "/accept", token, "{}");
                main.post(() -> onAcceptResult(id, r));
            });
        });

        int screenW = getResources().getDisplayMetrics().widthPixels;
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
            screenW - dp(24),
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );
        lp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        lp.y = dp(40);

        try {
            wm.addView(box, lp);
        } catch (Exception e) {
            cardShowing = false;
            return;
        }
        card = box;

        alertRider();

        final int[] left = {(int) CARD_SECONDS};
        cardTick = new Runnable() {
            @Override
            public void run() {
                left[0]--;
                if (left[0] <= 0) {
                    dismissed.add(id);
                    removeCard();
                    return;
                }
                countdown.setText("Time left: " + left[0] + "s");
                main.postDelayed(this, 1000);
            }
        };
        main.postDelayed(cardTick, 1000);
    }

    private void onAcceptResult(String id, Resp r) {
        if (r != null && r.code == 200) {
            prefs().edit().putBoolean("accepted", true).apply();
            removeCard();
            openApp();
            return;
        }

        String msg = "Could not accept. Open the app and try again.";
        if (r != null) {
            if (r.code == 401) clearTokenCache();
            try {
                String e = new JSONObject(r.body).optString("error", "");
                if (!e.isEmpty()) msg = e;
            } catch (Exception ignored) {
            }
            if (r.code == 409 && msg.toLowerCase(Locale.ROOT).contains("active delivery")) {
                busy = true;
            }
        }
        dismissed.add(id);
        removeCard();
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }

    private void removeCard() {
        if (cardTick != null) {
            main.removeCallbacks(cardTick);
            cardTick = null;
        }
        if (card != null) {
            try {
                wm.removeView(card);
            } catch (Exception ignored) {
            }
            card = null;
        }
        cardShowing = false;
    }

    private void alertRider() {
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                if (Build.VERSION.SDK_INT >= 26) {
                    v.vibrate(VibrationEffect.createWaveform(new long[] {0, 300, 150, 300}, -1));
                } else {
                    v.vibrate(new long[] {0, 300, 150, 300}, -1);
                }
            }
        } catch (Exception ignored) {
        }
        try {
            RingtoneManager.getRingtone(this, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)).play();
        } catch (Exception ignored) {
        }
    }

    // ---------------------------------------------------------------- network

    private static class Resp {
        int code;
        String body;
    }

    private static String readAll(InputStream is) throws Exception {
        if (is == null) return "";
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = is.read(buf)) > 0) out.write(buf, 0, n);
        return out.toString("UTF-8");
    }

    private Resp request(String method, String path, String idToken, String jsonBody) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(BASE_URL + path).openConnection();
            c.setRequestMethod(method);
            c.setConnectTimeout(8000);
            c.setReadTimeout(8000);
            c.setRequestProperty("Authorization", "Bearer " + idToken);
            c.setRequestProperty("Content-Type", "application/json");
            if (jsonBody != null) {
                c.setDoOutput(true);
                OutputStream os = c.getOutputStream();
                os.write(jsonBody.getBytes(StandardCharsets.UTF_8));
                os.close();
            }
            Resp r = new Resp();
            r.code = c.getResponseCode();
            r.body = readAll(r.code >= 400 ? c.getErrorStream() : c.getInputStream());
            return r;
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    // Gets a fresh login token from Firebase using the saved refresh token.
    private String getIdToken() {
        synchronized (tokenLock) {
            if (cachedToken != null && System.currentTimeMillis() < tokenExpiresAt) return cachedToken;

            String apiKey = prefs().getString("apiKey", "");
            String refresh = prefs().getString("refreshToken", "");
            if (apiKey.isEmpty() || refresh.isEmpty()) return null;

            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL("https://securetoken.googleapis.com/v1/token?key="
                    + URLEncoder.encode(apiKey, "UTF-8")).openConnection();
                c.setRequestMethod("POST");
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                c.setRequestProperty("Referer", BASE_URL + "/");
                String form = "grant_type=refresh_token&refresh_token=" + URLEncoder.encode(refresh, "UTF-8");
                OutputStream os = c.getOutputStream();
                os.write(form.getBytes(StandardCharsets.UTF_8));
                os.close();

                int code = c.getResponseCode();
                String body = readAll(code >= 400 ? c.getErrorStream() : c.getInputStream());
                if (code != 200) return null;

                JSONObject j = new JSONObject(body);
                String idToken = j.optString("id_token", "");
                if (idToken.isEmpty()) return null;
                long expiresIn = Long.parseLong(j.optString("expires_in", "3600"));
                cachedToken = idToken;
                tokenExpiresAt = System.currentTimeMillis() + Math.max(60, expiresIn - 300) * 1000L;

                String newRefresh = j.optString("refresh_token", "");
                if (!newRefresh.isEmpty() && !newRefresh.equals(refresh)) {
                    prefs().edit().putString("refreshToken", newRefresh).apply();
                }
                return cachedToken;
            } catch (Exception e) {
                return null;
            } finally {
                if (c != null) c.disconnect();
            }
        }
    }
}