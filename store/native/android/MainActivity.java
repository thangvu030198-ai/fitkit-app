package vn.thangvu.fitkit;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * TapEasy — MainActivity (R3-store). scripts/native-android-patch.py chép file này đè lên bản mẫu của Capacitor.
 *
 * Android 15+ (API 35) ÉP app target 35+ vẽ tràn viền (edge-to-edge); target 36 không còn cờ từ chối.
 * Capacitor 6 chưa tự xử lý inset → nội dung web bị thanh trạng thái / thanh điều hướng / bàn phím che.
 * Cách làm chắc chắn, không phụ thuộc phiên bản WebView: đệm (padding) vùng nội dung đúng bằng inset của
 * thanh hệ thống + tai thỏ + bàn phím, nền vùng đệm = màu nền app (#061A24), biểu tượng thanh hệ thống màu sáng.
 * Trong WebView khi đó env(safe-area-inset-*) = 0 (nội dung không nằm dưới thanh hệ thống) — CSS safe-area của web vẫn đúng.
 * Máy Android ≤ 14: hệ thống tự chừa chỗ như cũ, không can thiệp.
 */
public class MainActivity extends BridgeActivity {
    private static final int EDGE_TO_EDGE_ENFORCED_API = 35;
    private static final String APP_BACKGROUND = "#061A24";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT < EDGE_TO_EDGE_ENFORCED_API) return;
        final View content = findViewById(android.R.id.content);
        if (content == null) return;
        content.setBackgroundColor(Color.parseColor(APP_BACKGROUND));
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
        ViewCompat.requestApplyInsets(content);
    }
}
