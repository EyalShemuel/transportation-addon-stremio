// server.js - קובץ שרת פשוט המשתמש ב-serveHTTP בלבד
const { serveHTTP } = require('stremio-addon-sdk');
const express = require('express');
const fetch = require('node-fetch');
const srtParser = require('subtitles-parser');
const translate = require('@vitalets/google-translate-api');

// קביעת כתובת הבסיס
const PORT = parseInt(process.env.PORT || 7000, 10);
const BASE_URL = 'https://stremio-hebrew-translation.onrender.com';
process.env.BASE_URL = BASE_URL;

// טעינת התוסף - השתמש בממשק שהוחזר מ-addon.js
const addonInterface = require('./addon');

// יצירת שרת Express נפרד לתרגום כתוביות
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

// דף בית פשוט
app.get('/', (req, res) => {
    res.send(`
    <html dir="rtl">
      <head>
        <title>תוסף תרגום לעברית עבור Stremio</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #2c3e50; }
          a { display: inline-block; margin: 10px 0; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 3px; }
          a:hover { background-color: #2980b9; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>תוסף תרגום לעברית עבור Stremio</h1>
          <p>התוסף פועל! כדי להוסיף אותו ל-Stremio, השתמש בכתובת:</p>
          <a href="${BASE_URL}/manifest.json">${BASE_URL}/manifest.json</a>
        </div>
      </body>
    </html>
  `);
});

// הפעלת שרת Express לתרגום כתוביות
const TRANSLATE_PORT = PORT + 1;
app.listen(TRANSLATE_PORT, '0.0.0.0', () => {
    console.log(`שרת תרגום הכתוביות פועל על פורט ${TRANSLATE_PORT}`);
});

// הפעלת שרת התוסף עם serveHTTP
serveHTTP(addonInterface, { port: PORT, bindAddr: '0.0.0.0' });

console.log(`שרת התוסף פועל על פורט ${PORT}`);
console.log(`כתובת המאניפסט: ${BASE_URL}/manifest.json`);
console.log(`שירות תרגום כתוביות: ${BASE_URL}/translate-subtitle`);
