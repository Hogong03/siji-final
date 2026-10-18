package com.siji.keepalive;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/**
 * 思迹后台常驻前台服务（4.35.0）
 *
 * 纯 Android Service，不依赖 uniapp 插件 SDK（也不需要 UniModule）：
 * JS 侧用 plus.android 反射起这个 Service，见 utils/keepalive.js。
 *
 * 为什么是前台服务：Android 8.0 起后台进程会被自由回收，只有前台服务 + 常驻通知
 * 能让进程在退到后台、甚至被从最近任务划掉后继续存活（START_STICKY 由系统重启）。
 *
 * 平台边界（如实）：
 *  - 只对 Android 有效，iOS 无对应能力（本插件在 iOS 上不参与打包）。
 *  - Android 14+ 必须声明 foregroundServiceType。这里用 specialUse（dataSync 在
 *    Android 15 上有 6 小时/24 小时上限，到点会被系统掐掉），随 manifest 一起声明
 *    PROPERTY_SPECIAL_USE_FGS_SUBTYPE。Google Play 对 specialUse 有审核口径，
 *    国内商店无此限制。
 *  - 国产 ROM（MIUI/EMUI/ColorOS 等）仍可能在「电池优化 / 自启动」未放行时杀掉进程，
 *    这部分只能靠用户侧设置，JS 侧提供引导入口。
 */
public class SijiKeepAliveService extends Service {

    /** 启动（带通知文案） */
    public static final String ACTION_START = "com.siji.keepalive.action.START";
    /** 停止并移除常驻通知 */
    public static final String ACTION_STOP = "com.siji.keepalive.action.STOP";

    /** 通知标题文案（可选，缺省用 DEFAULT_TITLE） */
    public static final String EXTRA_TITLE = "siji_title";
    /** 通知正文文案（可选，缺省用 DEFAULT_TEXT） */
    public static final String EXTRA_TEXT = "siji_text";

    public static final String CHANNEL_ID = "siji_keepalive";
    public static final String CHANNEL_NAME = "后台运行";
    public static final int NOTIFICATION_ID = 20261001;

    private static final String DEFAULT_TITLE = "思迹正在后台运行";
    private static final String DEFAULT_TEXT = "计划提醒会准时送达；不需要时可在 设置 - 提示与提醒 关闭";

    /** 通知渠道只需建一次，用实例标记避免每次 onStartCommand 都 create */
    private boolean channelReady = false;

    /**
     * 进程内运行标志（4.35.2）：onCreate 置 true / onDestroy 置 false。
     * 给模块的 isRunning() 查 —— 只反映本进程视角，不查系统服务表（那需要 Context + ActivityManager）。
     */
    private static volatile boolean running = false;

    /** 模块查询入口：前台服务当前是否活着 */
    public static boolean isRunning() {
        return running;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        final String action = intent == null ? null : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopForegroundCompat();
            stopSelf();
            return START_NOT_STICKY;
        }
        String title = intent == null ? null : intent.getStringExtra(EXTRA_TITLE);
        String text = intent == null ? null : intent.getStringExtra(EXTRA_TEXT);
        startAsForeground(
                isEmpty(title) ? DEFAULT_TITLE : title,
                isEmpty(text) ? DEFAULT_TEXT : text
        );
        // 被系统回收后自动重启（intent 为 null 时走默认文案）
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopForegroundCompat();
        super.onDestroy();
    }

    // ==================== 内部实现 ====================

    private static boolean isEmpty(String s) {
        return s == null || s.length() == 0;
    }

    /**
     * 进入前台。通知权限被拒 / 渠道被删时 startForeground 会抛异常，
     * 这里直接 stopSelf —— 绝不能让它变成崩溃循环。
     */
    private void startAsForeground(String title, String text) {
        try {
            Notification n = buildNotification(title, text);
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTIFICATION_ID, n);
            }
        } catch (Throwable t) {
            stopSelf();
        }
    }

    private void stopForegroundCompat() {
        try {
            if (Build.VERSION.SDK_INT >= 24) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Throwable ignored) {
            // 已经停了 / 系统已回收，忽略
        }
    }

    @SuppressWarnings("deprecation")
    private Notification buildNotification(String title, String text) {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= 26) {
            ensureChannel();
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }
        builder.setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(smallIcon())
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setPriority(Notification.PRIORITY_LOW)
                .setCategory(Notification.CATEGORY_SERVICE);
        PendingIntent pi = contentIntent();
        if (pi != null) {
            builder.setContentIntent(pi);
        }
        if (Build.VERSION.SDK_INT >= 21) {
            builder.setVisibility(Notification.VISIBILITY_SECRET);
        }
        return builder.build();
    }

    /** 通知小图标：优先用应用图标，取不到时退回系统图标（避免 getApplicationInfo 为 null 崩） */
    private int smallIcon() {
        try {
            int icon = getApplicationInfo().icon;
            if (icon != 0) {
                return icon;
            }
        } catch (Throwable ignored) {
            // 落到系统图标
        }
        return android.R.drawable.ic_dialog_info;
    }

    /** 点通知回到思迹（用包名取启动 Intent，不硬编码宿主 Activity 类名） */
    private PendingIntent contentIntent() {
        try {
            Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launch == null) {
                return null;
            }
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
            int flags = Build.VERSION.SDK_INT >= 23
                    ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                    : PendingIntent.FLAG_UPDATE_CURRENT;
            return PendingIntent.getActivity(this, NOTIFICATION_ID, launch, flags);
        } catch (Throwable t) {
            return null;
        }
    }

    private void ensureChannel() {
        if (channelReady || Build.VERSION.SDK_INT < 26) {
            return;
        }
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW);
                ch.setShowBadge(false);
                ch.setSound(null, null);
                ch.enableVibration(false);
                nm.createNotificationChannel(ch);
            }
            channelReady = true;
        } catch (Throwable ignored) {
            // 渠道建不出来时 startForeground 会抛，交给外层 stopSelf
        }
    }
}
