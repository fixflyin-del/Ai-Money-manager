package com.aimoneymanager.app;

import android.app.Activity;
import android.util.Log;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.ProductDetailsResponseListener;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesResponseListener;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

public class PlayBillingManager implements PurchasesUpdatedListener {

    private static final String TAG = "FixFlyBillingManager";
    private final Activity activity;
    private final WebView webView;
    private BillingClient billingClient;
    private final Map<String, ProductDetails> cachedProductDetails = new HashMap<>();
    private String currentReqId = "";

    public PlayBillingManager(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        initBillingClient();
    }

    private void initBillingClient() {
        PendingPurchasesParams pendingPurchasesParams = PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build();

        billingClient = BillingClient.newBuilder(activity)
                .setListener(this)
                .enablePendingPurchases(pendingPurchasesParams)
                .build();

        startConnection();
    }

    private void startConnection() {
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    Log.d(TAG, "BillingClient connected successfully.");
                    preloadProductDetails();
                } else {
                    Log.w(TAG, "BillingClient setup failed with code: " + billingResult.getResponseCode());
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                Log.w(TAG, "BillingClient disconnected. Attempting to reconnect...");
                startConnection();
            }
        });
    }

    private void preloadProductDetails() {
        List<QueryProductDetailsParams.Product> productList = new ArrayList<>();
        productList.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId("aimoney_pro_monthly")
                .setProductType(BillingClient.ProductType.SUBS)
                .build());
        productList.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId("aimoney_pro_yearly")
                .setProductType(BillingClient.ProductType.SUBS)
                .build());
        productList.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId("aimoney_pro_lifetime")
                .setProductType(BillingClient.ProductType.INAPP)
                .build());

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(productList)
                .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsList) -> {
            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && productDetailsList != null) {
                for (ProductDetails details : productDetailsList) {
                    cachedProductDetails.put(details.getProductId(), details);
                    Log.d(TAG, "Loaded product details for: " + details.getProductId());
                }
            }
        });
    }

    public void launchPurchase(String reqId, String productId, String type, String accountId) {
        this.currentReqId = reqId;

        ProductDetails details = cachedProductDetails.get(productId);
        if (details == null) {
            notifyPurchaseResult(reqId, false, "Product details not available. Please retry.", null);
            return;
        }

        List<BillingFlowParams.ProductDetailsParams> productDetailsParamsList = new ArrayList<>();
        BillingFlowParams.ProductDetailsParams.Builder builder = BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(details);

        if (BillingClient.ProductType.SUBS.equals(type)) {
            List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
            if (offers != null && !offers.isEmpty()) {
                builder.setOfferToken(offers.get(0).getOfferToken());
            }
        }

        productDetailsParamsList.add(builder.build());

        BillingFlowParams billingFlowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(productDetailsParamsList)
                .setObfuscatedAccountId(accountId)
                .build();

        BillingResult result = billingClient.launchBillingFlow(activity, billingFlowParams);
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            notifyPurchaseResult(reqId, false, result.getDebugMessage(), null);
        }
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, List<Purchase> purchases) {
        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase purchase : purchases) {
                handlePurchase(purchase);
            }
        } else if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            notifyPurchaseResult(currentReqId, false, "Purchase cancelled by user", null);
        } else {
            notifyPurchaseResult(currentReqId, false, billingResult.getDebugMessage(), null);
        }
    }

    private void handlePurchase(Purchase purchase) {
        if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
            if (!purchase.isAcknowledged()) {
                AcknowledgePurchaseParams acknowledgePurchaseParams = AcknowledgePurchaseParams.newBuilder()
                        .setPurchaseToken(purchase.getPurchaseToken())
                        .build();

                billingClient.acknowledgePurchase(acknowledgePurchaseParams, billingResult -> {
                    if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        Log.d(TAG, "Purchase acknowledged: " + purchase.getOrderId());
                        notifyPurchaseResult(currentReqId, true, "Success", purchase);
                    } else {
                        Log.e(TAG, "Failed to acknowledge purchase: " + billingResult.getDebugMessage());
                    }
                });
            } else {
                notifyPurchaseResult(currentReqId, true, "Already acknowledged", purchase);
            }
        }
    }

    public void restorePurchases(String reqId) {
        billingClient.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
                (billingResult, purchases) -> {
                    boolean hasActivePro = false;
                    String activeOrderId = "";
                    if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
                        for (Purchase p : purchases) {
                            if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                hasActivePro = true;
                                activeOrderId = p.getOrderId();
                                break;
                            }
                        }
                    }
                    notifyPurchaseResult(reqId, hasActivePro, hasActivePro ? "Restored" : "No active subscription found", null);
                });
    }

    public void queryProducts(String reqId) {
        try {
            JSONArray arr = new JSONArray();
            for (ProductDetails details : cachedProductDetails.values()) {
                JSONObject obj = new JSONObject();
                obj.put("productId", details.getProductId());
                obj.put("title", details.getTitle());
                obj.put("description", details.getDescription());
                if (details.getOneTimePurchaseOfferDetails() != null) {
                    obj.put("formattedPrice", details.getOneTimePurchaseOfferDetails().getFormattedPrice());
                    obj.put("priceCurrencyCode", details.getOneTimePurchaseOfferDetails().getPriceCurrencyCode());
                } else if (details.getSubscriptionOfferDetails() != null && !details.getSubscriptionOfferDetails().isEmpty()) {
                    ProductDetails.SubscriptionOfferDetails offer = details.getSubscriptionOfferDetails().get(0);
                    if (!offer.getPricingPhases().getPricingPhaseList().isEmpty()) {
                        ProductDetails.PricingPhase phase = offer.getPricingPhases().getPricingPhaseList().get(0);
                        obj.put("formattedPrice", phase.getFormattedPrice());
                        obj.put("priceCurrencyCode", phase.getPriceCurrencyCode());
                    }
                }
                arr.put(obj);
            }

            final String jsonResult = arr.toString();
            webView.post(() -> webView.evaluateJavascript(
                    "if(window.onPlayProductsResult){window.onPlayProductsResult('" + jsonResult + "');}", null));
        } catch (Exception e) {
            Log.e(TAG, "Error formatting products query", e);
        }
    }

    private void notifyPurchaseResult(String reqId, boolean success, String message, Purchase purchase) {
        try {
            JSONObject obj = new JSONObject();
            obj.put("reqId", reqId);
            obj.put("success", success);
            obj.put("message", message);
            if (purchase != null) {
                obj.put("orderId", purchase.getOrderId());
                obj.put("purchaseTime", purchase.getPurchaseTime());
                obj.put("purchaseToken", purchase.getPurchaseToken());
            }
            final String jsonStr = obj.toString();
            webView.post(() -> webView.evaluateJavascript(
                    "if(window.onPlayBillingPurchaseResult){window.onPlayBillingPurchaseResult('" + jsonStr + "');}", null));
        } catch (Exception e) {
            Log.e(TAG, "Failed to send purchase result to webview", e);
        }
    }

    public void destroy() {
        if (billingClient != null) {
            billingClient.endConnection();
        }
    }
}
