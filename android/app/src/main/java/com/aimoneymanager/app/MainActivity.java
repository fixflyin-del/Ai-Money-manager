package com.aimoneymanager.app;

import android.annotation.SuppressLint;
import android.content.Intent;
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

    // The Android app always opens the deployed website. Web UI updates can then
    // reach the app without rebuilding the APK/AAB.
    private static final String LIVE_WEB_APP_URL = "https://aimoneymanager.pro";
    private static final String LIVE_WEB_APP_HOST = "aimoneymanager.pro";
    private static final String LIVE_WEB_APP_WWW_HOST = "www.aimoneymanager.pro";

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private PlayBillingManager billingManager;
    private MoneyFlowBridge bridge;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        assetLoader = new WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        billingManager = new PlayBillingManager(this, webView);
        bridge = new MoneyFlowBridge(this, webView, billingManager);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Keep the existing native bridge for Android-only integrations.
        // It is intended to be used only by the trusted first-party web app.
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
                // Only serve bundled resources for the dedicated app-assets origin.
                // Never substitute old bundled files for live website assets.
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null) return true;

                String scheme = uri.getScheme();
                String host = uri.getHost();

                // Keep the trusted production website inside the app.
                if ("https".equalsIgnoreCase(scheme)
                        && host != null
                        && (LIVE_WEB_APP_HOST.equalsIgnoreCase(host)
                        || LIVE_WEB_APP_WWW_HOST.equalsIgnoreCase(host))) {
                    return false;
                }

                // All other destinations (external websites, phone, email, etc.)
                // are opened outside the app and cannot replace the trusted app page.
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
                        .requestEmail()
                        .requestIdToken(serverClientId)
                        .build();
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
        if (billingManager != null) billingManager.destroy();
        super.onDestroy();
    }
}
