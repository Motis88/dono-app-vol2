# 📱 מדריך מהיר לבדיקה בטלפון / Quick Mobile Testing Guide

## דרך הכי מהירה / Quickest Way

### Windows:
```bash
setup-mobile.bat
```

### Mac/Linux:
```bash
./setup-mobile.sh
```

## בדיקה בדפדפן הטלפון / Test in Phone Browser

1. הרץ את הפקודה / Run:
   ```bash
   npm run dev
   ```

2. תראה הודעה כמו / You'll see a message like:
   ```
   Local:   http://localhost:5173/
   Network: http://192.168.1.100:5173/
   ```

3. בטלפון, פתח דפדפן וגש לכתובת Network / On your phone, open browser and go to the Network address

## בניית APK לאנדרואיד / Build Android APK

1. הרץ את סקריפט ההכנה / Run setup script
2. פתח Android Studio / Open Android Studio:
   ```bash
   npm run mobile:open
   ```
3. ב-Android Studio: `Build` → `Build APK(s)`

## תיקונים שנעשו / Fixes Made

- ✅ שמירת מיקום ותאריך אחרונים / Save last location and date
- ✅ שיפור ממשק המשתמש / UI improvements  
- ✅ תיקון רשימת תורמים / Fixed donor list
- ✅ אופטימיזציה למובייל / Mobile optimization

לפרטים מלאים ראה: `DEPLOYMENT_GUIDE.md`
For full details see: `DEPLOYMENT_GUIDE.md`