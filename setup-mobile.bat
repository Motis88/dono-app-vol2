@echo off
chcp 65001 >nul
echo 🚀 מכין את האפליקציה לטלפון...
echo 🚀 Preparing app for mobile...

if not exist node_modules (
    echo 📦 מתקין תלויות...
    echo 📦 Installing dependencies...
    call npm install
)

echo 🔨 בונה את האפליקציה...
echo 🔨 Building application...
call npm run build

if not exist capacitor.config.ts (
    echo ⚡ מכין Capacitor...
    echo ⚡ Setting up Capacitor...
    call npm run mobile:init
)

if not exist android (
    echo 🤖 מוסיף Android platform...
    echo 🤖 Adding Android platform...
    call npm run mobile:add
)

echo 🔄 מסנכרן קבצים...
echo 🔄 Syncing files...
call npm run mobile:sync

echo.
echo ✅ האפליקציה מוכנה!
echo ✅ App is ready!
echo.
echo 📱 לפתיחה ב-Android Studio:
echo 📱 To open in Android Studio:
echo    npm run mobile:open
echo.
echo 🌐 להרצה בדפדפן (גישה מהטלפון):
echo 🌐 To run in browser (access from phone):
echo    npm run dev
echo    ואז גש מהטלפון לכתובת שתופיע (with your network IP)
echo.
echo 🔄 לפיתוח עם live reload:
echo 🔄 For development with live reload:
echo    npm run mobile:live
echo.
pause