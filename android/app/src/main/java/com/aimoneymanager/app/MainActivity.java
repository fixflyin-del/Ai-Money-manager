package com.aimoneymanager.app;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
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

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private MoneyFlowBridge bridge;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android 15+ enforces edge-to-edge for apps targeting SDK 35+.
        // Explicitly inset WebView content so web UI stays below system bars.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.rgb(248, 250, 252));
        getWindow().setNavigationBarColor(Color.rgb(248, 250, 252));
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(248, 250, 252));
        setContentView(webView);
        WindowCompat.getInsetsController(getWindow(), webView).setAppearanceLightStatusBars(true);
        WindowCompat.getInsetsController(getWindow(), webView).setAppearanceLightNavigationBars(true);
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            androidx.core.graphics.Insets systemBars = windowInsets.getInsets(
                    androidx.core.view.WindowInsetsCompat.Type.systemBars());
            view.setPadding(0, systemBars.top, 0, systemBars.bottom);
            return windowInsets;
        });
        androidx.core.view.ViewCompat.requestApplyInsets(webView);

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
            webView.post(() -> webView.evaluateJavascript(
                    "if(window.onNativeGoogleSignIn){window.onNativeGoogleSignIn(" + JSONObject.quote(json) + ");}", null));
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
                if (token != null) {
                    String safeToken = JSONObject.quote(token);
                    webView.post(() -> webView.evaluateJavascript(
                            "if(window.onAuthRedirect){window.onAuthRedirect(" + safeToken + ");}", null));
                }
            }
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.removeJavascriptInterface("MoneyFlowNative");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}