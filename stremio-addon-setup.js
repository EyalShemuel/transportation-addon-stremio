// server.js - הקובץ הראשי להפעלת התוסף
const { serveHTTP, getRouter } = require('stremio-addon-sdk');
const addonInterface = require('./addon');
const { addSubtitleTranslationService } = require('./subtitle-translator');

// יצירת נתב Express עם תמיכה בשירות התרגום
const router = getRouter(addonInterface);
addSubtitleTranslationService(router);

// הוספת נתיב health check לשרת
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    addonVersion: addonInterface.manifest.version,
    addonName: addonInterface.manifest.name
  });
});

// הפעלת השרת
const PORT = process.env.PORT || 7000;
router.listen(PORT, () => {
    console.log(`התוסף לתרגום לעברית פועל על פורט ${PORT}`);
});

// package.json - הגדרות הפרויקט
/*
{
  "name": "stremio-hebrew-translation-addon",
  "version": "1.0.0",
  "description": "תוסף תרגום לעברית עבור סטרמיו",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "stremio-addon-sdk": "^1.6.10",
    "node-fetch": "^2.6.7",
    "@vitalets/google-translate-api": "^9.0.0",
    "express": "^4.18.2",
    "subtitles-parser": "^0.0.2"
  },
  "author": "Your Name",
  "license": "MIT"
}
*/

// README.md - הוראות התקנה
/*
# תוסף תרגום לעברית עבור סטרמיו

תוסף זה מתרגם את תוכן סטרמיו לעברית, כולל תיאורי סרטים, תקצירים וכל טקסט שהמשתמש רואה.

## התקנה

1. התקן Node.js מהאתר הרשמי: https://nodejs.org/
2. הורד או שבט את מאגר הקוד הזה
3. פתח את תיקיית הפרויקט בטרמינל והרץ:
   ```
   npm install
   npm start
   ```
4. פתח את Stremio והוסף את התוסף דרך הכתובת:
   ```
   http://127.0.0.1:7000/manifest.json
   ```

## פיתוח

התוסף משתמש ב-Google Translate API כדי לתרגם את התוכן. שים לב שיש מגבלות על כמות הבקשות שניתן לשלוח.

## רישיון

MIT
*/
