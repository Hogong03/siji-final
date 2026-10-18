package io.dcloud.feature.uniapp.common;

/**
 * 编译期 stub（4.35.2）—— 只进 javac classpath，绝不打进 aar。
 *
 * dex 实测（android_base.apk classes5.dex）：
 *   public class UniModule extends com.taobao.weex.common.WXModule
 *     public UniModule()
 *     public void onActivityStop()
 * 非抽象、无抽象方法要实现 —— 子类只写自己的 @UniJSMethod 方法即可。
 */
public class UniModule extends com.taobao.weex.common.WXModule {
    public UniModule() {}
    public void onActivityStop() {}
}
