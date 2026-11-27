package com.phaindia.mes;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Handle hardware Back button inside SPA history gracefully before exiting
        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                    if (webView != null && webView.canGoBack()) {
                        webView.goBack();
                    } else {
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                    }
                }
            }
        );

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            WebSettings settings = webView.getSettings();
            settings.setDomStorageEnabled(true);
            settings.setSupportZoom(false);

            // Route external links (WhatsApp Manual Fallback, mailto, tel) to native Android apps
            webView.setWebViewClient(
                new BridgeWebViewClient(getBridge()) {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                        Uri uri = request != null ? request.getUrl() : null;
                        if (uri != null && handleExternalUri(uri)) {
                            return true;
                        }
                        return super.shouldOverrideUrlLoading(view, request);
                    }
                }
            );

            // Support exporting CSV/text reports cleanly on Android
            webView.setDownloadListener(
                new DownloadListener() {
                    @Override
                    public void onDownloadStart(
                        String url,
                        String userAgent,
                        String contentDisposition,
                        String mimeType,
                        long contentLength
                    ) {
                        if (url != null && url.startsWith("data:")) {
                            shareInlineDataFile(url, contentDisposition, mimeType);
                        } else if (url != null) {
                            handleExternalUri(Uri.parse(url));
                        }
                    }
                }
            );
        }
    }

    private boolean handleExternalUri(Uri uri) {
        String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase() : "";
        String host = uri.getHost() != null ? uri.getHost().toLowerCase() : "";
        boolean isWhatsApp =
            "whatsapp".equals(scheme) ||
            host.contains("wa.me") ||
            host.contains("whatsapp.com");
        boolean isExternalScheme = "mailto".equals(scheme) || "tel".equals(scheme);

        if (isWhatsApp || isExternalScheme) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(intent);
                return true;
            } catch (ActivityNotFoundException e) {
                Toast.makeText(this, "No compatible app found on device for " + scheme, Toast.LENGTH_SHORT).show();
                return true;
            }
        }
        return false;
    }

    private void shareInlineDataFile(String dataUrl, String contentDisposition, String mimeType) {
        try {
            int commaIdx = dataUrl.indexOf(',');
            if (commaIdx < 0) return;
            String body = Uri.decode(dataUrl.substring(commaIdx + 1));
            String fileName = URLUtil.guessFileName(dataUrl, contentDisposition, mimeType);
            if (fileName == null || fileName.trim().isEmpty()) {
                fileName = "pha_india_report.csv";
            }
            File outFile = new File(getCacheDir(), fileName);
            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                fos.write(body.getBytes(StandardCharsets.UTF_8));
            }
            Uri fileUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", outFile);
            Intent share = new Intent(Intent.ACTION_SEND);
            share.setType(mimeType != null && !mimeType.isEmpty() ? mimeType : "text/csv");
            share.putExtra(Intent.EXTRA_STREAM, fileUri);
            share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(share, "Export " + fileName));
        } catch (Exception e) {
            Toast.makeText(this, "Unable to export file on device.", Toast.LENGTH_SHORT).show();
        }
    }
}
