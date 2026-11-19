#!/usr/bin/env bash
set -e

export ANDROID_HOME=/opt/android-sdk
mkdir -p "$ANDROID_HOME/cmdline-tools"

if [ ! -d "$ANDROID_HOME/cmdline-tools/latest" ]; then
  echo "📥 Downloading Android command-line tools..."
  curl -o /tmp/cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
  unzip -q /tmp/cmdline-tools.zip -d /tmp/cmdline-tools-extracted
  mkdir -p "$ANDROID_HOME/cmdline-tools/latest"
  cp -r /tmp/cmdline-tools-extracted/cmdline-tools/* "$ANDROID_HOME/cmdline-tools/latest/"
  rm -rf /tmp/cmdline-tools.zip /tmp/cmdline-tools-extracted
  echo "✅ Command-line tools installed."
fi

export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"

echo "📝 Accepting Android SDK licenses..."
yes | sdkmanager --licenses > /dev/null 2>&1 || true

echo "📦 Installing Android SDK platform-tools and platform..."
# Target Android API 36 (Play Store requirement)
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"

echo "✅ Android SDK ready at $ANDROID_HOME"
