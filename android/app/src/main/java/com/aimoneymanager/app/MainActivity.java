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
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "FixFlyMainActivity";
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

        // The entry HTML is served from assets/www/index.html.
        // Vite emits root-relative /assets/... URLs, which must map to assets/www/assets/...
        // Keep the asset loader for the entry HTML and intercept Vite bundles before it.
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

                // Vite bundle URLs such as /assets/index-xxxx.js are relative to the
                // web root, but the files are packaged under Android assets/www/assets/.
                // Intercept these BEFORE WebViewAssetLoader, because its /assets/ handler
                // would otherwise look in assets/assets/ and return a 404 response.
                if (path != null && path.startsWith("/assets/") && !path.startsWith("/assets/www/")) {
                    try {
                        String assetPath = "www" + path;
                        InputStream stream = getAssets().open(assetPath);
                        WebResourceResponse customResponse =
                                new WebResourceResponse(getMimeType(path), "UTF-8", stream);
                        addCorsHeaders(customResponse);
                        return customResponse;
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to load bundled web asset: " + path, e);
                        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                                new HashMap<>(), null);
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
                        String assetPath = "www" + (path.startsWith("/") ? path : "/" + path);
                        InputStream stream = getAssets().open(assetPath);
                        WebResourceResponse customResponse =
                                new WebResourceResponse(getMimeType(path), "UTF-8", stream);
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
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        view.getContext().startActivity(intent);
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

    private void addCorsHeaders(WebResourceResponse response) {
        Map<String, String> headers = response.getResponseHeaders();
        if (headers == null) {
            headers = new HashMap<>();
        }
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
        if (billingManager != null) {
            billingManager.destroy();
        }
        super.onDestroy();
    }
}
