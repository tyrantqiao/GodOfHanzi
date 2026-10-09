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
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.view.ViewCompat;
import android.view.WindowManager;
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
    private static final String RELEASE = "https://github.com/tyrantqiao/GodOfHanzi/releases/latest/download/";
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private WebView web;
    private androidx.core.graphics.Insets safeInsets = androidx.core.graphics.Insets.NONE;
    private volatile File pendingApk;
    private boolean waitingPermission;
    private volatile boolean pauseDownload;
    private volatile HttpURLConnection activeDownload;
    private volatile JSONObject updateRelease;
    private volatile String updateState = "idle";
    private volatile long updateDone, updateTotal = -1;
    private long lastProgressTime;
    private volatile boolean alive = true;
    private final java.util.concurrent.atomic.AtomicBoolean checkingUpdate = new java.util.concurrent.atomic.AtomicBoolean();
    private volatile String updateMessage = "安卓安装版支持在线检测更新。";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowManager.LayoutParams attributes = getWindow().getAttributes();
        attributes.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30
            ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        getWindow().setAttributes(attributes);
        web = new WebView(this);
        web.setBackgroundColor(android.graphics.Color.rgb(21, 46, 50));
        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(android.graphics.Color.rgb(21, 46, 50));
        container.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(container);
        enterImmersiveMode();
        // 背景延伸到屏幕边缘，安全区传给网页，仅避让操作内容。
        ViewCompat.setOnApplyWindowInsetsListener(container, (view, insets) -> {
            androidx.core.graphics.Insets safe = insets.getInsets(WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.mandatorySystemGestures());
            safeInsets = safe;
            applySafeInsets();
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(container);
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
            @Override public void onPageFinished(WebView view, String url) { applySafeInsets(); publishUpdate(); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !"https".equals(request.getUrl().getScheme()) || !ORIGIN.equals(request.getUrl().getHost());
            }
        });
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface public void checkUpdate() { requestUpdate(); }
            @JavascriptInterface public void resumeUpdate() { ui(() -> requestDownload()); }
            @JavascriptInterface public void pauseUpdate() { pauseDownload = true; getSharedPreferences("hanzi.updates", MODE_PRIVATE).edit().putBoolean("paused", true).apply(); HttpURLConnection conn = activeDownload; if (conn != null) conn.disconnect(); }
            @JavascriptInterface public void installUpdate() { ui(() -> confirmInstall()); }
        }, "HanziAndroid");
        web.loadUrl("https://" + ORIGIN + "/index.html");
        restoreUpdate();
        requestUpdate();
    }

    private void applySafeInsets() {
        float density = getResources().getDisplayMetrics().density;
        String script = "(function(){var s=document.documentElement.style;";
        String[] edges = {"left", "top", "right", "bottom"};
        int[] values = {safeInsets.left, safeInsets.top, safeInsets.right, safeInsets.bottom};
        for (int i = 0; i < edges.length; i++) {
            script += "s.setProperty('--safe-" + edges[i] + "','" + (values[i] / density) + "px');";
        }
        web.evaluateJavascript(script + "})();", null);
    }

    private void ui(Runnable action) { runOnUiThread(() -> { if (alive && !isFinishing()) action.run(); }); }
    private void enterImmersiveMode() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) enterImmersiveMode();
    }
    private void notice(String text) { ui(() -> Toast.makeText(this, text, Toast.LENGTH_LONG).show()); }
    private File updateFile(String name) { return new File(new File(getFilesDir(), "updates"), name); }
    private void restoreUpdate() {
        try {
            JSONObject saved = new JSONObject(getSharedPreferences("hanzi.updates", MODE_PRIVATE).getString("release", "{}"));
            validateRelease(saved);
            if (saved.getLong("versionCode") <= getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode()) return;
            updateRelease = saved;
            pauseDownload = getSharedPreferences("hanzi.updates", MODE_PRIVATE).getBoolean("paused", false);
            updateDone = updateFile("update.part").length(); updateTotal = saved.optLong("size", -1);
            if (updateFile("update.apk").isFile()) { pendingApk = updateFile("update.apk"); updateDone = pendingApk.length(); updateTotal = updateDone; updateState = "ready"; updateMessage = "新版已下载，安装前会再次校验。"; }
            else { updateState = "paused"; updateMessage = "上次下载进度已保留，可继续下载。"; }
        } catch (Exception ignored) { }
    }
    private void publishUpdate() {
        ui(() -> {
            JSONObject detail = new JSONObject();
            try {
                detail.put("message", updateMessage); detail.put("busy", checkingUpdate.get());
                detail.put("state", updateState); detail.put("done", updateDone); detail.put("total", updateTotal);
                detail.put("versionName", updateRelease == null ? "" : updateRelease.optString("versionName"));
                detail.put("available", updateRelease != null);
            } catch (JSONException ignored) { }
            web.evaluateJavascript("window.dispatchEvent(new CustomEvent('hanzi-update',{detail:" + detail + "}))", null);
        });
    }
    private void updateStatus(String state, String message) {
        updateState = state; updateMessage = message; publishUpdate();
    }
    private void requestUpdate() {
        if (!alive || !checkingUpdate.compareAndSet(false, true)) return;
        updateStatus("checking", "正在检测新版本……");
        worker.execute(this::checkUpdate);
    }
    private void validateRelease(JSONObject info) throws Exception {
        if (info.getLong("versionCode") <= 0 || info.getString("versionName").isEmpty()
                || !info.getString("sha256").matches("[0-9a-f]{64}")) throw new IOException("更新信息无效");
        long size = info.optLong("size", -1);
        if (size == 0 || size < -1 || size > UpdateDownload.MAX_SIZE) throw new IOException("更新包大小无效");
    }
    private HttpURLConnection connection(String url) throws Exception { return connection(url, 0); }
    private HttpURLConnection connection(String url, long offset) throws Exception {
        // 发布资产会跳转到下载域名；每次跳转均验证 HTTPS 与来源，并传递断点。
        for (int redirects = 0; redirects < 6; redirects++) {
            URI uri = URI.create(url); String host = uri.getHost();
            if (!"https".equals(uri.getScheme()) || host == null || !(host.equals("github.com") || host.endsWith(".githubusercontent.com"))) throw new IOException("更新地址无效");
            HttpURLConnection conn = (HttpURLConnection) uri.toURL().openConnection();
            conn.setInstanceFollowRedirects(false); conn.setUseCaches(false);
            conn.setConnectTimeout(15000); conn.setReadTimeout(30000);
            conn.setRequestProperty("User-Agent", "GodOfHanzi-Android"); conn.setRequestProperty("Accept-Encoding", "identity");
            if (offset > 0) conn.setRequestProperty("Range", "bytes=" + offset + "-");
            int status;
            try { status = conn.getResponseCode(); } catch (Exception error) { conn.disconnect(); throw error; }
            if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                String location = conn.getHeaderField("Location"); conn.disconnect();
                if (location == null) throw new IOException("更新跳转地址缺失");
                url = uri.resolve(location).toString(); continue;
            }
            return conn;
        }
        throw new IOException("更新跳转次数过多");
    }
    private byte[] read(String url, int limit) throws Exception {
        HttpURLConnection conn = connection(url);
        try {
            if (conn.getResponseCode() != 200) throw new IOException("更新服务返回 HTTP " + conn.getResponseCode());
            try (InputStream input = conn.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192]; int count;
                while ((count = input.read(buffer)) != -1) { if (output.size() + count > limit) throw new IOException("更新信息过大"); output.write(buffer, 0, count); }
                return output.toByteArray();
            }
        } finally { conn.disconnect(); }
    }
    private void checkUpdate() {
        try {
            JSONObject manifest = new JSONObject(new String(read(RELEASE + "android-update.json", 16384), "UTF-8"));
            validateRelease(manifest);
            long installed = getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode();
            if (manifest.getLong("versionCode") <= installed) {
                UpdateDownload.clear(updateFile("update.part")); UpdateDownload.clear(updateFile("update.apk"));
                getSharedPreferences("hanzi.updates", MODE_PRIVATE).edit().clear().commit();
                updateRelease = null; pendingApk = null; updateDone = 0; updateTotal = -1;
                updateStatus("current", "已是最新版本 " + getPackageManager().getPackageInfo(getPackageName(), 0).versionName); return;
            }
            boolean same = updateRelease != null && updateRelease.getLong("versionCode") == manifest.getLong("versionCode")
                && updateRelease.getString("sha256").equals(manifest.getString("sha256"));
            if (!same) { UpdateDownload.clear(updateFile("update.part")); UpdateDownload.clear(updateFile("update.apk")); pendingApk = null; pauseDownload = false; }
            if (!getSharedPreferences("hanzi.updates", MODE_PRIVATE).edit().putString("release", manifest.toString()).putBoolean("paused", pauseDownload).commit()) throw new IOException("无法保存更新信息");
            updateRelease = manifest; updateDone = updateFile("update.part").length(); updateTotal = manifest.optLong("size", -1);
            if (updateFile("update.apk").isFile()) {
                verifyUpdate(updateFile("update.apk")); pendingApk = updateFile("update.apk"); updateDone = pendingApk.length(); updateTotal = updateDone;
                updateStatus("ready", "新版已下载，可安装更新。");
            } else if (pauseDownload) updateStatus("paused", "下载已暂停，进度已保留。");
            else downloadUpdate();
        } catch (Exception error) {
            updateStatus(pendingApk != null ? "ready" : "error", "检测更新失败：" + explainUpdate(error) + "。已有进度保留，可重试。");
        } finally { checkingUpdate.set(false); publishUpdate(); if ("ready".equals(updateState)) ui(this::confirmInstall); }
    }
    private String explainUpdate(Exception error) {
        return error instanceof IOException ? error.getMessage() : "更新信息无法解析或验证";
    }
    private void requestDownload() {
        if (!alive || updateRelease == null || !checkingUpdate.compareAndSet(false, true)) return;
        pauseDownload = false;
        if (!getSharedPreferences("hanzi.updates", MODE_PRIVATE).edit().putBoolean("paused", false).commit()) {
            checkingUpdate.set(false); updateStatus("error", "无法保存下载状态，请重试。"); return;
        }
        updateStatus("downloading", "正在继续下载……");
        worker.execute(() -> { try { downloadUpdate(); } finally { checkingUpdate.set(false); publishUpdate(); if ("ready".equals(updateState)) ui(this::confirmInstall); } });
    }
    private void downloadUpdate() {
        File part = updateFile("update.part");
        try {
            File dir = part.getParentFile(); if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("无法创建更新目录");
            updateStatus("downloading", "正在下载新版，可暂停后继续。");
            lastProgressTime = 0;
            UpdateDownload.download(part, updateRelease.optLong("size", -1), offset -> {
                HttpURLConnection conn = connection(RELEASE + "GodOfHanzi.apk", offset); activeDownload = conn; return conn;
            }, () -> pauseDownload || !alive, (done, total) -> {
                updateDone = done; updateTotal = total;
                long now = System.currentTimeMillis();
                if (now - lastProgressTime >= 250 || done == total) { lastProgressTime = now; publishUpdate(); }
            });
            if (pauseDownload || !alive) throw new UpdateDownload.Paused();
            updateStatus("verifying", "下载完成，正在校验安装包……");
            verifyUpdate(part);
            UpdateDownload.clear(updateFile("update.apk"));
            if (!part.renameTo(updateFile("update.apk"))) throw new IOException("无法保存更新包");
            pendingApk = updateFile("update.apk"); updateDone = pendingApk.length(); updateTotal = updateDone;
            updateStatus("ready", "新版已下载并校验，安装前请保存试炼进度。");

        } catch (Exception error) {
            updateDone = part.length();
            updateStatus(pauseDownload || !alive ? "paused" : "error", pauseDownload || !alive
                ? "下载已暂停，进度已保留。" : "下载未完成：" + explainUpdate(error) + "。点击继续下载。");
        } finally { activeDownload = null; }
    }
    private void verifyUpdate(File file) throws Exception {
        try {
            validateRelease(updateRelease);
            long size = updateRelease.optLong("size", -1), code = updateRelease.getLong("versionCode");
            if (!file.isFile() || file.length() == 0 || file.length() > UpdateDownload.MAX_SIZE || (size > 0 && file.length() != size)) throw new IOException("更新包大小不符");
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream input = new FileInputStream(file)) { byte[] buffer = new byte[65536]; int count; while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count); }
            StringBuilder actual = new StringBuilder(); for (byte b : digest.digest()) actual.append(String.format(Locale.ROOT, "%02x", b & 255));
            if (!updateRelease.getString("sha256").equals(actual.toString())) throw new IOException("更新包校验失败，请重新下载");
            PackageManager pm = getPackageManager();
            PackageInfo archive = pm.getPackageArchiveInfo(file.getAbsolutePath(), PackageManager.GET_SIGNING_CERTIFICATES);
            PackageInfo current = pm.getPackageInfo(getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
            if (code <= current.getLongVersionCode() || archive == null || !getPackageName().equals(archive.packageName)
                || archive.getLongVersionCode() != code || !updateRelease.getString("versionName").equals(archive.versionName)
                || archive.signingInfo == null || current.signingInfo == null
                || !Arrays.equals(archive.signingInfo.getApkContentsSigners(), current.signingInfo.getApkContentsSigners())) throw new IOException("更新包签名或版本不符");
        } catch (Exception error) { UpdateDownload.clear(file); if (file.equals(pendingApk)) pendingApk = null; throw error; }
    }
    private void confirmInstall() {
        if (pendingApk == null || checkingUpdate.get()) return;
        new AlertDialog.Builder(this).setTitle("新版本已下载")
            .setMessage("安装更新将关闭游戏。请先使用游戏内“保存”按钮保存进度，覆盖安装会保留存档。")
            .setPositiveButton("安装更新", (dialog, which) -> verifyForInstall())
            .setNegativeButton("稍后", null).show();
    }
    private void verifyForInstall() {
        if (pendingApk == null || !checkingUpdate.compareAndSet(false, true)) return;
        updateStatus("verifying", "正在校验安装包……");
        worker.execute(() -> {
            try { verifyUpdate(pendingApk); ui(this::installUpdate); updateStatus("ready", "请在系统页面确认安装，取消后可再次安装。"); }
            catch (Exception error) { pendingApk = null; updateDone = 0; updateStatus("error", "安装校验失败：" + explainUpdate(error)); }
            finally { checkingUpdate.set(false); publishUpdate(); }
        });
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
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); if (waitingPermission) { waitingPermission = false; if (getPackageManager().canRequestPackageInstalls()) verifyForInstall(); else notice("未开启安装权限，游戏仍可正常游玩"); } }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }
    // 返回键先收起游戏弹窗，再处理页面返回或离开试炼。
    @Override public void onBackPressed() {
        web.evaluateJavascript("(() => { const dialogs = [...document.querySelectorAll('dialog[open]')]; const dialog = dialogs.at(-1); if (!dialog) return false; dialog.close(); return true; })()", value -> {
            if ("true".equals(value)) return;
            if (web.canGoBack()) web.goBack();
            else new AlertDialog.Builder(this).setMessage("请确认已保存进度，再离开试炼。").setPositiveButton("离开", (d, w) -> finish()).setNegativeButton("继续游玩", null).show();
        });
    }
    @Override protected void onDestroy() { alive = false; pauseDownload = true; HttpURLConnection conn = activeDownload; if (conn != null) conn.disconnect(); worker.shutdownNow(); web.destroy(); super.onDestroy(); }
}
