package com.godofhanzi.game;

import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.atomic.*;

public final class UpdateDownloadTest {
    private static final byte[] DATA = new byte[180000];
    static { new Random(8).nextBytes(DATA); }
    private static void check(boolean ok, String message) { if (!ok) throw new AssertionError(message); }
    private static HttpURLConnection response(int status, byte[] body, long length, String range) throws Exception {
        return new HttpURLConnection(new URL("https://example.invalid/update.apk")) {
            public int getResponseCode() { return status; }
            public long getContentLengthLong() { return length; }
            public String getHeaderField(String key) { return "Content-Range".equals(key) ? range : null; }
            public InputStream getInputStream() { return new ByteArrayInputStream(body); }
            public void disconnect() {} public boolean usingProxy() { return false; } public void connect() {}
        };
    }
    private static void same(File part) throws Exception { check(Arrays.equals(Files.readAllBytes(part.toPath()), DATA), "完整文件内容错误"); }
    private static void rejected(File part, long size, UpdateDownload.Connection factory) throws Exception {
        try { UpdateDownload.download(part, size, factory, () -> false, (d,t) -> {}); throw new AssertionError("应拒绝无效响应"); }
        catch (IOException expected) { }
    }
    public static void main(String[] args) throws Exception {
        File part = Files.createTempFile("hanzi-update-test", ".part").toFile();
        try {
            AtomicBoolean paused = new AtomicBoolean();
            try {
                UpdateDownload.download(part, DATA.length, offset -> response(200, DATA, DATA.length, null), paused::get, (d,t) -> { if (d >= 65536) paused.set(true); });
                throw new AssertionError("应暂停");
            } catch (UpdateDownload.Paused expected) { }
            long saved = part.length(); check(saved > 0 && saved < DATA.length, "暂停后应保留部分数据");
            UpdateDownload.download(part, DATA.length, offset -> {
                check(offset == saved, "必须从已有文件断点请求");
                return response(206, Arrays.copyOfRange(DATA, (int)offset, DATA.length), DATA.length-offset, "bytes " + offset + "-" + (DATA.length-1) + "/" + DATA.length);
            }, () -> false, (d,t) -> {}); same(part);
            Files.write(part.toPath(), Arrays.copyOf(DATA, 123));
            UpdateDownload.download(part, -1, offset -> response(200, DATA, DATA.length, null), () -> false, (d,t) -> {}); same(part);
            Files.write(part.toPath(), Arrays.copyOf(DATA, 123));
            rejected(part, DATA.length, offset -> response(206, DATA, DATA.length, "bytes 0-179999/180000"));
            check(part.length() == 123, "错误范围不得破坏断点");
            rejected(part, DATA.length, offset -> response(206, new byte[3], 3, "bytes 123-125/999999"));
            rejected(part, DATA.length, offset -> response(206, new byte[3], 3, null));
            UpdateDownload.download(part, DATA.length, offset -> offset > 0 ? response(416, new byte[0], 0, null) : response(200, DATA, DATA.length, null), () -> false, (d,t) -> {}); same(part);
            Files.write(part.toPath(), new byte[0]);
            rejected(part, DATA.length, offset -> response(200, Arrays.copyOf(DATA, 80000), DATA.length, null));
            check(part.length() == 80000, "网络中断应保留下载数据");
            UpdateDownload.download(part, DATA.length, offset -> response(206, Arrays.copyOfRange(DATA, (int)offset, DATA.length), DATA.length-offset, "bytes " + offset + "-179999/180000"), () -> false, (d,t) -> {}); same(part);
            Files.write(part.toPath(), Arrays.copyOf(DATA, 123));
            UpdateDownload.download(part, -1, offset -> response(206, Arrays.copyOfRange(DATA, (int)offset, DATA.length), -1, "bytes " + offset + "-179999/180000"), () -> false, (d,t) -> {}); same(part);
            AtomicBoolean opened = new AtomicBoolean();
            UpdateDownload.download(part, DATA.length, offset -> { opened.set(true); throw new IOException(); }, () -> false, (d,t) -> {});
            check(!opened.get(), "已完整下载不应再次请求");
            rejected(part, UpdateDownload.MAX_SIZE + 1, offset -> response(200, DATA, DATA.length, null));
            System.out.println("断点下载验证通过：暂停恢复、200回退、错误范围、416重试、网络中断、完整包复用、大小限制。");
        } finally { Files.deleteIfExists(part.toPath()); }
    }
}
