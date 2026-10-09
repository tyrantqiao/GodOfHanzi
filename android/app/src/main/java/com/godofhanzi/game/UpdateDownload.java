package com.godofhanzi.game;

import java.io.*;
import java.net.HttpURLConnection;
import java.util.regex.*;

/** 与界面无关的断点下载；完成后的哈希与签名仍由安装流程验证。 */
public final class UpdateDownload {
    public static final long MAX_SIZE = 250L * 1024 * 1024;
    public interface Connection { HttpURLConnection open(long offset) throws Exception; }
    public interface Progress { void changed(long done, long total); }
    public interface Cancellation { boolean stopped(); }
    public static final class Paused extends IOException { public Paused() { super("下载已暂停"); } }
    public static void download(File part, long expected, Connection factory, Cancellation cancel, Progress progress) throws Exception {
        if (expected == 0 || expected > MAX_SIZE || expected < -1) throw new IOException("更新包大小无效");
        long offset = part.isFile() ? part.length() : 0;
        if (offset > MAX_SIZE || (expected > 0 && offset > expected)) { clear(part); offset = 0; }
        if (cancel.stopped()) throw new Paused();
        if (expected > 0 && offset == expected) { progress.changed(offset, expected); return; }
        HttpURLConnection conn = factory.open(offset);
        try {
            int status = conn.getResponseCode();
            // 旧断点超出服务端文件时重新下载，不把错误页面追加到安装包。
            if (status == 416 && offset > 0) {
                conn.disconnect(); clear(part); offset = 0; conn = factory.open(0); status = conn.getResponseCode();
            }
            long total = expected, responseLength = conn.getContentLengthLong();
            if (status == 206) {
                Matcher range = Pattern.compile("bytes (\\d+)-(\\d+)/(\\d+)").matcher(String.valueOf(conn.getHeaderField("Content-Range")));
                if (!range.matches()) throw new IOException("断点响应缺少有效范围");
                long start = Long.parseLong(range.group(1)), end = Long.parseLong(range.group(2)), size = Long.parseLong(range.group(3));
                if (start != offset || end < start || size <= end || size > MAX_SIZE || (expected > 0 && size != expected)
                        || (responseLength >= 0 && responseLength != end - start + 1)) throw new IOException("断点响应范围不符");
                total = size;
            } else if (status == 200) {
                // 服务端不支持 Range 时安全从头下载，避免新旧内容拼接。
                offset = 0;
                if (responseLength > MAX_SIZE || (expected > 0 && responseLength >= 0 && responseLength != expected)) throw new IOException("更新包大小不符");
                if (total < 0 && responseLength >= 0) total = responseLength;
            } else throw new IOException("下载服务返回 HTTP " + status);
            long done = offset, received = 0;
            progress.changed(done, total);
            try (InputStream input = conn.getInputStream(); FileOutputStream output = new FileOutputStream(part, status == 206 && offset > 0)) {
                byte[] buffer = new byte[65536]; int count;
                while (true) {
                    if (cancel.stopped() || Thread.currentThread().isInterrupted()) throw new Paused();
                    count = input.read(buffer); if (count == -1) break;
                    if (cancel.stopped() || Thread.currentThread().isInterrupted()) throw new Paused();
                    done += count; received += count;
                    if (done > MAX_SIZE || (total >= 0 && done > total)) { output.getFD().sync(); throw new IOException("更新包超出大小限制"); }
                    output.write(buffer, 0, count); progress.changed(done, total);
                }
                output.getFD().sync();
            }
            if ((total >= 0 && done != total) || (responseLength >= 0 && received != responseLength)) throw new IOException("下载中断，可继续下载");
        } finally { conn.disconnect(); }
    }
    public static void clear(File file) throws IOException { if (file.exists() && !file.delete()) throw new IOException("无法清理旧更新包"); }
}
