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
    private File pendingApk;
    private boolean waitingPermission;
    private volatile boolean alive = true;
    private final java.util.concurrent.atomic.AtomicBoolean checkingUpdate = new java.util.concurrent.atomic.AtomicBoolean();
    private String updateMessage = "安卓安装版支持在线检测更新。";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowManager.LayoutParams attributes = getWindow().getAttributes();
        attributes.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30
            ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        getWindow().setAttributes(attributes);
        web = new WebView(this);
        FrameLayout container = new FrameLayout(this);
        container.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(container);
        enterImmersiveMode();
        // 原生层只避让挖孔与手势边缘，系统栏临时出现时不挤压棋盘。
        ViewCompat.setOnApplyWindowInsetsListener(container, (view, insets) -> {
            androidx.core.graphics.Insets safe = insets.getInsets(WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.mandatorySystemGestures());
            view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
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
            @Override public void onPageFinished(WebView view, String url) { updateStatus(updateMessage, checkingUpdate.get()); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !"https".equals(request.getUrl().getScheme()) || !ORIGIN.equals(request.getUrl().getHost());
            }
        });
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface public void checkUpdate() { requestUpdate(); }
        }, "HanziAndroid");
        web.loadUrl("https://" + ORIGIN + "/index.html");
        requestUpdate();
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
    private void updateStatus(String message, boolean busy) {
        ui(() -> {
            updateMessage = message;
            web.evaluateJavascript("window.dispatchEvent(new CustomEvent('hanzi-update',{detail:{message:"
                + JSONObject.quote(message) + ",busy:" + busy + "}}))", null);
        });
    }
    private void requestUpdate() {
        if (!alive || !checkingUpdate.compareAndSet(false, true)) return;
        updateStatus("正在检测新版本……", true);
        worker.execute(this::checkUpdate);
    }
    private HttpURLConnection connection(String url) throws Exception {
        // 发布资产会跳转到下载域名；每次跳转均验证 HTTPS 与来源。
        for (int redirects = 0; redirects < 6; redirects++) {
            URI uri = URI.create(url);
            String host = uri.getHost();
            if (!"https".equals(uri.getScheme()) || host == null || !(host.equals("github.com") || host.endsWith(".githubusercontent.com"))) throw new IOException("更新地址无效");
            HttpURLConnection conn = (HttpURLConnection) uri.toURL().openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(15000); conn.setReadTimeout(30000);
            conn.setRequestProperty("User-Agent", "GodOfHanzi-Android");
            int status = conn.getResponseCode();
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
            long installed = getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode();
            long code = manifest.getLong("versionCode");
            if (code <= installed) { updateStatus("已是最新版本 " + getPackageManager().getPackageInfo(getPackageName(), 0).versionName, false); return; }
            String hash = manifest.getString("sha256");
            if (!hash.matches("[0-9a-f]{64}")) throw new IOException("校验信息无效");
            updateStatus("发现新版本 " + manifest.getString("versionName") + "，正在后台下载……", true);
            File dir = new File(getCacheDir(), "updates"); if (!dir.exists() && !dir.mkdirs()) throw new IOException("无法创建更新目录");
            File temporary = new File(dir, "update.part");
            HttpURLConnection conn = connection(RELEASE + "GodOfHanzi.apk");
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
            updateStatus("新版本已下载，安装前请保存试炼进度。", false);
            ui(() -> { pendingApk = apk; new AlertDialog.Builder(this).setTitle("新版本已下载")
                .setMessage("安装更新将关闭游戏。请先使用游戏内“保存”按钮保存进度，覆盖安装会保留存档。")
                .setPositiveButton("安装更新", (dialog, which) -> installUpdate())
                .setNegativeButton("稍后", null).show(); });
        } catch (Exception error) {
            updateStatus("检测更新失败：" + (error instanceof IOException ? error.getMessage() : "更新信息无法解析或验证") + "。请检查网络后重试。", false);
        } finally { checkingUpdate.set(false); }
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
    // 返回键先收起游戏弹窗，再处理页面返回或离开试炼。
    @Override public void onBackPressed() {
        web.evaluateJavascript("(() => { const dialogs = [...document.querySelectorAll('dialog[open]')]; const dialog = dialogs.at(-1); if (!dialog) return false; dialog.close(); return true; })()", value -> {
            if ("true".equals(value)) return;
            if (web.canGoBack()) web.goBack();
            else new AlertDialog.Builder(this).setMessage("请确认已保存进度，再离开试炼。").setPositiveButton("离开", (d, w) -> finish()).setNegativeButton("继续游玩", null).show();
        });
    }
    @Override protected void onDestroy() { alive = false; worker.shutdownNow(); web.destroy(); super.onDestroy(); }
}


