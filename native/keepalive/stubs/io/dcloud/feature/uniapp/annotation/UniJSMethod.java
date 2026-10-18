package io.dcloud.feature.uniapp.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 编译期 stub（4.35.2）—— 只进 javac classpath，绝不打进 aar。
 *
 * dex 实测元素：uiThread()Z + alias()Ljava/lang/String;
 * Retention 必须 RUNTIME：javac 按编译期可见的 retention 决定把注解写进
 * RuntimeVisibleAnnotations —— 运行时基座正是反射读它来注册 JS 方法的。
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface UniJSMethod {
    boolean uiThread() default true;
    String alias() default "";
}
