# Betgistics ProGuard Rules
# -------------------------------------------------

# Keep Capacitor classes
-keep class com.getcapacitor.** { *; }
-keep class com.betgistics.app.** { *; }

# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep annotations
-keepattributes *Annotation*

# Keep source file names and line numbers for crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# OkHttp (used by Capacitor networking)
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# Gson (if used for JSON parsing)
-keepattributes Signature
-keep class com.google.gson.** { *; }

# Firebase (if added later)
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Stripe SDK (if native SDK is added)
-keep class com.stripe.** { *; }

# Remove logging in release builds
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
}
