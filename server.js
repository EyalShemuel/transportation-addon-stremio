// server.js - הקובץ הראשי להפעלת התוסף
const { serveHTTP } = require('stremio-addon-sdk');
const express = require('express');
const addonInterface = require('./addon');
const { addSubtitleTranslationService } = require('./subtitle-translator');

// יצירת אפליקציית Express
const app = express();

// הוספת שירות התרגום
addSubtitleTranslationService(app);

// הוספת נתיב health check לשרת
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    addonVersion: addonInterface.manifest.version,
    addonName: addonInterface.manifest.name
  });
});

// הגדרת הפורט
const PORT = process.env.PORT || 7000;

// הפעלת שרת התוסף
serveHTTP(addonInterface, { port: PORT, stream: true });

// הוספת לוג להודיע שהשרת פועל
console.log(`התוסף לתרגום לעברית פועל על פורט ${PORT}`);
