// server.js - הקובץ הראשי להפעלת התוסף - גרסה פשוטה
const { serveHTTP } = require('stremio-addon-sdk');
const express = require('express');
const fetch = require('node-fetch');
const srtParser = require('subtitles-parser');
const translate = require('@vitalets/google-translate-api');
const addonInterface = require('./addon');

// הגדרת פורט - וודא שזה מספר
const PORT = parseInt(process.env.PORT || 7000, 10);

// הגדר BASE_URL לשימוש בaddon.js
process.env.BASE_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
console.log(`כתובת בסיס: ${process.env.BASE_URL}`);

// 1. קודם כל, הפעל את שרת התוסף הבסיסי
serveHTTP(addonInterface, { port: PORT });
console.log(`התוסף לסטרמיו פועל על פורט ${PORT}`);

// 2. הפעל שרת Express נפרד לתרגום כתוביות
const app = express();

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
        const throttleMs = 500;
        const maxConcurrent = 20;
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

// נתיב health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// הפעלת שרת התרגום על פורט שונה (10001 במקום 10000+1)
// משתמשים בפורט ספציפי כדי למנוע בעיות המרה
app.listen(PORT + 1001, () => {
    console.log(`שירות תרגום כתוביות פועל על פורט ${PORT + 1001}`);
    console.log(`שירות תרגום כתוביות זמין בנתיב ${process.env.BASE_URL}/translate-subtitle`);
});
