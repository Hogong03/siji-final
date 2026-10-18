package com.siji.keepalive;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.alibaba.fastjson.JSONObject;

import io.dcloud.feature.uniapp.annotation.UniJSMethod;
import io.dcloud.feature.uniapp.bridge.UniJSCallback;
import io.dcloud.feature.uniapp.common.UniModule;

/**
 * 思迹后台常驻 — JS 模块入口（4.35.2）
 *
 * 4.35.0 首版只有纯 Service（package.json plugins 为空数组），HBuilderX 打包校验直接拒绝：
 * 「_dp_nativeplugin.android.plugins 节点下存在为空的对象」。校验器源码
 * （plugins/uniapp-extension/out/index.js）要求 plugins 非空且每条必须有 type/name/class。
 * 所以本类是插件合法性的必要件，同时它也是 JS 侧的正路入口：
 *   uni.requireNativePlugin('siji-keepalive').start({ title, text }, cb)
 *
 * 用到的 DCloud API 全部从基座 APK（android_base.apk）的 dex 里逐字节核对过签名，
 * 编译期只依赖 stub（native/keepalive/stubs/，不进 aar）——本仓库没有 uniapp SDK。
 *
 * 关键签名（dex 实测，别凭教程印象改）：
 *   mUniSDKInstance 声明在 WXModule 上，类型是 AbsSDKInstance（接口），不是 UniSDKInstance；
 *   getContext() 直接声明在 AbsSDKInstance 上，所以这里不需要任何向下转型。
 */
public class SijiKeepAliveModule extends UniModule {

    /** 启动前台服务。options: { title?: string, text?: string }，callback: ({ ok, error? }) => void */
    @UniJSMethod(uiThread = true)
    public void start(JSONObject options, UniJSCallback callback) {
        try {
            Context ctx = (mUniSDKInstance != null) ? mUniSDKInstance.getContext() : null;
            if (ctx == null) {
                invoke(callback, false, "no-context");
                return;
            }
            String title = (options != null) ? options.getString("title") : null;
            String text = (options != null) ? options.getString("text") : null;
            Intent intent = new Intent(ctx, SijiKeepAliveService.class);
            intent.setAction(SijiKeepAliveService.ACTION_START);
            if (title != null && title.length() > 0) {
                intent.putExtra(SijiKeepAliveService.EXTRA_TITLE, title);
            }
            if (text != null && text.length() > 0) {
                intent.putExtra(SijiKeepAliveService.EXTRA_TEXT, text);
            }
            if (Build.VERSION.SDK_INT >= 26) {
                ctx.startForegroundService(intent);
            } else {
                ctx.startService(intent);
            }
            invoke(callback, true, null);
        } catch (Throwable t) {
            // 通知权限被拒 / 部分 ROM 限制后台启动：回给 JS，由 JS 走 plus.android 反射兜底或提示
            invoke(callback, false, String.valueOf(t.getMessage()));
        }
    }

    /** 停止前台服务并移除常驻通知。callback: ({ ok, error? }) => void */
    @UniJSMethod(uiThread = true)
    public void stop(UniJSCallback callback) {
        try {
            Context ctx = (mUniSDKInstance != null) ? mUniSDKInstance.getContext() : null;
            if (ctx == null) {
                invoke(callback, false, "no-context");
                return;
            }
            Intent intent = new Intent(ctx, SijiKeepAliveService.class);
            ctx.stopService(intent);
            invoke(callback, true, null);
        } catch (Throwable t) {
            invoke(callback, false, String.valueOf(t.getMessage()));
        }
    }

    /** 查询服务是否活着（静态标志位，不查系统，无 Context 依赖）。callback: ({ running }) => void */
    @UniJSMethod(uiThread = false)
    public void isRunning(UniJSCallback callback) {
        JSONObject data = new JSONObject();
        data.put("running", Boolean.valueOf(SijiKeepAliveService.isRunning()));
        if (callback != null) {
            callback.invoke(data);
        }
    }

    /** 统一回包：{ ok: boolean, error?: string } */
    private static void invoke(UniJSCallback callback, boolean ok, String error) {
        if (callback == null) {
            return;
        }
        JSONObject data = new JSONObject();
        data.put("ok", Boolean.valueOf(ok));
        if (error != null) {
            data.put("error", error);
        }
        callback.invoke(data);
    }
}
