package com.spellstorm.game;

import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import java.util.Locale;

/**
 * Spellstorm's Android activity. On top of the standard Capacitor app, it sends game-controller input
 * (Android handhelds, Bluetooth and USB controllers) straight to the game's controller module
 * (window.SSPAD in the page), because Android's WebView doesn't reliably expose controllers to web pages.
 * Touch, keyboards and the phone's own Back gesture are untouched.
 * The build copies this file over the one Capacitor generates (see .github/workflows/build.yml).
 */
public class MainActivity extends BridgeActivity {
    private final float[] axes = new float[6];
    private boolean ltDown = false, rtDown = false;
    private int namedDevice = Integer.MIN_VALUE;

    private static boolean isController(InputDevice d, int eventSource) {
        int s = d != null ? d.getSources() : eventSource;
        return (s & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
            || (s & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK;
    }

    private static String button(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_BUTTON_A: case KeyEvent.KEYCODE_DPAD_CENTER: return "A";
            case KeyEvent.KEYCODE_BUTTON_B: case KeyEvent.KEYCODE_BACK: return "B";
            case KeyEvent.KEYCODE_BUTTON_X: return "X";
            case KeyEvent.KEYCODE_BUTTON_Y: return "Y";
            case KeyEvent.KEYCODE_BUTTON_L1: return "LB";
            case KeyEvent.KEYCODE_BUTTON_R1: return "RB";
            case KeyEvent.KEYCODE_BUTTON_L2: return "LT";
            case KeyEvent.KEYCODE_BUTTON_R2: return "RT";
            case KeyEvent.KEYCODE_BUTTON_SELECT: return "SELECT";
            case KeyEvent.KEYCODE_BUTTON_START: case KeyEvent.KEYCODE_MENU: return "START";
            case KeyEvent.KEYCODE_DPAD_UP: return "UP";
            case KeyEvent.KEYCODE_DPAD_DOWN: return "DOWN";
            case KeyEvent.KEYCODE_DPAD_LEFT: return "LEFT";
            case KeyEvent.KEYCODE_DPAD_RIGHT: return "RIGHT";
            default: return null;
        }
    }

    private void js(String call) {
        if (getBridge() == null) return;
        WebView w = getBridge().getWebView();
        if (w != null) w.evaluateJavascript("window.SSPAD&&SSPAD." + call, null);
    }

    private void nameDevice(InputDevice d) {
        if (d == null || d.getId() == namedDevice) return;
        namedDevice = d.getId();
        String n = d.getName() == null ? "" : d.getName().replaceAll("[^A-Za-z0-9 ._()-]", "");
        js("natName('" + n + "')");
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        String b = isController(e.getDevice(), e.getSource()) ? button(e.getKeyCode()) : null;
        if (b == null) return super.dispatchKeyEvent(e);
        if (e.getRepeatCount() == 0 && (e.getAction() == KeyEvent.ACTION_DOWN || e.getAction() == KeyEvent.ACTION_UP)) {
            nameDevice(e.getDevice());
            js("nat('" + b + "'," + (e.getAction() == KeyEvent.ACTION_DOWN ? 1 : 0) + ")");
        }
        return true;   // the game handles it (the page does its own key repeat)
    }

    private static float bigger(MotionEvent e, int a, int b) {
        float x = e.getAxisValue(a), y = e.getAxisValue(b);
        return Math.abs(x) >= Math.abs(y) ? x : y;
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent e) {
        if (e.getAction() != MotionEvent.ACTION_MOVE || !isController(e.getDevice(), e.getSource())) return super.dispatchGenericMotionEvent(e);
        nameDevice(e.getDevice());
        float[] a = {
            e.getAxisValue(MotionEvent.AXIS_X), e.getAxisValue(MotionEvent.AXIS_Y),
            bigger(e, MotionEvent.AXIS_Z, MotionEvent.AXIS_RX), bigger(e, MotionEvent.AXIS_RZ, MotionEvent.AXIS_RY),
            e.getAxisValue(MotionEvent.AXIS_HAT_X), e.getAxisValue(MotionEvent.AXIS_HAT_Y)
        };
        boolean changed = false;
        for (int i = 0; i < 6; i++) {
            float v = Math.abs(a[i]) < 0.15f ? 0f : Math.round(a[i] * 20f) / 20f;
            if (v != axes[i]) { axes[i] = v; changed = true; }
        }
        if (changed) js(String.format(Locale.US, "natAxes(%.2f,%.2f,%.2f,%.2f,%.2f,%.2f)", axes[0], axes[1], axes[2], axes[3], axes[4], axes[5]));
        boolean lt = bigger(e, MotionEvent.AXIS_LTRIGGER, MotionEvent.AXIS_BRAKE) > 0.5f;
        boolean rt = bigger(e, MotionEvent.AXIS_RTRIGGER, MotionEvent.AXIS_GAS) > 0.5f;
        if (lt != ltDown) { ltDown = lt; js("nat('LT'," + (lt ? 1 : 0) + ")"); }
        if (rt != rtDown) { rtDown = rt; js("nat('RT'," + (rt ? 1 : 0) + ")"); }
        return true;
    }
}
