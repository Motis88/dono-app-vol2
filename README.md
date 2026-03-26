
# Dono App Vol2

## איך מעבירים את הפרויקט ל-VS Code — מדריך מלא
> **How to open this project in VS Code — full guide**

### דרישות מוקדמות | Prerequisites

| כלי | גרסה מינימלית | הורדה |
|-----|--------------|-------|
| [Node.js](https://nodejs.org) | 18+ | https://nodejs.org |
| [Git](https://git-scm.com) | כלשהי | https://git-scm.com |
| [VS Code](https://code.visualstudio.com) | כלשהי | https://code.visualstudio.com |

---

### שלב 1 — שכפול הפרויקט מ-GitHub
פתח **Terminal** (או **Git Bash** ב-Windows) והרץ:

```bash
git clone https://github.com/Motis88/dono-app-vol2.git
cd dono-app-vol2
```

---

### שלב 2 — פתיחה ב-VS Code

**אפשרות א׳ — מה-Terminal:**
```bash
code .
```

**אפשרות ב׳ — מה-VS Code ישירות:**
1. פתח VS Code
2. בחר **File → Open Folder…**
3. נווט לתיקיית `dono-app-vol2` ולחץ **Open**

---

### שלב 3 — התקנת תוספים מומלצים

עם פתיחת הפרויקט VS Code יציע אוטומטית להתקין את התוספים המומלצים (`.vscode/extensions.json`).  
לחץ **Install All** בפופ-אפ, או פתח ידנית:  
**Extensions** (`Ctrl+Shift+X`) וחפש `@recommended`.

התוספים הנחוצים:
- **ES7+ React Snippets** — קיצורי קוד לריאקט
- **ESLint** — בדיקת שגיאות בקוד
- **Prettier** — עיצוב קוד אוטומטי בשמירה
- **Tailwind CSS IntelliSense** — השלמה אוטומטית לקלאסים של Tailwind
- **GitLens** — כלי Git מתקדמים
- **Path Intellisense** — השלמת נתיבי קבצים

---

### שלב 4 — התקנת תלויות (פעם אחת בלבד)

פתח טרמינל ב-VS Code (`Ctrl+\``) והרץ:

```bash
npm install
```

---

### שלב 5 — הפעלת שרת הפיתוח

```bash
npm run dev
```

הפרויקט יעלה בכתובת **http://localhost:5173** — פתח אותה בדפדפן.

> **קיצור דרך:** לחץ `F5` ב-VS Code ובחר **"▶ הפעל שרת פיתוח"** כדי להריץ ישירות מהעורך.

---

### שלב 6 (אופציונלי) — בנייה לאנדרואיד עם Capacitor

```bash
# בנה את גרסת הייצור
npm run build

# הוסף פלטפורמת אנדרואיד (פעם אחת)
npx cap add android

# סנכרן את הקוד לאנדרואיד
npx cap sync android

# פתח ב-Android Studio
npx cap open android
```

---

### פקודות שימושיות | Useful Commands

| פקודה | תיאור |
|-------|-------|
| `npm run dev` | הפעל שרת פיתוח עם hot-reload |
| `npm run build` | בנה גרסת ייצור לתיקיית `dist/` |
| `npm run preview` | הצג את גרסת הייצור מקומית |
| `npx cap sync android` | סנכרן שינויים לאנדרואיד |

---

## העלאת cigarette-tracker ל-GitHub — פקודות לפי הסדר

> **⚠️ לפני שמריצים:** צור ריפוזיטורי ריק בשם `cigarette-tracker` ב-[github.com/new](https://github.com/new) — **ללא** README, .gitignore או License — הריפוזיטורי חייב להיות **ריק לחלוטין**.

פתח **Command Prompt** (cmd) והרץ:

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

---

## About the Application
Dono App Vol2 is designed to help manage donation processes and track cigarette consumption.

## Goals
- **Efficient Donation Management:** Easy-to-use interface for tracking donations and donors.
- **Cigarette Tracker:** Log cigarettes, view statistics, track purchases and spending insights.
- **User-Friendly Experience:** Clean navigation and intuitive interaction for all users.

## Notes and Recommendations
- Review the codebase regularly to identify areas for optimization.
- Keep dependencies updated for security and performance.
- Encourage feedback from users to improve usability and features.

