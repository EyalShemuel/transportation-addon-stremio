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
