package com.aimoneymanager.app;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.MimeTypeMap;
import android.webkit.WebChromeClient;
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
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "FixFlyMainActivity";
    private static final int RC_NATIVE_GOOGLE_SIGN_IN = 7401;
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

        webView.addJavascriptInterface(bridge, "MoneyFlowNative");

        webView.setWebChromeClient(new WebChromeClient() {
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
                Uri uri = request.getUrl();
                String path = uri.getPath();

                if (path != null && path.startsWith("/assets/") && !path.startsWith("/assets/www/")) {
                    try {
                        InputStream stream = getAssets().open("www" + path);
                        WebResourceResponse response = new WebResourceResponse(getMimeType(path), "UTF-8", stream);
                        addCorsHeaders(response);
                        return response;
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to load bundled web asset: " + path, e);
                        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", new HashMap<>(), null);
                    }
                }

                WebResourceResponse response = assetLoader.shouldInterceptRequest(uri);
                if (response != null) {
                    addCorsHeaders(response);
                    return response;
                }

                if (path != null && (path.endsWith(".js") || path.endsWith(".css")
                        || path.endsWith(".svg") || path.endsWith(".png")
                        || path.endsWith(".webmanifest") || path.endsWith(".json"))) {
                    try {
                        InputStream stream = getAssets().open("www" + (path.startsWith("/") ? path : "/" + path));
                        WebResourceResponse customResponse = new WebResourceResponse(getMimeType(path), "UTF-8", stream);
                        addCorsHeaders(customResponse);
                        return customResponse;
                    } catch (Exception e) {
                        Log.w(TAG, "Asset fallback lookup failed for: " + path, e);
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && uri.getHost() != null
                        && !uri.getHost().equals("appassets.androidplatform.net")) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                        return true;
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to launch external browser for " + uri, e);
                    }
                }
                return false;
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
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html");
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

    private void addCorsHeaders(WebResourceResponse response) {
        Map<String, String> headers = response.getResponseHeaders();
        if (headers == null) headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        headers.put("Access-Control-Allow-Headers", "*");
        response.setResponseHeaders(headers);
    }

    private String getMimeType(String path) {
        String extension = MimeTypeMap.getFileExtensionFromUrl(path);
        if ("js".equalsIgnoreCase(extension) || "mjs".equalsIgnoreCase(extension)) return "text/javascript";
        if ("css".equalsIgnoreCase(extension)) return "text/css";
        if ("svg".equalsIgnoreCase(extension)) return "image/svg+xml";
        if ("json".equalsIgnoreCase(extension) || "webmanifest".equalsIgnoreCase(extension)) return "application/json";
        if ("png".equalsIgnoreCase(extension)) return "image/png";
        if ("jpg".equalsIgnoreCase(extension) || "jpeg".equalsIgnoreCase(extension)) return "image/jpeg";
        if ("woff".equalsIgnoreCase(extension)) return "font/woff";
        if ("woff2".equalsIgnoreCase(extension)) return "font/woff2";
        return "text/plain";
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
                    webView.post(() -> webView.evaluateJavascript(
                            "if(window.onAuthRedirect){window.onAuthRedirect('" + token + "');}", null));
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
