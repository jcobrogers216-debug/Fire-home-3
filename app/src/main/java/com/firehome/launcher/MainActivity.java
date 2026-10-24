package com.firehome.launcher;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.util.LruCache;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * FireHome: a thin Android shell around the HTML screen in assets/.
 * The pretty part (tiles, wallpapers, weather) lives in index.html / style.css / app.js.
 * This class only does what a web page cannot: list installed apps, launch them,
 * hand over their icons, and read your own background photos.
 */
public class MainActivity extends Activity {

    private static final String HOST = "launcher.local";

    private WebView web;
    private File bgDir;
    private final LruCache<String, byte[]> iconCache = new LruCache<String, byte[]>(6 * 1024 * 1024) {
        @Override
        protected int sizeOf(String key, byte[] value) {
            return value.length;
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        bgDir = getExternalFilesDir("backgrounds");
        if (bgDir == null) {
            bgDir = new File(getFilesDir(), "backgrounds");
        }
        //noinspection ResultOfMethodCallIgnored
        bgDir.mkdirs();

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return intercept(request.getUrl());
            }
        });
        web.loadUrl("https://" + HOST + "/index.html");
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.resumeTimers();
        js("window.FH && window.FH.refresh()");
    }

    @Override
    protected void onPause() {
        web.onPause();
        web.pauseTimers();
        super.onPause();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Home button pressed while we are already showing: go back to the top.
        js("window.FH && window.FH.home()");
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int code = e.getKeyCode();
        if (code == KeyEvent.KEYCODE_BACK) {
            if (e.getAction() == KeyEvent.ACTION_UP) {
                js("window.FH && window.FH.back()");
            }
            return true; // a launcher never closes itself
        }
        if (code == KeyEvent.KEYCODE_MENU) {
            if (e.getAction() == KeyEvent.ACTION_UP) {
                js("window.FH && window.FH.menu()");
            }
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    @Override
    public void onBackPressed() {
        // handled in dispatchKeyEvent
    }

    private void js(String code) {
        if (web != null) {
            web.evaluateJavascript(code, null);
        }
    }

    /* ------------------------------------------------------------ serving the page, icons and photos */

    private WebResourceResponse intercept(Uri uri) {
        if (uri == null || !HOST.equals(uri.getHost())) {
            return null; // normal network request (weather etc.)
        }
        String path = uri.getPath();
        if (path == null || path.equals("/")) {
            path = "/index.html";
        }
        try {
            if (path.startsWith("/icon/")) {
                return image(path.substring(6), false);
            }
            if (path.startsWith("/banner/")) {
                return image(path.substring(8), true);
            }
            if (path.startsWith("/bg/")) {
                return photo(path.substring(4));
            }
            return asset(path.substring(1));
        } catch (Throwable t) {
            return reply("text/plain", new byte[0], 404, "Not Found");
        }
    }

    private WebResourceResponse reply(String mime, byte[] data, int status, String reason) {
        Map<String, String> headers = new HashMap<String, String>();
        headers.put("Access-Control-Allow-Origin", "*");
        return new WebResourceResponse(mime, "UTF-8", status, reason, headers, new ByteArrayInputStream(data));
    }

    private WebResourceResponse asset(String name) throws Exception {
        InputStream in = getAssets().open(name);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) {
            out.write(buf, 0, n);
        }
        in.close();
        String lower = name.toLowerCase(Locale.US);
        String mime = "application/octet-stream";
        if (lower.endsWith(".html")) mime = "text/html";
        else if (lower.endsWith(".js")) mime = "application/javascript";
        else if (lower.endsWith(".css")) mime = "text/css";
        else if (lower.endsWith(".json")) mime = "application/json";
        else if (lower.endsWith(".png")) mime = "image/png";
        else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mime = "image/jpeg";
        else if (lower.endsWith(".svg")) mime = "image/svg+xml";
        return reply(mime, out.toByteArray(), 200, "OK");
    }

    private Intent launchIntent(String pkg) {
        PackageManager pm = getPackageManager();
        Intent i = pm.getLeanbackLaunchIntentForPackage(pkg);
        if (i == null) {
            i = pm.getLaunchIntentForPackage(pkg);
        }
        return i;
    }

    private WebResourceResponse image(String pkg, boolean banner) throws Exception {
        String key = (banner ? "b:" : "i:") + pkg;
        byte[] png = iconCache.get(key);
        if (png == null) {
            PackageManager pm = getPackageManager();
            Intent li = launchIntent(pkg);
            Drawable d = null;
            try {
                if (banner) {
                    if (li != null) d = pm.getActivityBanner(li);
                    if (d == null) d = pm.getApplicationBanner(pkg);
                } else {
                    if (li != null) d = pm.getActivityIcon(li);
                    if (d == null) d = pm.getApplicationIcon(pkg);
                }
            } catch (PackageManager.NameNotFoundException e) {
                d = null;
            }
            if (d == null) {
                return reply("text/plain", new byte[0], 404, "Not Found");
            }
            int w = banner ? 320 : 192;
            int h = banner ? 180 : 192;
            Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(bmp);
            d.setBounds(0, 0, w, h);
            d.draw(c);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.PNG, 100, out);
            bmp.recycle();
            png = out.toByteArray();
            iconCache.put(key, png);
        }
        return reply("image/png", png, 200, "OK");
    }

    /** Your own wallpapers: scaled down so a big photo does not eat the Fire Stick's memory. */
    private WebResourceResponse photo(String name) throws Exception {
        File f = new File(bgDir, name);
        if (!f.getCanonicalPath().startsWith(bgDir.getCanonicalPath()) || !f.isFile()) {
            return reply("text/plain", new byte[0], 404, "Not Found");
        }
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(f.getAbsolutePath(), bounds);
        int sample = 1;
        while (bounds.outWidth / (sample * 2) >= 1280) {
            sample *= 2;
        }
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inSampleSize = sample;
        Bitmap bmp = BitmapFactory.decodeFile(f.getAbsolutePath(), opts);
        if (bmp == null) {
            return reply("text/plain", new byte[0], 404, "Not Found");
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bmp.compress(Bitmap.CompressFormat.JPEG, 86, out);
        bmp.recycle();
        return reply("image/jpeg", out.toByteArray(), 200, "OK");
    }

    /* ------------------------------------------------------------ what the page can ask us to do */

    class Bridge {

        @JavascriptInterface
        public String getApps() {
            PackageManager pm = getPackageManager();
            LinkedHashMap<String, String> found = new LinkedHashMap<String, String>();
            String[] categories = {Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER};
            for (String cat : categories) {
                Intent i = new Intent(Intent.ACTION_MAIN);
                i.addCategory(cat);
                List<ResolveInfo> list = pm.queryIntentActivities(i, 0);
                for (ResolveInfo ri : list) {
                    String pkg = ri.activityInfo.packageName;
                    if (pkg.equals(getPackageName()) || found.containsKey(pkg)) {
                        continue;
                    }
                    CharSequence label = ri.loadLabel(pm);
                    found.put(pkg, label == null ? pkg : label.toString());
                }
            }
            JSONArray arr = new JSONArray();
            try {
                for (Map.Entry<String, String> e : found.entrySet()) {
                    JSONObject o = new JSONObject();
                    o.put("p", e.getKey());
                    o.put("n", e.getValue());
                    arr.put(o);
                }
            } catch (Exception ignored) {
                // building simple JSON cannot realistically fail
            }
            return arr.toString();
        }

        @JavascriptInterface
        public void launch(final String pkg) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent i = launchIntent(pkg);
                    if (i == null) {
                        Toast.makeText(MainActivity.this, "Can't open that app", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    try {
                        startActivity(i);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "Can't open that app", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void openSettings() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent i = new Intent(Settings.ACTION_SETTINGS);
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(i);
                        return;
                    } catch (Exception ignored) {
                        // fall through to Fire TV's own settings apps
                    }
                    String[] candidates = {"com.amazon.tv.settings.v2", "com.amazon.tv.settings"};
                    for (String pkg : candidates) {
                        Intent i = launchIntent(pkg);
                        if (i != null) {
                            try {
                                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(i);
                                return;
                            } catch (Exception ignored) {
                                // try the next one
                            }
                        }
                    }
                    Toast.makeText(MainActivity.this, "Couldn't open Settings from here", Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void appInfo(final String pkg) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(i);
                    } catch (ActivityNotFoundException e) {
                        Toast.makeText(MainActivity.this, "App info isn't available on this device", Toast.LENGTH_LONG).show();
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "App info isn't available on this device", Toast.LENGTH_LONG).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void uninstall(final String pkg) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent i = new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + pkg));
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(i);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "Can't uninstall that from here", Toast.LENGTH_LONG).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public String listPhotos() {
            JSONArray arr = new JSONArray();
            File[] files = bgDir.listFiles();
            if (files != null) {
                Arrays.sort(files);
                for (File f : files) {
                    String n = f.getName().toLowerCase(Locale.US);
                    if (f.isFile() && (n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".webp"))) {
                        arr.put(f.getName());
                    }
                }
            }
            return arr.toString();
        }

        @JavascriptInterface
        public String photoDir() {
            return bgDir.getAbsolutePath();
        }
    }
}
