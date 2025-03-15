// server.js - גרסה פשוטה יותר שבוודאות תעבוד
const { serveHTTP } = require('stremio-addon-sdk');
const addonInterface = require('./addon');
const express = require('express');
const fetch = require('node-fetch');
const srtParser = require('subtitles-parser');
const translate = require('@vitalets/google-translate-api');

// הגדרת פורט
const PORT = process.env.PORT || 7000;

// קודם כל, הפעל את ממשק התוסף העיקרי של stremio
serveHTTP(addonInterface, { port: PORT });

// הוסף שירות תרגום כתוביות (נפרד)
const app = express();

// נתיב health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// נתיב לתרגום כתוביות
app.get('/translate-subtitle', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).send('URL parameter is required');
        }
        
        // הורדת קובץ הכתוביות
        const subtitleResponse = await fetch(url);
        if (!subtitleResponse.ok) {
            return res.status(404).send('Could not fetch subtitle file');
        }
        
        const subtitleText = await subtitleResponse.text();
        
        // פרסור הכתוביות בפורמט SRT
        let parsedSubs;
        try {
            parsedSubs = srtParser.fromSrt(subtitleText);
        } catch (error) {
            return res.status(400).send('Unsupported subtitle format. Only SRT is supported.');
        }
        
        // הגבלת קצב התרגומים
        const throttleMs = process.env.GOOGLE_TRANSLATE_THROTTLE || 500;
        const maxConcurrent = process.env.MAX_CONCURRENT_TRANSLATIONS || 20;
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
                        console.error(`Error translating subtitle at index ${i + idx}:`, error);
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
        console.error('Subtitle translation error:', error);
        res.status(500).send('Error translating subtitles');
    }
});

// הפעלת שרת התרגום על פורט שונה
const TRANSLATION_PORT = parseInt(PORT) + 1;
app.listen(TRANSLATION_PORT, () => {
    console.log(`שירות תרגום כתוביות פועל על פורט ${TRANSLATION_PORT}`);
});

console.log(`התוסף לסטרמיו פועל על פורט ${PORT} - manifest בכתובת http://tremio-hebrew-translation.onrender.com:${PORT}/manifest.json`);
