# 🚬 מעקב עישון — Cigarette Tracker

אפליקציית React עצמאית למעקב אחרי עישון, רכישות ותובנות.

## התקנה והפעלה

```bash
cd cigarette-app
npm install
npm run dev   # → http://localhost:5174
```

## build לייצור

```bash
npm run build
```

## תכונות

- **בית** — רישום סיגריה בלחיצה אחת + ציר זמן יומי
- **סטטיסטיקות** — גרפים יומיים / שבועיים / חודשיים / שעתיים
- **רכישות** — מעקב הוצאות וחישוב עלות לגרם
- **תובנות** — זמן ממוצע בין סיגריות, מגמות, הוצאה חודשית משוערת
- **הגדרות** — גרמים לסיגריה ומטבע

---

## העלאת הפרויקט ל-GitHub — פקודות לפי הסדר

> **⚠️ לפני שמריצים:** צור ריפוזיטורי ריק בשם `cigarette-tracker` ב-[github.com/new](https://github.com/new)  
> **ללא** סימון של README, .gitignore או License — הריפוזיטורי חייב להיות **ריק לחלוטין**.

פתח **Git Bash** והרץ את הפקודות האלה **אחת אחרי השנייה** — ודא שכל אחת מצליחה לפני שממשיכים:

```bash
cd C:\cigarette-tracker
git init
git add .
git status
git commit -m "Initial commit"
git log --oneline
git remote add origin https://github.com/Motis88/cigarette-tracker.git
git branch -M main
git push -u origin main
```

### שגיאה נפוצה: `error: src refspec main does not match any`

שגיאה זו אומרת שה-`commit` לא בוצע — לא נוצר ברנץ' `main` כי אין commits.  
הגורמים האפשריים ופתרונם:

**סיבה 1 — `git add .` לא הוסיף קבצים (תיקייה ריקה)**  
הרץ `git status` — אם הפלט מראה `nothing to commit`, ודא שאתה בתיקייה הנכונה ושיש בה קבצים.

**סיבה 2 — שכחת להגדיר שם משתמש ואימייל ב-Git**  
הרץ פעם אחת (מחוץ לכל תיקייה):

```bash
git config --global user.email "your@email.com"
git config --global user.name "Your Name"
```

ואז חזור לשלבים מהתחלה.

**סיבה 3 — כבר ניסית קודם וה-remote כבר מוגדר**  
אם מקבלים `remote origin already exists`, הרץ:

```bash
git remote set-url origin https://github.com/Motis88/cigarette-tracker.git
git branch -M main
git push -u origin main
```
