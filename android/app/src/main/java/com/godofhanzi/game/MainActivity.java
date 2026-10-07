package com.godofhanzi.game;

import android.app.*;
import android.os.*;
import android.content.*;
import android.content.pm.*;
import android.net.Uri;
import android.provider.Settings;
import android.webkit.*;
import android.widget.Toast;
import android.widget.FrameLayout;
import androidx.core.view.WindowCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.core.content.FileProvider;
import org.json.*;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;

public class MainActivity extends Activity {
    private static final String ORIGIN = "appassets.androidplatform.net";
    private static final String REPO = "https://api.github.com/repos/tyrantqiao/GodOfHanzi/releases/latest";
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private WebView web;
    private File pendingApk;
    private boolean waitingPermission;
    private boolean alive = true;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        FrameLayout container = new FrameLayout(this);
        container.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(container);
        WindowCompat.getInsetsController(getWindow(), container).setAppearanceLightStatusBars(true);
        WindowCompat.getInsetsController(getWindow(), container).setAppearanceLightNavigationBars(true);
        container.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setTitle("汉字成圣").setMessage(message)
                    .setPositiveButton("确认", (dialog, which) -> result.confirm())
                    .setNegativeButton("取消", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
        });
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"https".equals(uri.getScheme()) || !ORIGIN.equals(uri.getHost()) || uri.getPath().startsWith("/api/")) {
                    return new WebResourceResponse("text/plain", "UTF-8", 503, "Offline", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
                }
                WebResourceResponse response = loader.shouldInterceptRequest(uri);
                return response != null ? response : new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !"https".equals(request.getUrl().getScheme()) || !ORIGIN.equals(request.getUrl().getHost());
            }
        });
        web.loadUrl("https://" + ORIGIN + "/index.html");
        worker.execute(this::checkUpdate);
    }

    private void ui(Runnable action) { runOnUiThread(() -> { if (alive && !isFinishing()) action.run(); }); }
    private void notice(String text) { ui(() -> Toast.makeText(this, text, Toast.LENGTH_LONG).show()); }
    private HttpURLConnection connection(String url) throws Exception {
        URI uri = URI.create(url);
        String host = uri.getHost();
        if (!"https".equals(uri.getScheme()) || host == null || !(host.equals("api.github.com") || host.equals("github.com") || host.endsWith(".githubusercontent.com"))) throw new IOException("更新地址无效");
        HttpURLConnection conn = (HttpURLConnection) uri.toURL().openConnection();
        conn.setConnectTimeout(15000); conn.setReadTimeout(30000);
        conn.setRequestProperty("User-Agent", "GodOfHanzi-Android");
        return conn;
    }
    private byte[] read(String url, int limit) throws Exception {
        HttpURLConnection conn = connection(url);
        try {
            if (conn.getResponseCode() != 200) throw new IOException("更新服务暂不可用");
            try (InputStream input = conn.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192]; int count;
                while ((count = input.read(buffer)) != -1) { if (output.size() + count > limit) throw new IOException("更新信息过大"); output.write(buffer, 0, count); }
                return output.toByteArray();
            }
        } finally { conn.disconnect(); }
    }
    private String asset(JSONArray assets, String name) throws Exception {
        for (int i = 0; i < assets.length(); i++) { JSONObject a = assets.getJSONObject(i); if (name.equals(a.getString("name"))) return a.getString("browser_download_url"); }
        throw new IOException("缺少安卓更新文件");
    }
    private void checkUpdate() {
        try {
            JSONObject release = new JSONObject(new String(read(REPO, 1024 * 1024), "UTF-8"));
            if (release.optBoolean("draft") || release.optBoolean("prerelease")) return;
            JSONArray assets = release.getJSONArray("assets");
            JSONObject manifest = new JSONObject(new String(read(asset(assets, "android-update.json"), 16384), "UTF-8"));
            long installed = getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode();
            long code = manifest.getLong("versionCode");
            if (code <= installed) return;
            String hash = manifest.getString("sha256");
            if (!hash.matches("[0-9a-f]{64}")) throw new IOException("校验信息无效");
            notice("发现新版本 " + manifest.getString("versionName") + "，正在后台下载");
            File dir = new File(getCacheDir(), "updates"); if (!dir.exists() && !dir.mkdirs()) throw new IOException("无法创建更新目录");
            File temporary = new File(dir, "update.part");
            HttpURLConnection conn = connection(asset(assets, "GodOfHanzi.apk"));
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try {
                if (conn.getResponseCode() != 200) throw new IOException("下载失败");
                try (InputStream input = conn.getInputStream(); OutputStream output = new FileOutputStream(temporary)) {
                    byte[] buffer = new byte[65536]; int count; long total = 0;
                    while ((count = input.read(buffer)) != -1) { total += count; if (total > 250L * 1024 * 1024) throw new IOException("更新包过大"); digest.update(buffer, 0, count); output.write(buffer, 0, count); }
                }
            } finally { conn.disconnect(); }
            StringBuilder actual = new StringBuilder(); for (byte b : digest.digest()) actual.append(String.format(Locale.ROOT, "%02x", b & 255));
            if (!hash.equals(actual.toString())) { temporary.delete(); throw new IOException("更新包校验失败"); }
            PackageManager pm = getPackageManager();
            PackageInfo archive = pm.getPackageArchiveInfo(temporary.getAbsolutePath(), PackageManager.GET_SIGNING_CERTIFICATES);
            PackageInfo current = pm.getPackageInfo(getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
            if (archive == null || !getPackageName().equals(archive.packageName) || archive.getLongVersionCode() != code || archive.signingInfo == null || !Arrays.equals(archive.signingInfo.getApkContentsSigners(), current.signingInfo.getApkContentsSigners())) {
                temporary.delete(); throw new IOException("更新包签名或版本不符");
            }
            File apk = new File(dir, "update.apk"); if (apk.exists() && !apk.delete()) throw new IOException("无法替换旧更新包");
            if (!temporary.renameTo(apk)) throw new IOException("无法保存更新包");
            ui(() -> { pendingApk = apk; new AlertDialog.Builder(this).setTitle("新版本已下载")
                .setMessage("安装更新将关闭游戏。请先使用游戏内“保存”按钮保存进度，覆盖安装会保留存档。")
                .setPositiveButton("安装更新", (dialog, which) -> installUpdate())
                .setNegativeButton("稍后", null).show(); });
        } catch (Exception error) { notice("未能完成更新检查，可继续离线游玩；下次启动重试"); }
    }
    private void installUpdate() {
        if (pendingApk == null) return;
        try {
            if (!getPackageManager().canRequestPackageInstalls()) {
                waitingPermission = true;
                startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
                return;
            }
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".updates", pendingApk);
            Intent install = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive");
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION); startActivity(install);
        } catch (Exception error) { notice("无法打开安装器，请稍后重启应用再试"); }
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); if (waitingPermission) { waitingPermission = false; if (getPackageManager().canRequestPackageInstalls()) installUpdate(); else notice("未开启安装权限，游戏仍可正常游玩"); } }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else new AlertDialog.Builder(this).setMessage("请确认已保存进度，再离开试炼。").setPositiveButton("离开", (d, w) -> finish()).setNegativeButton("继续游玩", null).show(); }
    @Override protected void onDestroy() { alive = false; worker.shutdownNow(); web.destroy(); super.onDestroy(); }
}


