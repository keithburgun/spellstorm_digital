package com.spellstorm.game;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * In-app updates for the sideloaded (itch.io / GitHub) Android build: downloads the new APK from the
 * Spellstorm GitHub release and hands it to Android's installer, which asks the player to confirm.
 * Only release files from Spellstorm's own GitHub repository are accepted.
 * (A Google Play build must not include this; Play updates the app itself.)
 */
@CapacitorPlugin(name = "SpellstormUpdater")
public class UpdaterPlugin extends Plugin {
    private static final String ALLOWED = "https://github.com/keithburgun/spellstorm_digital/releases/download/";

    @PluginMethod
    public void downloadAndInstall(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null || !url.startsWith(ALLOWED) || !url.endsWith(".apk")) { call.reject("That isn't a Spellstorm update."); return; }
        new Thread(new Runnable() { public void run() {
            HttpURLConnection c = null;
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("no space for the download");
                File[] old = dir.listFiles(); if (old != null) for (File f : old) f.delete();
                File part = new File(dir, "Spellstorm-update.part"), apk = new File(dir, "Spellstorm-update.apk");
                URL u = new URL(url); int hops = 0;
                while (true) {   // GitHub sends release downloads through a redirect to its file servers
                    c = (HttpURLConnection) u.openConnection(); c.setInstanceFollowRedirects(false);
                    c.setConnectTimeout(20000); c.setReadTimeout(30000); c.setRequestProperty("User-Agent", "Spellstorm-Android");
                    int code = c.getResponseCode();
                    if (code >= 300 && code < 400 && hops++ < 5) { String loc = c.getHeaderField("Location"); c.disconnect(); u = new URL(u, loc);
                        if (!"https".equals(u.getProtocol())) throw new Exception("insecure redirect"); continue; }
                    if (code != 200) throw new Exception("server said " + code);
                    break;
                }
                int total = c.getContentLength(); long got = 0; int lastPct = -1;
                InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(part);
                byte[] buf = new byte[65536]; int n;
                try {
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n); got += n;
                        if (total > 0) { int pct = (int) (got * 100 / total); if (pct != lastPct) { lastPct = pct; JSObject p = new JSObject(); p.put("pct", pct); notifyListeners("progress", p); } }
                    }
                } finally { out.close(); in.close(); }
                if (total > 0 && got != total) throw new Exception("the download was cut off");
                if (!part.renameTo(apk)) throw new Exception("couldn't save the download");
                final Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                final Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, "application/vnd.android.package-archive");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().runOnUiThread(new Runnable() { public void run() {
                    try { getContext().startActivity(i); call.resolve(); } catch (Exception e) { call.reject("Couldn't open the installer: " + e.getMessage()); }
                } });
            } catch (Exception e) {
                call.reject("Download failed: " + e.getMessage());
            } finally { if (c != null) c.disconnect(); }
        } }).start();
    }
}
