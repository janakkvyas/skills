package com.jalebiseva.game;

import android.app.Activity;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * A thin shell around the web game.
 *
 * <ul>
 *   <li>Serves the game from the APK's assets under a private https origin, so
 *       it runs with no network at all.</li>
 *   <li>Refuses every other address: there is nothing a child can tap that
 *       leaves the game.</li>
 *   <li>Gives the page a voice through the phone's text-to-speech engine
 *       (Hindi / Gujarati / English), because a WebView has none of its own.</li>
 *   <li>Full screen, screen kept on, and the back button has to be pressed
 *       three times in a row before the game closes.</li>
 * </ul>
 */
public class MainActivity extends Activity implements TextToSpeech.OnInitListener {

    /** Reserved by Android for exactly this purpose; never resolves on the internet. */
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/index.html";

    private static final Map<String, String> MIME = new HashMap<>();

    static {
        MIME.put("html", "text/html");
        MIME.put("js", "text/javascript");
        MIME.put("mjs", "text/javascript");
        MIME.put("css", "text/css");
        MIME.put("json", "application/json");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("jpeg", "image/jpeg");
        MIME.put("webp", "image/webp");
        MIME.put("svg", "image/svg+xml");
        MIME.put("ico", "image/x-icon");
        MIME.put("woff", "font/woff");
        MIME.put("woff2", "font/woff2");
        MIME.put("ttf", "font/ttf");
        MIME.put("glb", "model/gltf-binary");
        MIME.put("gltf", "model/gltf+json");
        MIME.put("bin", "application/octet-stream");
        MIME.put("ktx2", "image/ktx2");
        MIME.put("wasm", "application/wasm");
        MIME.put("mp3", "audio/mpeg");
        MIME.put("ogg", "audio/ogg");
        MIME.put("m4a", "audio/mp4");
        MIME.put("wav", "audio/wav");
    }

    private WebView web;
    private TextToSpeech tts;
    private volatile boolean ttsReady;
    private int backPresses;
    private long lastBack;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }

        web = new WebView(this);
        web.setBackgroundColor(0xFFF7DBA7);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setHapticFeedbackEnabled(false);
        web.setLongClickable(false);
        web.setOnLongClickListener(v -> true); // no text-selection or context menus
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // remembers language and sound choices
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            s.setSafeBrowsingEnabled(false); // nothing is ever fetched from the internet
        }

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebViewClient(new LocalOnlyClient());

        tts = new TextToSpeech(getApplicationContext(), this);

        web.loadUrl(START);
        hideSystemUi();
    }

    // ---- serving the game from the APK -------------------------------------

    private final class LocalOnlyClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!HOST.equals(uri.getHost())) {
                return plain(403, "Forbidden");
            }
            String path = uri.getPath();
            if (path == null || path.isEmpty() || path.equals("/")) {
                path = "/index.html";
            }
            if (path.contains("..")) {
                return plain(403, "Forbidden");
            }
            try {
                InputStream in = getAssets().open("www" + path);
                int dot = path.lastIndexOf('.');
                String ext = dot < 0 ? "" : path.substring(dot + 1).toLowerCase(Locale.ROOT);
                String mime = MIME.get(ext);
                if (mime == null) {
                    mime = "application/octet-stream";
                }
                boolean text = mime.startsWith("text/") || mime.endsWith("json") || mime.endsWith("xml");
                WebResourceResponse res = new WebResourceResponse(mime, text ? "utf-8" : null, in);
                Map<String, String> headers = new HashMap<>();
                headers.put("Cache-Control", "no-cache");
                res.setResponseHeaders(headers);
                return res;
            } catch (IOException e) {
                return plain(404, "Not Found");
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            // Stay inside the game; never open links anywhere.
            return !HOST.equals(request.getUrl().getHost());
        }

        private WebResourceResponse plain(int status, String reason) {
            return new WebResourceResponse("text/plain", "utf-8", status, reason, new HashMap<>(),
                    new ByteArrayInputStream(new byte[0]));
        }
    }

    // ---- voice ----------------------------------------------------------------

    @Override
    public void onInit(int status) {
        ttsReady = status == TextToSpeech.SUCCESS;
    }

    /** Methods the page can call as window.AndroidBridge.*. */
    private final class Bridge {
        @JavascriptInterface
        public void speak(String text, String languageTag) {
            if (!ttsReady || text == null) {
                return;
            }
            try {
                Locale wanted = Locale.forLanguageTag(languageTag == null ? "hi-IN" : languageTag);
                int r = tts.setLanguage(wanted);
                if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                    // No Gujarati voice installed? Hindi reads Gujarati poorly, so stay quiet
                    // rather than garble it; the pictures and the pointing hand carry the game.
                    if (!"hi".equals(wanted.getLanguage())) {
                        return;
                    }
                    r = tts.setLanguage(new Locale("hi", "IN"));
                    if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                        return;
                    }
                }
                tts.setSpeechRate(0.9f);
                tts.setPitch(1.1f);
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "prompt");
            } catch (RuntimeException ignored) {
                // Speech is a nicety; the game must go on without it.
            }
        }

        @JavascriptInterface
        public void stopSpeaking() {
            if (ttsReady) {
                tts.stop();
            }
        }

        @JavascriptInterface
        public boolean canSpeak(String languageTag) {
            if (!ttsReady) {
                return false;
            }
            try {
                int r = tts.isLanguageAvailable(Locale.forLanguageTag(languageTag));
                return r >= TextToSpeech.LANG_AVAILABLE;
            } catch (RuntimeException e) {
                return false;
            }
        }
    }

    // ---- life cycle ---------------------------------------------------------------

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.evaluateJavascript("window.__pause && window.__pause(false)", null);
        hideSystemUi();
    }

    @Override
    protected void onPause() {
        web.evaluateJavascript("window.__pause && window.__pause(true)", null);
        web.onPause();
        if (ttsReady) {
            tts.stop();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (tts != null) {
            tts.shutdown();
        }
        if (web != null) {
            web.destroy();
        }
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUi();
        }
    }

    /** A stray swipe should not end the game: back must be pressed three times quickly. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        long now = SystemClock.elapsedRealtime();
        backPresses = now - lastBack < 1500 ? backPresses + 1 : 1;
        lastBack = now;
        if (backPresses >= 3) {
            finish();
        } else if (backPresses == 1) {
            Toast.makeText(this, R.string.press_back_again, Toast.LENGTH_SHORT).show();
        }
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }
}
