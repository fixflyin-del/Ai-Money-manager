package com.aimoneymanager.app;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;
import org.json.JSONObject;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "FixFlyMainActivity";
    private static final int RC_NATIVE_GOOGLE_SIGN_IN = 7401;
    private static final String LIVE_WEB_APP_URL = "https://aimoneymanager.pro";
    private static final String LIVE_WEB_APP_HOST = "aimoneymanager.pro";
    private static final String LIVE_WEB_APP_WWW_HOST = "www.aimoneymanager.pro";
    private static final int LIGHT_SYSTEM_BAR_BG = Color.rgb(255, 255, 255);
    private static final int LIGHT_WEB_BG = Color.rgb(248, 250, 252);
    private static final int DARK_SYSTEM_BAR_BG = Color.rgb(15, 23, 42);
    private static final int DARK_WEB_BG = Color.rgb(11, 17, 32);

    private FrameLayout rootContainer;
    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private MoneyFlowBridge bridge;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android 15+ (targetSdk 35/36) enforces edge-to-edge layout.
        // Chromium WebView ignores View.setPadding(), so we host WebView inside a
        // full-bleed FrameLayout and apply systemBars + displayCutout + ime insets
        // as LayoutParams margins on WebView, then consume the insets to prevent
        // duplicate CSS safe-area padding inside the web viewport.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        rootContainer = new FrameLayout(this);
        rootContainer.setFitsSystemWindows(false);
        rootContainer.setBackgroundColor(LIGHT_SYSTEM_BAR_BG);

        webView = new WebView(this);
        webView.setFitsSystemWindows(false);
        webView.setBackgroundColor(LIGHT_WEB_BG);
        FrameLayout.LayoutParams webViewParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        );
        rootContainer.addView(webView, webViewParams);
        setContentView(rootContainer);

        applySystemBarAppearance(false);

        ViewCompat.setOnApplyWindowInsetsListener(rootContainer, (view, windowInsets) -> {
            Insets safeBars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());

            int leftInset = safeBars.left;
            int topInset = safeBars.top;
            int rightInset = safeBars.right;
            int bottomInset = Math.max(safeBars.bottom, ime.bottom);

            if (webView != null) {
                ViewGroup.LayoutParams rawParams = webView.getLayoutParams();
                if (rawParams instanceof FrameLayout.LayoutParams) {
                    FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) rawParams;
                    if (lp.leftMargin != leftInset
                            || lp.topMargin != topInset
                            || lp.rightMargin != rightInset
                            || lp.bottomMargin != bottomInset) {
                        lp.setMargins(leftInset, topInset, rightInset, bottomInset);
                        webView.setLayoutParams(lp);
                    }
                }
            }
            return WindowInsetsCompat.CONSUMED;
        });

        requestInsetsWhenAttached(rootContainer);

        assetLoader = new WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        bridge = new MoneyFlowBridge(this, webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        webView.addJavascriptInterface(bridge, "MoneyFlowNative");

        webView.setWebChromeClient(new android.webkit.WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(TAG, "[WebView Console] " + consoleMessage.message() + " -- From line "
                        + consoleMessage.lineNumber() + " of " + consoleMessage.sourceId());
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Nullable
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null) return true;
                String scheme = uri.getScheme();
                String host = uri.getHost();
                if ("https".equalsIgnoreCase(scheme) && host != null
                        && (LIVE_WEB_APP_HOST.equalsIgnoreCase(host)
                        || LIVE_WEB_APP_WWW_HOST.equalsIgnoreCase(host))) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception e) {
                    Log.e(TAG, "Unable to open external URL: " + uri, e);
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                Log.e(TAG, "WebView Resource Error: " + error.getDescription() + " on " + request.getUrl());
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                Log.e(TAG, "WebView HTTP Error: " + errorResponse.getStatusCode() + " on " + request.getUrl());
            }
        });

        handleIntent(getIntent());
        webView.loadUrl(LIVE_WEB_APP_URL);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (rootContainer != null) {
            ViewCompat.requestApplyInsets(rootContainer);
        }
    }

    private void requestInsetsWhenAttached(View view) {
        if (view.isAttachedToWindow()) {
            ViewCompat.requestApplyInsets(view);
        } else {
            view.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener() {
                @Override
                public void onViewAttachedToWindow(View v) {
                    v.removeOnAttachStateChangeListener(this);
                    ViewCompat.requestApplyInsets(v);
                }

                @Override
                public void onViewDetachedFromWindow(View v) {
                    // No-op
                }
            });
        }
    }

    public void setSystemBarTheme(boolean isDark) {
        runOnUiThread(() -> applySystemBarAppearance(isDark));
    }

    @SuppressWarnings("deprecation")
    private void applySystemBarAppearance(boolean isDark) {
        int barColor = isDark ? DARK_SYSTEM_BAR_BG : LIGHT_SYSTEM_BAR_BG;
        int webBgColor = isDark ? DARK_WEB_BG : LIGHT_WEB_BG;

        if (rootContainer != null) {
            rootContainer.setBackgroundColor(barColor);
        }
        if (webView != null) {
            webView.setBackgroundColor(webBgColor);
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            getWindow().setStatusBarColor(barColor);
            getWindow().setNavigationBarColor(barColor);
        }

        View anchor = rootContainer != null ? rootContainer : getWindow().getDecorView();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), anchor);
        if (controller != null) {
            controller.setAppearanceLightStatusBars(!isDark);
            controller.setAppearanceLightNavigationBars(!isDark);
        }
    }

    public void startNativeGoogleSignIn(String serverClientId) {
        runOnUiThread(() -> {
            try {
                if (serverClientId == null || serverClientId.trim().isEmpty()) {
                    sendNativeGoogleResult(null, "Google Web OAuth Client ID is missing.");
                    return;
                }
                GoogleSignInOptions options = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                        .requestEmail().requestIdToken(serverClientId).build();
                GoogleSignInClient client = GoogleSignIn.getClient(this, options);
                startActivityForResult(client.getSignInIntent(), RC_NATIVE_GOOGLE_SIGN_IN);
            } catch (Exception e) {
                Log.e(TAG, "Unable to start native Google Sign-In", e);
                sendNativeGoogleResult(null, e.getMessage());
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == RC_NATIVE_GOOGLE_SIGN_IN) {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            try {
                GoogleSignInAccount account = task.getResult(ApiException.class);
                if (account == null || account.getIdToken() == null) {
                    sendNativeGoogleResult(null, "Google Sign-In returned no ID token. Check Android OAuth SHA-1 configuration.");
                } else {
                    sendNativeGoogleResult(account.getIdToken(), null);
                }
            } catch (ApiException e) {
                Log.e(TAG, "Native Google Sign-In failed, status=" + e.getStatusCode(), e);
                sendNativeGoogleResult(null, "Google Sign-In failed (code " + e.getStatusCode()
                        + "). Verify the Android OAuth client, package name and SHA-1 certificate.");
            } catch (Exception e) {
                Log.e(TAG, "Native Google Sign-In result error", e);
                sendNativeGoogleResult(null, e.getMessage());
            }
        }
    }

    private void sendNativeGoogleResult(String idToken, String error) {
        try {
            JSONObject result = new JSONObject();
            if (idToken != null) result.put("idToken", idToken);
            if (error != null) result.put("error", error);
            String json = result.toString();
            if (webView != null) {
                webView.post(() -> {
                    if (webView != null) {
                        webView.evaluateJavascript(
                                "if(window.onNativeGoogleSignIn){window.onNativeGoogleSignIn(" + JSONObject.quote(json) + ");}", null);
                    }
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "Could not return native Google Sign-In result to WebView", e);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent != null && intent.getData() != null) {
            Uri data = intent.getData();
            if ("aimoney".equalsIgnoreCase(data.getScheme()) && "oauth".equalsIgnoreCase(data.getHost())) {
                String token = data.getQueryParameter("token");
                if (token != null && webView != null) {
                    String safeToken = JSONObject.quote(token);
                    webView.post(() -> {
                        if (webView != null) {
                            webView.evaluateJavascript(
                                    "if(window.onAuthRedirect){window.onAuthRedirect(" + safeToken + ");}", null);
                        }
                    });
                }
            }
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            if (rootContainer != null) {
                rootContainer.removeView(webView);
            }
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.removeJavascriptInterface("MoneyFlowNative");
            webView.destroy();
            webView = null;
        }
        rootContainer = null;
        super.onDestroy();
    }
}