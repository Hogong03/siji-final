package io.dcloud.feature.uniapp.bridge;

/**
 * 编译期 stub（4.35.2）—— 只进 javac classpath，绝不打进 aar。
 *
 * dex 实测：接口，两个方法 invoke(Ljava/lang/Object;)V 与 invokeAndKeepAlive(Ljava/lang/Object;)V。
 * 模块代码只调 invoke(Object)；回传 fastjson JSONObject 是官方样例的标准姿势。
 */
public interface UniJSCallback {
    void invoke(Object data);
    void invokeAndKeepAlive(Object data);
}
