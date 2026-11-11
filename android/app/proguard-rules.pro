# Release builds are shrunk and renamed by R8. Anything reached through reflection or generated
# code must be kept explicitly, or the app works in debug and breaks in release.

# Request/response models and the saved session are (de)serialized by kotlinx.serialization.
-keep class app.textsy.data.model.** { *; }
-keep class app.textsy.data.local.StoredSession { *; }
-keep class app.textsy.data.local.StoredSession$$serializer { *; }

# Retrofit builds a proxy for this interface at runtime and reads its annotations and generic types.
-keep interface app.textsy.data.remote.TextsyApi { *; }
-keepattributes Signature,InnerClasses,EnclosingMethod,RuntimeVisibleAnnotations,AnnotationDefault

# Socket.IO / Engine.IO ship their own consumer rules; org.json comes from Android itself.
-dontwarn org.json.**
