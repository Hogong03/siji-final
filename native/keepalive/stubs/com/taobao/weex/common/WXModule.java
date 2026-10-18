package com.taobao.weex.common;

/**
 * 编译期 stub（4.35.2）—— 只进 javac classpath，绝不打进 aar。
 *
 * 真实类在 HBuilderX 基座运行时里（android_base.apk classes3.dex），
 * 用本仓库 %TEMP% 下的 dex-classdef 解析器逐字节核对过：
 *   public abstract class WXModule extends Object
 *     public io.dcloud.feature.uniapp.AbsSDKInstance mUniSDKInstance   <- 字段类型是 AbsSDKInstance
 *     public com.taobao.weex.WXSDKInstance mWXSDKInstance
 *     public WXModule()
 * 只 stub 本插件用到的成员（mUniSDKInstance），其余成员 javac 不需要。
 */
public abstract class WXModule {
    public io.dcloud.feature.uniapp.AbsSDKInstance mUniSDKInstance;
    public WXModule() {}
}
