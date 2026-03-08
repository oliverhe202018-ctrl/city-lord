# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Preserve line numbers for crash stack traces
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ---- AMap Location SDK ----
-keep class com.amap.api.** { *; }
-keep class com.autonavi.** { *; }
-keep class com.loc.** { *; }
-keep class com.amap.api.location.** { *; }

# ---- Capacitor ----
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
}

# ---- App's own native classes ----
-keep class com.xiangfei.citylord.** { *; }

# ---- gRPC / Protobuf (if used by dependencies) ----
-keep class io.grpc.** { *; }
-keep class com.google.protobuf.** { *; }
-dontwarn io.grpc.**
-dontwarn com.google.protobuf.**

# ---- General ----
-dontwarn javax.annotation.**
-dontwarn org.codehaus.mojo.**
