// server.js - גרסה סופית מתוקנת
const { serveHTTP } = require('stremio-addon-sdk');
const express = require('express');
const http = require('http');
const { setupSubtitleTranslation } = require('./subtitle-translator');

// קביעת כתובת הבסיס
const PORT = parseInt(process.env.PORT || 7000, 10);
const BASE_URL = 'https://stremio-hebrew-translation.onrender.com';
process.env.BASE_URL = BASE_URL;

// טעינת התוסף
const addonInterface = require('./addon');

// יצירת אפליקציית Express
const app = express();

// הגדרת דף הבית
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

// הוספת שירות תרגום הכתוביות
setupSubtitleTranslation(app);

// יצירת שרת Express
const expressServer = app.listen(PORT, '0.0.0.0', () => {
  console.log(`השרת המאוחד פועל על פורט ${PORT}`);
  console.log(`כתובת המאניפסט: ${BASE_URL}/manifest.json`);
  console.log(`שירות תרגום כתוביות: ${BASE_URL}/translate-subtitle`);
});

// הוספת הנתיבים של התוסף על גבי אותו שרת Express
// במקום להשתמש ב-handleStremioEndpoints, נשתמש ב-serveHTTP עם האופציה של server
serveHTTP(addonInterface, { 
  server: expressServer, 
  logger: console 
});
