# FireHome: a custom Fire TV home screen

Glass app tiles, an animated neon-city wallpaper, clock, weather, a Favorites row and a background picker.
Written to be light enough for the Fire TV Stick 4K (1st gen, 1.5 GB RAM).

## Get the app (about 15 minutes, no coding)

GitHub builds the app for you for free, so you don't need Android Studio.

1. **Make a free GitHub account** at https://github.com/signup (skip if you have one).
2. Click the **+** at the top right, then **New repository**. Name it `FireHome`, leave it **Public**, click **Create repository**.
3. On the new page, click **uploading an existing file**. Open this folder on your PC, press **Ctrl+A** to select everything inside it, and **drag it all** into the browser window. Wait until every file finishes uploading, then click **Commit changes**.
   - Check the file list afterwards. You should see `.github`, `app`, `build.gradle`, `settings.gradle`... If `.github` is missing, click **Add file > Create new file**, type `.github/workflows/build.yml` as the name, paste in the contents of that file from this folder, and commit.
4. Click the **Actions** tab. A workflow called **Build APK** starts by itself (if GitHub asks, click **I understand my workflows, go ahead and enable them**). Wait about 4 minutes for a green check.
5. Click the finished run. At the bottom, under **Artifacts**, click **FireHome-apk**. A zip downloads. Extract it to get `app-debug.apk`.
6. Copy `app-debug.apk` into your `platform-tools` folder.

If the run shows a red X, open it, copy the red error lines and send them to Claude.

## Install it

In the command window (inside `platform-tools`):

```
adb connect 192.168.1.240:5555
adb install app-debug.apk
```

Wait for `Success`.

## Try it before changing the Home button

On the Fire TV: **Settings > Applications > Manage Installed Applications > FireHome > Launch application**.
Pressing Back just returns to the top of the screen, so to leave it, press the Home button (still Amazon's for now).

Remote controls:

| Button | Does |
| --- | --- |
| Arrows | Move around |
| Center | Open the app |
| Menu (the three-line button), or hold Center | Options for the app: add/remove Favorites, move left/right, hide, app info, uninstall |
| Back | Close a menu, or jump back to the top |

The round buttons at the top right are Home, Hidden apps (show or hide the apps you hid), Background, and Settings.

## Make the Home button open FireHome

Amazon's home screen normally owns the Home button. The usual way around it is to switch Amazon's launcher off:

```
adb shell pm disable-user --user 0 com.amazon.tv.launcher
```

Then press Home on the remote. FireHome should come up.

**To undo it at any time** (run from the PC, which works even if the TV screen looks wrong):

```
adb shell pm enable com.amazon.tv.launcher
```

Notes:
- Keep **ADB debugging** turned on so you can always undo this.
- A Fire OS update can switch Amazon's launcher back on. Just run the first command again.
- Do this only after you've tried FireHome and like it.

## Your own backgrounds

Built-in wallpapers: Neon Downtown, Golden Hour, Future City, Aurora, Midnight. Open them with the picture button at the top right.
In that screen you can turn the animation off (a still picture is easiest on the Fire Stick) or use **Preview** to see the wallpaper without the tiles.

To use your own photos, copy `.jpg` or `.png` files to the Fire Stick:

```
adb push my-photo.jpg /sdcard/Android/data/com.firehome.launcher/files/backgrounds/
```

Reopen the Background screen and they appear after the built-in ones. Use pictures that are 1920 pixels wide or smaller.

## Change your name, units or weather location

Open `app/src/main/assets/config.js` (on GitHub, click the file and then the pencil icon), edit it, commit, and the Actions tab builds a new APK. Leave `city`, `lat` and `lon` as `null` to find your weather location automatically.

## Remove it

```
adb shell pm enable com.amazon.tv.launcher
adb uninstall com.firehome.launcher
```
