# מדריך פריסה ובדיקה בטלפון
## כיצד להעביר ולבדוק את התיקונים באפליקציה שלך

### דרכים שונות לבדוק את האפליקציה בטלפון:

## 🌐 אופציה 1: בדיקה בדפדפן (הכי פשוטה)

### שלב 1: הרצת שרת פיתוח
```bash
npm run dev
```
השרת ירוץ על `http://localhost:5173`

### שלב 2: גישה מהטלפון
1. ודא שהמחשב והטלפון מחוברים לאותה רשת WiFi
2. גלה את כתובת ה-IP של המחשב:
   - Windows: `ipconfig`
   - Mac/Linux: `ifconfig` או `ip addr`
3. בטלפון, פתח דפדפן וגש לכתובת: `http://[IP_ADDRESS]:5173`
   - לדוגמה: `http://192.168.1.100:5173`

### שלב 3: בדיקה בדפדפן הטלפון
האפליקציה תיפתח בדפדפן הטלפון ותוכל לבדוק את כל התיקונים.

---

## 📱 אופציה 2: יצירת אפליקציה לאנדרואיד (APK)

### הכנה ראשונית:
```bash
# התקנת Capacitor CLI גלובלית
npm install -g @capacitor/cli

# יצירת קובץ קונפיגורציה לקפציטור
npx cap init dono-app com.example.donoapp
```

### יצירת פרויקט אנדרואיד:
```bash
# בניית האפליקציה
npm run build

# הוספת פלטפורמת אנדרואיד
npx cap add android

# העתקת הקבצים לפרויקט אנדרואיד
npx cap sync
```

### בניית APK:
```bash
# פתיחה ב-Android Studio
npx cap open android
```

**ב-Android Studio:**
1. לחץ על `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
2. האפליקציה תיבנה ותמצא בתיקייה: `android/app/build/outputs/apk/debug/`
3. העבר את קובץ ה-APK לטלפון והתקן אותו

---

## 🚀 אופציה 3: פריסה מקוונת (GitHub Pages)

### הגדרת GitHub Pages:
1. ב-GitHub, עבור להגדרות הריפוזיטורי
2. גלול ל-`Pages`
3. בחר `GitHub Actions` כמקור
4. צור קובץ `.github/workflows/deploy.yml`

### קובץ GitHub Actions:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm install
      
    - name: Build
      run: npm run build
      
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

לאחר מכן האפליקציה תהיה זמינה בכתובת:
`https://motis88.github.io/dono-app-vol2`

---

## 🔧 אופציה 4: פיתוח עם Live Reload

### הגדרת Capacitor עם Live Reload:
```bash
# הרצת שרת פיתוח
npm run dev

# בטרמינל אחר - הרצה עם live reload
npx cap run android --livereload --external
```

זה יאפשר לך לראות שינויים בזמן אמת באפליקציה בטלפון.

---

## 📋 צעדים מומלצים לבדיקה:

### 1. בדיקה מהירה (דפדפן):
- הרץ `npm run dev`
- גש מהטלפון לכתובת הרשת המקומית
- בדוק את כל התכונות החדשות

### 2. בדיקה מלאה (APK):
- בנה APK
- התקן בטלפון
- בדוק שהאפליקציה עובדת גם ללא אינטרנט

### 3. בדיקה של תכונות ספציפיות:
- שמירת נתונים (localStorage)
- פונקציונליות WhatsApp
- ממשק המגע (swipe gestures)
- ביצועים בטלפון

---

## 🛠 פתרון בעיות נפוצות:

### אם האפליקציה לא נטענת בטלפון:
1. בדוק שהמחשב והטלפון באותה רשת
2. ודא שה-firewall לא חוסם את הפורט 5173
3. נסה לגשת דרך HTTPS במקום HTTP

### אם יש בעיות בבנייה:
```bash
# ניקוי cache
npm run build -- --force
# או
rm -rf node_modules dist
npm install
npm run build
```

### אם APK לא מתקין:
1. ודא שמקורות לא ידועים מותרים בטלפון
2. בדוק שיש מספיק מקום פנוי
3. נסה לבנות APK חדש

---

## 📝 הערות חשובות:

- **לפיתוח**: השתמש באופציה 1 (דפדפן) למהירות
- **לבדיקה מלאה**: השתמש באופציה 2 (APK)
- **לשיתוף**: השתמש באופציה 3 (GitHub Pages)
- **לפיתוח מתקדם**: השתמש באופציה 4 (Live Reload)

התיקונים שנעשו כוללים:
- שמירת מיקום ותאריך אחרונים
- שיפור ממשק המשתמש
- תיקון בעיות ברשימת התורמים
- אופטימיזציה לטלפונים ניידים