// server.js - הקובץ הראשי להפעלת התוסף
const { serveHTTP } = require('stremio-addon-sdk');
const express = require('express');
const os = require('os');
const addonInterface = require('./addon');

// פונקציה לזיהוי כתובת השרת בזמן ריצה
function detectBaseUrl() {
    // אם יש משתנה סביבה, השתמש בו
    if (process.env.BASE_URL) {
        return process.env.BASE_URL;
    }
    
    // בסביבת Render.com, בדרך כלל יש משתנה RENDER_EXTERNAL_URL
    if (process.env.RENDER_EXTERNAL_URL) {
        return process.env.RENDER_EXTERNAL_URL;
    }
    
    // ניסיון לזהות כתובת IP חיצונית
    const networkInterfaces = os.networkInterfaces();
    let externalIp = 'localhost';
    
    Object.keys(networkInterfaces).forEach((interfaceName) => {
        networkInterfaces[interfaceName].forEach((iface) => {
            // מתעלם מכתובות לולאה פנימית ומחפש כתובות IPv4
            if (iface.family === 'IPv4' && !iface.internal) {
                externalIp = iface.address;
            }
        });
    });
    
    // הגדרת הפורט
    const PORT = parseInt(process.env.PORT || 7000, 10);
    return `http://${externalIp}:${PORT}`;
}

// קביעת כתובת הבסיס כמשתנה סביבה גלובלי
process.env.BASE_URL = detectBaseUrl();
console.log(`כתובת בסיס: ${process.env.BASE_URL}`);

// הגדרת פורט - כעת מוודאים שהוא מספר
const PORT = parseInt(process.env.PORT || 7000, 10);

// יצירת אפליקציית Express
const app = express();

// נתיב health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    addonVersion: addonInterface.manifest.version,
    addonName: addonInterface.manifest.name,
    baseUrl: process.env.BASE_URL
  });
});

// ייבוא פונקציונליות תרגום הכתוביות
const { setupSubtitleTranslation } = require('./subtitle-translator');
setupSubtitleTranslation(app);

// הפעלת שרת התוסף עם אפליקציית Express משולבת
serveHTTP(addonInterface, { port: PORT, expressApp: app });

console.log(`התוסף לסטרמיו פועל על פורט ${PORT} עם manifest בכתובת ${process.env.BASE_URL}/manifest.json`);
console.log(`שירות תרגום כתוביות זמין בנתיב ${process.env.BASE_URL}/translate-subtitle`);
