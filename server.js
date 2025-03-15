// server.js - פתרון אחיד ופשוט
const { serveHTTP } = require('stremio-addon-sdk');
const express = require('express');
const fetch = require('node-fetch');
const srtParser = require('subtitles-parser');
const translate = require('@vitalets/google-translate-api');

// קביעת כתובת הבסיס לפני טעינת addon.js
// חשוב: זה חייב להיות לפני שטוענים את addon.js!
const PORT = parseInt(process.env.PORT || 7000, 10);
// קבע את הכתובת האמיתית של השרת
const BASE_URL = 'https://stremio-hebrew-translation.onrender.com';
// שמור אותה כמשתנה סביבה כדי שaddon.js יכול להשתמש בה
process.env.BASE_URL = BASE_URL;

// כעת טען את ה-addon שישתמש ב-BASE_URL הנכון
const addonInterface = require('./addon');

// הדפס לוגים לאימות
console.log(`כתובת בסיס מוגדרת: ${BASE_URL}`);

// הפעל את שרת התוסף - שים לב להגדרת host: '0.0.0.0'
serveHTTP(addonInterface, { port: PORT, host: '0.0.0.0' });
console.log(`התוסף לסטרמיו פועל על פורט ${PORT}`);

// יצירת שרת Express נפרד לתרגום כתוביות
const app = express();

// נתיב health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL
  });
});

// נתיב לתרגום כתוביות
app.get('/translate-subtitle', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).send('URL parameter is required');
        }
        
        console.log(`מתרגם כתוביות מהכתובת: ${url}`);
        
        // הורדת קובץ הכתוביות
        const subtitleResponse = await fetch(url);
        if (!subtitleResponse.ok) {
            return res.status(404).send('Could not fetch subtitle file');
        }
        
        const subtitleText = await subtitleResponse.text();
        
        // פרסור הכתוביות
        let parsedSubs;
        try {
            parsedSubs = srtParser.fromSrt(subtitleText);
            console.log(`מתרגם ${parsedSubs.length} שורות כתוביות`);
        } catch (error) {
            return res.status(400).send('Unsupported subtitle format. Only SRT is supported.');
        }
        
        // הגבלת קצב התרגומים
        const throttleMs = parseInt(process.env.GOOGLE_TRANSLATE_THROTTLE || 500, 10);
        const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_TRANSLATIONS || 20, 10);
        const batchSize = Math.min(parsedSubs.length, maxConcurrent);
        
        // תרגום הכתוביות
        for (let i = 0; i < parsedSubs.length; i += batchSize) {
            const batch = parsedSubs.slice(i, i + batchSize);
            
            await Promise.all(
                batch.map(async (sub, idx) => {
                    try {
                        const result = await translate(sub.text, { to: 'he' });
                        parsedSubs[i + idx].text = result.text;
                    } catch (error) {
                        console.error(`שגיאה בתרגום שורה ${i + idx}:`, error);
                    }
                })
            );
            
            if (i + batchSize < parsedSubs.length) {
                await new Promise(resolve => setTimeout(resolve, throttleMs));
            }
        }
        
        // המרה חזרה לפורמט SRT
        const translatedSrt = srtParser.toSrt(parsedSubs);
        
        // שליחת הכתוביות המתורגמות
        res.set('Content-Type', 'text/plain');
        res.send(translatedSrt);
    } catch (error) {
        console.error('שגיאת תרגום כתוביות:', error);
        res.status(500).send('Error translating subtitles');
    }
});

// הפעלת שרת התרגום - השתמש ב-0.0.0.0 כדי לאפשר גישה חיצונית
const TRANSLATION_PORT = PORT + 1001;
app.listen(TRANSLATION_PORT, '0.0.0.0', () => {
    console.log(`שירות תרגום כתוביות פועל על פורט ${TRANSLATION_PORT}`);
    console.log(`שירות תרגום כתוביות זמין בנתיב ${BASE_URL}/translate-subtitle`);
});
