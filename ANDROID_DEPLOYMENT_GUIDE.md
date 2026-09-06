# Betgistics Android Deployment Guide

This guide covers the full process of building, signing, and deploying the Betgistics Android app to the Google Play Store. The app is built with Capacitor, which wraps the frontend web application in a native Android shell.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Setup](#development-setup)
3. [Building a Signed APK/AAB](#building-a-signed-apkaab)
4. [Play Console Setup](#play-console-setup)
5. [Testing Tracks](#testing-tracks)
6. [Release Management](#release-management)
7. [Environment Variables](#environment-variables)
8. [Firebase Setup (Optional)](#firebase-setup-optional)
9. [Common Issues](#common-issues)

---

## Prerequisites

Before starting, ensure the following tools are installed and properly configured on your development machine.

### Android Studio

- Download and install Android Studio from https://developer.android.com/studio
- During installation, ensure the following components are selected:
  - Android SDK (API level 33 or higher recommended)
  - Android SDK Build-Tools
  - Android Emulator (for local testing)
  - Android SDK Platform-Tools
- After installation, open Android Studio and go to **Settings > Languages & Frameworks > Android SDK** to verify the SDK path and installed platforms.

### JDK 17

- Android Gradle Plugin 8.x requires JDK 17.
- Download from https://adoptium.net/ (Eclipse Temurin) or use your system package manager:

```bash
# Ubuntu/Debian
sudo apt install openjdk-17-jdk

# macOS (Homebrew)
brew install openjdk@17
```

- Verify the installation:

```bash
java -version
# Expected output: openjdk version "17.x.x"
```

- Set `JAVA_HOME` in your shell profile if it is not already configured:

```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64   # Linux
export JAVA_HOME=$(/usr/libexec/java_home -v 17)       # macOS
```

### Node.js 18+

- Install Node.js 18 or later from https://nodejs.org/ or use a version manager such as `nvm`:

```bash
nvm install 18
nvm use 18
```

- Verify:

```bash
node -v
# Expected output: v18.x.x or higher
```

### Additional CLI Tools

- Ensure `npm` (bundled with Node.js) is up to date:

```bash
npm install -g npm@latest
```

- Capacitor CLI should already be listed in the project `devDependencies`, but you can verify:

```bash
npx cap --version
```

---

## Development Setup

These steps describe how to build the web frontend and run the Android app locally for development purposes.

### 1. Install frontend dependencies

```bash
cd frontend
npm install
```

### 2. Build the web application

```bash
npm run build
```

This compiles the Vite-based frontend into the `dist/` directory.

### 3. Sync the web build into the Android project

```bash
npx cap sync android
```

This copies the built web assets into `android/app/src/main/assets/public/` and updates native dependencies.

### 4. Open in Android Studio

```bash
npx cap open android
```

This opens the `android/` directory as an Android Studio project.

### 5. Run on an emulator or connected device

- In Android Studio, select a target device (emulator or USB-connected device) from the toolbar.
- Click the **Run** button (green play icon) or press `Shift+F10`.
- The app will build, install, and launch on the selected device.

### Live Reload (optional, for faster iteration)

For development with live reload, use the Capacitor server configuration:

```bash
# Start the Vite dev server
npm run dev

# In a separate terminal, run with live reload
npx cap run android --livereload --external
```

Note: The device or emulator must be on the same network as your development machine for live reload to work.

---

## Building a Signed APK/AAB

Google Play requires all apps to be signed with a cryptographic key. An AAB (Android App Bundle) is the required format for Play Store uploads. APKs can still be used for direct distribution or testing.

### Step 1: Generate a Keystore

Run the following command to create a new keystore file. Keep this file safe and backed up. If you lose it, you will not be able to update your app on the Play Store.

```bash
keytool -genkey -v -keystore release-key.jks -keyalias betgistics -keyalg RSA -keysize 2048 -validity 10000
```

You will be prompted to set a keystore password, provide identifying information, and set a key password. Record all passwords securely (use a password manager).

**Important**: Never commit the keystore file or passwords to version control. Add `release-key.jks` to your `.gitignore`.

### Step 2: Configure Gradle Signing Properties

Create or edit the file `frontend/android/gradle.properties` and add the following entries:

```properties
BETGISTICS_STORE_FILE=../release-key.jks
BETGISTICS_STORE_PASSWORD=your_store_password_here
BETGISTICS_KEY_ALIAS=betgistics
BETGISTICS_KEY_PASSWORD=your_key_password_here
```

The `BETGISTICS_STORE_FILE` path is relative to the `android/app/` directory. Adjust the path if you store the keystore elsewhere.

**Security note**: For CI/CD pipelines, use environment variables or secret management tools instead of storing passwords in `gradle.properties`. Add `gradle.properties` to `.gitignore` if it contains secrets.

### Step 3: Configure build.gradle for Signing

Edit `frontend/android/app/build.gradle` and add a `signingConfigs` block inside the `android` section:

```groovy
android {
    // ... existing configuration ...

    signingConfigs {
        release {
            storeFile file(BETGISTICS_STORE_FILE)
            storePassword BETGISTICS_STORE_PASSWORD
            keyAlias BETGISTICS_KEY_ALIAS
            keyPassword BETGISTICS_KEY_PASSWORD
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Step 4: Build the AAB

```bash
# From the repository root
cd frontend

# Build the web app and sync to Android
npm run build && npx cap sync android

# Build the release AAB using Gradle
cd android
./gradlew bundleRelease
```

The signed AAB file will be generated at:

```
frontend/android/app/build/outputs/bundle/release/app-release.aab
```

### Step 5: Build a Signed APK (alternative, for direct distribution)

If you need a standalone APK instead of an AAB:

```bash
cd frontend/android
./gradlew assembleRelease
```

The signed APK will be at:

```
frontend/android/app/build/outputs/apk/release/app-release.apk
```

---

## Play Console Setup

### 1. Create a Google Play Developer Account

- Go to https://play.google.com/console/signup
- Sign in with a Google account.
- Pay the one-time registration fee of $25 USD.
- Complete identity verification (this may take several days).

### 2. Create the App Listing

- In the Play Console, click **Create app**.
- Fill in the required fields:
  - **App name**: Betgistics
  - **Default language**: English (United States)
  - **App or game**: App
  - **Free or paid**: Free (or Paid, as applicable)
- Accept the declarations and click **Create app**.

### 3. Complete the Store Listing

Navigate to **Grow > Store presence > Main store listing** and fill in:

- **Short description** (up to 80 characters): A concise tagline for Betgistics.
- **Full description** (up to 4000 characters): Detailed description of the app features.
- **Screenshots**: Provide at least 2 screenshots for phone. Tablet and Chromebook screenshots are recommended.
  - Phone screenshots: minimum 320px, maximum 3840px on any side.
- **App icon**: 512 x 512 px, 32-bit PNG.
- **Feature graphic**: 1024 x 500 px.
- **Category**: Finance or Tools (whichever fits best).
- **Contact details**: Provide an email address.

### 4. Complete the App Content Section

Navigate to **Policy > App content** and complete all required declarations:

- Privacy policy URL
- Ads declaration
- App access (whether the app requires login)
- Content rating questionnaire
- Target audience and content
- Data safety section

All of these must be completed before you can publish to any track.

### 5. Upload the AAB

- Navigate to **Release > Testing > Internal testing** (start here first).
- Click **Create new release**.
- Upload the `app-release.aab` file.
- Add release notes.
- Click **Review release**, then **Start rollout to Internal testing**.

---

## Testing Tracks

Google Play provides four release tracks. Progress through them sequentially to catch issues before reaching production users.

### Internal Testing

- Up to 100 testers (by email address).
- App is available within minutes of upload.
- Not reviewed by Google Play.
- Best for: Developer and QA team testing.

### Closed Beta (Closed Testing)

- Testers are managed by email lists or Google Groups.
- App goes through a review process.
- Best for: Wider team testing, stakeholder demos.

### Open Beta (Open Testing)

- Anyone can join the beta via a public link.
- App is listed on the Play Store with a "Beta" badge.
- Best for: Public beta testing, gathering feedback from a large audience.

### Production

- Full public release on the Play Store.
- App goes through a full review.
- Consider using staged rollouts (e.g., 10% -> 25% -> 50% -> 100%) to mitigate risk.

### Promoting Between Tracks

To promote a release from one track to the next:

1. Go to the target track in the Play Console.
2. Click **Create new release**.
3. Click **Add from library** and select the AAB version you want to promote.
4. Add release notes for the new track.
5. Review and roll out.

---

## Release Management

### Version Bumping

Android uses two version identifiers in `frontend/android/app/build.gradle`:

```groovy
android {
    defaultConfig {
        versionCode 1        // Integer, must increment with every Play Store upload
        versionName "1.0.0"  // Human-readable version string
    }
}
```

- **versionCode**: An integer that must be strictly incremented for every new upload to the Play Store. The Play Console will reject uploads where the `versionCode` is not higher than the previous release.
- **versionName**: A human-readable string (e.g., semantic versioning `1.2.3`) shown to users on the Play Store listing.

Before each release, update both values:

```groovy
// Example: bumping from 1.0.0 to 1.1.0
versionCode 2
versionName "1.1.0"
```

### Changelogs

When uploading a new release to any track, the Play Console will prompt for release notes. These are displayed to users in the "What's new" section.

Guidelines for writing changelogs:

- Keep entries concise and user-facing (avoid technical jargon).
- Group changes by category when applicable (New Features, Bug Fixes, Improvements).
- Example:

```
What's new in 1.1.0:
- Added multi-sport Kelly Criterion calculations
- Improved bankroll chart performance
- Fixed an issue where odds format preference was not saved
```

Release notes can also be managed via the Play Console API for automated pipelines.

---

## Environment Variables

The frontend build uses Vite environment variables to configure runtime behavior.

### Configuring VITE_BACKEND_URL for Production

Create or edit the file `frontend/.env.production`:

```env
VITE_BACKEND_URL=https://api.betgistics.com
```

This variable is embedded at build time by Vite. Any code referencing `import.meta.env.VITE_BACKEND_URL` will use this value when the app is built with `npm run build`.

### Environment File Hierarchy

Vite loads environment files in the following order of precedence (highest first):

| File                 | Purpose                              | Loaded When          |
|----------------------|--------------------------------------|----------------------|
| `.env.production.local` | Local overrides for production    | `npm run build`      |
| `.env.production`       | Production environment variables  | `npm run build`      |
| `.env.local`            | Local overrides (all modes)       | Always (except test) |
| `.env`                  | Default environment variables     | Always               |

### Using Environment Variables in the App

In your frontend code, access the variable as:

```typescript
const backendUrl = import.meta.env.VITE_BACKEND_URL;
```

Only variables prefixed with `VITE_` are exposed to the client-side code. Variables without this prefix are not included in the build output.

### Switching Environments for Different Build Targets

To build for a staging environment:

```bash
# Create frontend/.env.staging
VITE_BACKEND_URL=https://staging-api.betgistics.com

# Build with the staging mode
npx vite build --mode staging
```

---

## Firebase Setup (Optional)

Firebase provides analytics, crash reporting, and other services for Android apps. This section covers integrating Firebase Analytics and Crashlytics.

### Step 1: Create a Firebase Project

1. Go to https://console.firebase.google.com/
2. Click **Add project** and follow the prompts.
3. When asked about Google Analytics, enable it (required for Crashlytics).

### Step 2: Register the Android App

1. In the Firebase console, click **Add app** and select the Android icon.
2. Enter the Android package name. This must match the `applicationId` in `frontend/android/app/build.gradle` (e.g., `com.betgistics.app`).
3. Optionally provide an app nickname and debug signing certificate SHA-1.
4. Click **Register app**.

### Step 3: Download and Add google-services.json

1. Download the `google-services.json` file from the Firebase console.
2. Place it in the `frontend/android/app/` directory.
3. Add it to `.gitignore` if your repository is public:

```
# .gitignore
frontend/android/app/google-services.json
```

### Step 4: Add Firebase SDK Dependencies

Edit `frontend/android/build.gradle` (project-level):

```groovy
buildscript {
    dependencies {
        // Add these lines
        classpath 'com.google.gms:google-services:4.4.0'
        classpath 'com.google.firebase:firebase-crashlytics-gradle:2.9.9'
    }
}
```

Edit `frontend/android/app/build.gradle` (app-level):

```groovy
plugins {
    id 'com.android.application'
    id 'com.google.gms.google-services'        // Add this
    id 'com.google.firebase.crashlytics'        // Add this
}

dependencies {
    // Add these lines
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-analytics'
    implementation 'com.google.firebase:firebase-crashlytics'
}
```

### Step 5: Sync and Verify

```bash
cd frontend/android
./gradlew sync
```

Open the app on a device or emulator and check the Firebase console. Analytics events should appear within a few hours. Crashlytics will activate after the first crash or by forcing a test crash.

### Step 6: Force a Test Crash (Optional)

To verify Crashlytics is working, add a temporary crash button or call:

```java
throw new RuntimeException("Test Crashlytics integration");
```

Remove this before any production release.

---

## Common Issues

### Build Fails with "SDK location not found"

**Symptom**: Gradle build fails with an error about missing SDK.

**Fix**: Create or edit `frontend/android/local.properties` and set the SDK path:

```properties
sdk.dir=/home/your-username/Android/Sdk        # Linux
sdk.dir=/Users/your-username/Library/Android/sdk  # macOS
sdk.dir=C\:\\Users\\your-username\\AppData\\Local\\Android\\Sdk  # Windows
```

### "Installed Build Tools revision X is corrupted"

**Symptom**: Build fails referencing corrupted build tools.

**Fix**: Open Android Studio > **Settings > Languages & Frameworks > Android SDK > SDK Tools** and reinstall the affected Build Tools version.

### Signing Errors: "Failed to read key from store"

**Symptom**: The Gradle build fails during signing with a keystore-related error.

**Possible causes and fixes**:

- **Wrong password**: Verify `BETGISTICS_STORE_PASSWORD` and `BETGISTICS_KEY_PASSWORD` in `gradle.properties` are correct.
- **Wrong alias**: Verify `BETGISTICS_KEY_ALIAS` matches the alias used when generating the keystore. List aliases with:

```bash
keytool -list -v -keystore release-key.jks
```

- **Wrong file path**: Verify `BETGISTICS_STORE_FILE` points to the correct location relative to the `android/app/` directory.

### "versionCode X has already been used"

**Symptom**: Play Console rejects the AAB upload.

**Fix**: Increment the `versionCode` in `frontend/android/app/build.gradle`. Every upload to the Play Store must have a strictly higher `versionCode` than any previous upload, across all tracks.

### Capacitor Sync Issues

**Symptom**: Changes to the web app are not reflected in the Android build.

**Fix**: Run a clean sync:

```bash
cd frontend
rm -rf android/app/src/main/assets/public
npm run build
npx cap sync android
```

### Gradle OutOfMemoryError

**Symptom**: Build fails with `java.lang.OutOfMemoryError`.

**Fix**: Increase the Gradle daemon heap size in `frontend/android/gradle.properties`:

```properties
org.gradle.jvmargs=-Xmx4096m -Dfile.encoding=UTF-8
```

### ProGuard/R8 Stripping Required Classes

**Symptom**: The release build crashes at runtime but the debug build works fine.

**Fix**: Add keep rules to `frontend/android/app/proguard-rules.pro` for any classes that are accessed via reflection. For Capacitor apps, the following rules are typically needed:

```proguard
-keep class com.getcapacitor.** { *; }
-keep class com.betgistics.app.** { *; }
```

### App Rejected by Play Store Review

**Common rejection reasons and resolutions**:

- **Missing privacy policy**: Add a privacy policy URL in the Play Console under **App content**.
- **Missing data safety disclosures**: Complete the data safety form under **App content > Data safety**.
- **Crashes during review**: Test the release build thoroughly on multiple devices and API levels before submitting.
- **Metadata issues**: Ensure screenshots, descriptions, and icons meet the Play Store content guidelines.

### Debug vs Release Network Issues

**Symptom**: API calls work in debug builds but fail in release builds.

**Fix**: Android 9+ blocks cleartext (HTTP) traffic by default. Ensure your production backend uses HTTPS. If you must use HTTP during development, add a network security config:

1. Create `frontend/android/app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">localhost</domain>
    </domain-config>
</network-security-config>
```

2. Reference it in `AndroidManifest.xml`:

```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    ... >
```

Only use this for development. Production builds should exclusively use HTTPS.
