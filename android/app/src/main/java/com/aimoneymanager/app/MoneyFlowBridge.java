package com.aimoneymanager.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.browser.customtabs.CustomTabsIntent;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MoneyFlowBridge {

    private static final String TAG = "MoneyFlowBridge";
    private final Activity activity;
    private final WebView webView;
    private final PlayBillingManager billingManager;

    public MoneyFlowBridge(Activity activity, WebView webView, PlayBillingManager billingManager) {
        this.activity = activity;
        this.webView = webView;
        this.billingManager = billingManager;
    }

    @JavascriptInterface
    public boolean isAndroidApk() {
        return true;
    }

    @JavascriptInterface
    public String getCloudUrl() {
        return "https://aimoney.fixfly.in";
    }

    @JavascriptInterface
    public void openExternalUrl(String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            activity.startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Error opening external URL: " + url, e);
        }
    }

    @JavascriptInterface
    public void openAuthCustomTab(String url) {
        try {
            CustomTabsIntent customTabsIntent = new CustomTabsIntent.Builder().build();
            customTabsIntent.launchUrl(activity, Uri.parse(url));
        } catch (Exception e) {
            Log.e(TAG, "Error opening custom tab: " + url, e);
            openExternalUrl(url);
        }
    }

    @JavascriptInterface
    public void saveBase64File(String filename, String mimeType, String base64) {
        activity.runOnUiThread(() -> {
            try {
                byte[] decodedBytes = Base64.decode(base64, Base64.DEFAULT);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                    Uri uri = activity.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = activity.getContentResolver().openOutputStream(uri)) {
                            if (os != null) {
                                os.write(decodedBytes);
                                os.flush();
                                Toast.makeText(activity, "Saved to Downloads: " + filename, Toast.LENGTH_LONG).show();
                            }
                        }
                    }
                } else {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadsDir.exists()) downloadsDir.mkdirs();
                    File dest = new File(downloadsDir, filename);
                    try (FileOutputStream fos = new FileOutputStream(dest)) {
                        fos.write(decodedBytes);
                        fos.flush();
                        Toast.makeText(activity, "Saved to Downloads: " + filename, Toast.LENGTH_LONG).show();
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to save file: " + filename, e);
                Toast.makeText(activity, "Failed to save file: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    @JavascriptInterface
    public void launchPlayBillingPurchase(String reqId, String productId, String type, String accountId) {
        if (billingManager != null) {
            billingManager.launchPurchase(reqId, productId, type, accountId);
        }
    }

    @JavascriptInterface
    public void restorePlayBillingPurchases(String reqId) {
        if (billingManager != null) {
            billingManager.restorePurchases(reqId);
        }
    }

    @JavascriptInterface
    public void queryProducts(String reqId) {
        if (billingManager != null) {
            billingManager.queryProducts(reqId);
        }
    }
}
