// server.js - פתרון מאוחד עם Express
const express = require('express');
const { addonBuilder } = require('stremio-addon-sdk');
const fetch = require('node-fetch');
const srtParser = require('subtitles-parser');
const translate = require('@vitalets/google-translate-api');

// קביעת כתובת הבסיס
const PORT = parseInt(process.env.PORT || 7000, 10);
const BASE_URL = 'https://stremio-hebrew-translation.onrender.com';
process.env.BASE_URL = BASE_URL;

// יצירת אפליקציית Express אחת לכל הנתיבים
const app = express();

// טעינת התוסף (במקום להשתמש בserveHTTP, נשתמש בממשק ישירות)
const addonInterface = require('./addon');

// נתיב למאניפסט
app.get('/manifest.json', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(addonInterface.manifest));
});

// נתיבים אחרים של התוסף
app.get('/:resource/:type/:id/:extra?.json', (req, res) => {
  const { resource, type, id } = req.params;
  const extra = req.params.extra ? JSON.parse(decodeURIComponent(req.params.extra)) : {};

  console.log('קיבל בקשה:', resource, type, id, extra);

  // פנייה לפונקציה המתאימה בממשק התוסף
  const handler = addonInterface[resource];
  
  if (handler) {
    handler({ type, id, extra })
      .then(resp => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Content-Type', 'application/json');
        res.send(resp);
      })
      .catch(err => {
        console.error('שגיאה בטיפול בבקשה:', err);
        res.status(500).send({ err: 'שגיאה פנימית בשרת' });
      });
  } else {
    res.status(404).send({ err: 'לא נמצא משאב' });
  }
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

// נתיב שורש לבדיקת חיבור
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>תוסף תרגום לעברית עבור Stremio</title></head>
      <body>
        <h1>תוסף תרגום לעברית עבור Stremio</h1>
        <p>התוסף פועל! כדי להוסיף אותו ל-Stremio, השתמש בכתובת:</p>
        <a href="${BASE_URL}/manifest.json">${BASE_URL}/manifest.json</a>
      </body>
    </html>
  `);
});

// הפעלת השרת על פורט יחיד
app.listen(PORT, '0.0.0.0', () => {
    console.log(`השרת המאוחד פועל על פורט ${PORT}`);
    console.log(`כתובת המאניפסט: ${BASE_URL}/manifest.json`);
    console.log(`שירות תרגום כתוביות: ${BASE_URL}/translate-subtitle`);
});
