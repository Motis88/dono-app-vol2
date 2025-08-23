#!/bin/bash

# סקריפט להכנת האפליקציה לטלפון
# Mobile deployment script for Dono App

echo "🚀 מכין את האפליקציה לטלפון..."
echo "🚀 Preparing app for mobile..."

# בדיקה אם קיימים node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 מתקין תלויות..."
    echo "📦 Installing dependencies..."
    npm install
fi

# בניית האפליקציה
echo "🔨 בונה את האפליקציה..."
echo "🔨 Building application..."
npm run build

# בדיקה אם Capacitor מוכן
if [ ! -f "capacitor.config.ts" ]; then
    echo "⚡ מכין Capacitor..."
    echo "⚡ Setting up Capacitor..."
    npm run mobile:init
fi

# בדיקה אם Android קיים
if [ ! -d "android" ]; then
    echo "🤖 מוסיף Android platform..."
    echo "🤖 Adding Android platform..."
    npm run mobile:add
fi

# סינכרון הקבצים
echo "🔄 מסנכרן קבצים..."
echo "🔄 Syncing files..."
npm run mobile:sync

echo ""
echo "✅ האפליקציה מוכנה!"
echo "✅ App is ready!"
echo ""
echo "📱 לפתיחה ב-Android Studio:"
echo "📱 To open in Android Studio:"
echo "   npm run mobile:open"
echo ""
echo "🌐 להרצה בדפדפן (גישה מהטלפון):"
echo "🌐 To run in browser (access from phone):"
echo "   npm run dev"
echo "   ואז גש מהטלפון לכתובת שתופיע (with your network IP)"
echo ""
echo "🔄 לפיתוח עם live reload:"
echo "🔄 For development with live reload:"
echo "   npm run mobile:live"
echo ""