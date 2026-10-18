package com.alibaba.fastjson;

/**
 * 编译期 stub（4.35.2）—— 只进 javac classpath，绝不打进 aar。
 *
 * dex 实测（基座运行时自带 fastjson 1.x）：
 *   public JSONObject()
 *   public String getString(String)
 *   public Object put(String, Object)
 * 只 stub 本模块用到的三个成员。方法体永远不会执行——运行时用的是基座里的真类。
 */
public class JSONObject {
    public JSONObject() {}
    public String getString(String key) { return null; }
    public Object put(String key, Object value) { return null; }
}
