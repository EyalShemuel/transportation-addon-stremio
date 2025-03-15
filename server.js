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

// הוספת כותרות CORS לכל התגובות
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

// נתיב למאניפסט
app.get('/manifest.json', (req, res) => {
  console.log('מקבל בקשה למאניפסט');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(addonInterface.manifest));
});

// נתיב למטא-נתונים
app.get('/meta/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  console.log(`מקבל בקשת מטא-נתונים: ${type} ${id}`);
  
  try {
    const resp = await addonInterface.meta({ type, id });
    res.setHeader('Content-Type', 'application/json');
    res.send(resp);
  } catch (err) {
    console.error(`שגיאה בבקשת מטא-נתונים: ${err}`);
    res.status(500).send({ err: 'שגיאה פנימית' });
  }
});

// נתיב לקטלוג
app.get('/catalog/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  const extra = req.query;
  console.log(`מקבל בקשת קטלוג: ${type} ${id}`, extra);
  
  try {
    const resp = await addonInterface.catalog({ type, id, extra });
    res.setHeader('Content-Type', 'application/json');
    res.send(resp);
  } catch (err) {
    console.error(`שגיאה בבקשת קטלוג: ${err}`);
    res.status(500).send({ err: 'שגיאה פנימית' });
  }
});

// נתיב לזרמים (streams)
app.get('/stream/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  console.log(`מקבל בקשת זרם: ${type} ${id}`);
  
  try {
    const resp = await addonInterface.stream({ type, id });
    res.setHeader('Content-Type', 'application/json');
    res.send(resp);
  } catch (err) {
    console.error(`שגיאה בבקשת זרם: ${err}`);
    res.status(500).send({ err: 'שגיאה פנימית' });
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
            
            <h2>איך לראות את התקצירים בעברית:</h2>
            <ol>
              <li>אחרי התקנת התוסף, בחר סרט או סדרה</li>
              <li>לחץ על כפתור "..." או תפריט אפשרויות נוספות בפינה העליונה</li>
              <li>בחר באפשרות "הצג מידע מ..." (View from...)</li>
              <li>בחר ב"תרגום לעברית" מהרשימה</li>
            </ol>
          </div>
        </div>
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
