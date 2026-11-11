# kotlinx.serialization keeps generated serializers via its own consumer rules.
# Socket.IO / Engine.IO use reflection on a few classes and ship consumer rules;
# add app-specific rules here if release builds ever lose something.
-dontwarn org.json.**
