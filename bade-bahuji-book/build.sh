#!/usr/bin/env bash
# Build bade-bahuji.apk without the Android SDK.
#
# Toolchain (all fetched from Maven Central / npm — no dl.google.com needed):
#   apktool-cli  — binary AndroidManifest.xml + resources.arsc packaging
#   dalvik-dx    — .class -> classes.dex
#   apksig       — APK signature scheme v1 + v2 signing/verification
#   android-all  — Android 14 framework jar (compile classpath), via Robolectric
set -euo pipefail
cd "$(dirname "$0")"

TOOLS="${TOOLS_DIR:-tools}"
OUT=dist
KEYSTORE=keystore/badebahuji.p12
STOREPASS=badebahuji123
ALIAS=badebahuji

mkdir -p "$TOOLS" "$OUT" build/classes

fetch() { [ -f "$TOOLS/$1" ] || curl -sSL -o "$TOOLS/$1" "$2"; }
fetch apktool.jar     "https://repo1.maven.org/maven2/org/apktool/apktool-cli/2.12.1/apktool-cli-2.12.1.jar"
fetch dx.jar          "https://repo1.maven.org/maven2/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar"
fetch apksig.jar      "https://repo1.maven.org/maven2/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar"
fetch android-all.jar "https://repo1.maven.org/maven2/org/robolectric/android-all/14-robolectric-10818077/android-all-14-robolectric-10818077.jar"

echo "==> launcher icon"
python3 make_icon.py apk/res/mipmap-xxxhdpi/ic_launcher.png

echo "==> javac"
javac -source 1.8 -target 1.8 -Xlint:-options \
      -classpath "$TOOLS/android-all.jar" \
      -d build/classes \
      src/com/janak/badebahuji/*.java

echo "==> dex"
java -cp "$TOOLS/dx.jar" com.android.dx.command.Main --dex --min-sdk-version=24 \
     --output=build/classes.dex build/classes

echo "==> apktool (manifest + resources + assets)"
java -jar "$TOOLS/apktool.jar" b apk -o "$OUT/unsigned-nodex.apk" -f

echo "==> inject classes.dex"
python3 - "$OUT/unsigned-nodex.apk" build/classes.dex "$OUT/unsigned.apk" <<'PY'
import shutil, sys, zipfile
src, dex, dst = sys.argv[1:4]
shutil.copyfile(src, dst)
with zipfile.ZipFile(dst, "a", zipfile.ZIP_DEFLATED) as z:
    z.write(dex, "classes.dex")
print("classes.dex injected")
PY

if [ ! -f "$KEYSTORE" ]; then
  echo "==> generating signing keystore"
  mkdir -p keystore
  keytool -genkeypair -v -storetype PKCS12 \
    -keystore "$KEYSTORE" -storepass "$STOREPASS" \
    -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Bade Bahuji, OU=Books, O=Janak, L=NA, S=NA, C=IN"
fi

echo "==> compile signer"
javac -cp "$TOOLS/apksig.jar" -d build signer/Signer.java signer/Verifier.java

echo "==> sign v2 (apksig)"
java --add-exports java.base/sun.security.x509=ALL-UNNAMED \
     --add-exports java.base/sun.security.pkcs=ALL-UNNAMED \
     --add-exports java.base/sun.security.util=ALL-UNNAMED \
     -cp "$TOOLS/apksig.jar:build" Signer "$KEYSTORE" "$STOREPASS" "$ALIAS" \
     "$OUT/unsigned.apk" "$OUT/bade-bahuji.apk"

echo "==> verify"
java -cp "$TOOLS/apksig.jar:build" Verifier "$OUT/bade-bahuji.apk"

rm -f "$OUT/unsigned-nodex.apk" "$OUT/unsigned.apk"
ls -la "$OUT"
echo "OK: $OUT/bade-bahuji.apk"
