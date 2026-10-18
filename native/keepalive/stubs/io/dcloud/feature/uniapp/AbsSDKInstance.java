package io.dcloud.feature.uniapp;

/**
 * 编译期 stub（4.35.2）—— 只进 javac classpath，绝不打进 aar。
 *
 * dex 实测：这是接口（PUBLIC|INTERFACE|ABSTRACT），getContext 直接声明在它上面：
 *   android.content.Context getContext()
 * 所以模块代码里 mUniSDKInstance.getContext() 不需要任何向下转型。
 */
public interface AbsSDKInstance {
    android.content.Context getContext();
}
