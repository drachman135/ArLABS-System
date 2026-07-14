package com.ardevlabs.admin;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String CHANNEL_ID = "arlabs_admin_alerts";
    private static final int NOTIFICATION_PERMISSION_CODE = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Create the high-priority notification channel for heads-up display
        createNotificationChannel();

        // Request POST_NOTIFICATIONS permission on Android 13+ (API 33+)
        requestNotificationPermission();
    }

    /**
     * Creates a NotificationChannel with IMPORTANCE_HIGH so that push
     * notifications from OneSignal appear as heads-up banners even when the
     * app is in the background or closed.
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "ArLABS Admin Alerts";
            String description = "Notifikasi penting dari sistem ArLABS seperti laporan feedback, aktivasi lisensi, dan peringatan crash.";
            int importance = NotificationManager.IMPORTANCE_HIGH;

            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 300, 200, 300});
            channel.enableLights(true);
            channel.setLightColor(0xFFFF4444); // Red light
            channel.setShowBadge(true);
            channel.setBypassDnd(false); // Respect Do Not Disturb

            // Lock screen visibility: show full notification content
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    /**
     * Requests the POST_NOTIFICATIONS runtime permission required by Android 13+.
     * Without this, no notifications will appear at all on API 33+ devices.
     */
    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this,
                        new String[]{android.Manifest.permission.POST_NOTIFICATIONS},
                        NOTIFICATION_PERMISSION_CODE
                );
            }
        }
    }
}
