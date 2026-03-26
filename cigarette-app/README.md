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

פתח **Command Prompt** (cmd) והרץ את הפקודות האלה **אחת אחרי השנייה**:

```cmd
cd C:\cigarette-tracker
echo # cigarette-tracker> README.md
git add README.md
git commit -m "Initial commit"
git push -u origin main
```

> `echo # cigarette-tracker> README.md` יוצר קובץ README בסיסי — זה מבטיח שתמיד יש קובץ לבצע עליו commit, גם אם שאר התיקייה ריקה.

### אם Git לא מוגדר עם שם/אימייל (שגיאה בזמן commit)

הגדר פעם אחת לפני הכל:

```cmd
git config --global user.email "your@email.com"
git config --global user.name "Your Name"
```

### אם ה-remote כבר מוגדר (`remote origin already exists`)

```cmd
git remote set-url origin https://github.com/Motis88/cigarette-tracker.git
git branch -M main
git push -u origin main
```
