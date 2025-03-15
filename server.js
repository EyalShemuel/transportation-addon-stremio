// server.js - גרסה מתוקנת לשימוש ב-stremio-addon-sdk
const { addonBuilder } = require('stremio-addon-sdk');
const express = require('express');
const fetch = require('node-fetch');
const srtParser = require('subtitles-parser');
const translate = require('@vitalets/google-translate-api');
const http = require('http');

// קביעת כתובת הבסיס
const PORT = parseInt(process.env.PORT || 7000, 10);
const BASE_URL = 'https://stremio-hebrew-translation.onrender.com';
process.env.BASE_URL = BASE_URL;

// טעינת התוסף
const addonInterface = require('./addon');

// יצירת אפליקציית Express
const app = express();

// יצירת שרת HTTP ידני
const server = http.createServer(app);

// פונקציה לניתוב בקשות Stremio
function handleStremioEndpoints(req, res, next) {
    // בדיקה אם זו בקשה לנתיב Stremio
    const stremioEndpoints = [
        '/manifest.json',
        '/meta/',
        '/catalog/',
        '/stream/'
    ];

    // בדיקה אם הבקשה היא לאחד מנתיבי ה-API של Stremio
    const isStremioEndpoint = stremioEndpoints.some(endpoint => 
        req.url.startsWith(endpoint)
    );

    if (isStremioEndpoint) {
        // העברת הבקשה ל-addonInterface
        console.log(`מעביר בקשת Stremio: ${req.url}`);
        
        // להעתיק את המאפיינים של הבקשה לאובייקט חדש שידמה בקשת Express
        const addonReq = {
            url: req.url,
            method: req.method,
            headers: req.headers,
            on: req.on.bind(req),
            addListener: req.addListener.bind(req)
        };
        
        // הגדרת res.end המקורי
        const originalEnd = res.end;
        
        // החלפת res.end כדי לרשום לוג
        res.end = function(...args) {
            console.log(`סיום בקשת Stremio: ${req.url}`);
            return originalEnd.apply(this, args);
        };
        
        // הפעלת הרוטר של ה-addon
        addonInterface(addonReq, res, () => {
            // אם ה-addon לא טיפל בבקשה, המשך לניתוב הבא
            console.log(`הבקשה ${req.url} לא טופלה על ידי התוסף, ממשיך לניתוב הבא`);
            next();
        });
    } else {
        // אם זה לא נתיב Stremio, המשך לניתובים הבאים
        next();
    }
}

// הוספת מידלוור לטיפול בנתיבי Stremio
app.use(handleStremioEndpoints);

// נתיב שורש לתיעוד
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
          .instructions { margin-top: 30px; padding: 15px; background-color: #f9f9f9; border-right: 3px solid #2c3e50; }
          .instructions h2 { margin-top: 0; }
          .instructions ol { padding-right: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>תוסף תרגום לעברית עבור Stremio</h1>
          <p>התוסף פועל! כדי להוסיף אותו ל-Stremio, השתמש בכתובת:</p>
          <a href="${BASE_URL}/manifest.json">${BASE_URL}/manifest.json</a>

          <div class="instructions">
            <h2>הוראות התקנה:</h2>
            <ol>
              <li>פתח את אפליקציית Stremio</li>
              <li>לך להגדרות (Settings) > תוספים (Add-ons)</li>
              <li>לחץ על "התקן תוסף" (Install Add-on)</li>
              <li>הדבק את הכתובת: <code>${BASE_URL}/manifest.json</code></li>
              <li>לחץ על "התקן" (Install)</li>
            </ol>
          </div>
        </div>
      </body>
    </html>
  `);
});

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

// הפעלת השרת המאוחד
server.listen(PORT, '0.0.0.0', () => {
    console.log(`השרת המאוחד פועל על פורט ${PORT}`);
    console.log(`כתובת המאניפסט: ${BASE_URL}/manifest.json`);
    console.log(`שירות תרגום כתוביות: ${BASE_URL}/translate-subtitle`);
});
