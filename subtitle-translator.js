// שירות תרגום כתוביות מאנגלית לעברית
const express = require('express');
const fetch = require('node-fetch');
const srtParser = require('subtitles-parser');
const translate = require('@vitalets/google-translate-api');

// נתיב לתרגום כתוביות - מקבל אפליקציית Express
function addSubtitleTranslationService(app) {
    // וודא שהאפליקציה קיימת
    if (!app) {
        console.error('אפליקציית Express לא סופקה לשירות תרגום הכתוביות');
        return;
    }

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
            
            // הניחו שהפורמט הוא SRT או רק VTT (הכי נפוצים)
            let parsedSubs;
            try {
                // ניסיון לפרסר בפורמט SRT
                parsedSubs = srtParser.fromSrt(subtitleText);
            } catch (error) {
                // אם זה לא SRT, ננסה לפרסר VTT בסיסי
                // פרסור VTT מלא הוא יותר מורכב, זה רק בסיסי
                return res.status(400).send('Unsupported subtitle format. Only SRT is supported.');
            }
            
            // הגבלת קצב התרגומים כדי להימנע מחריגה ממגבלות API
            const throttleMs = process.env.GOOGLE_TRANSLATE_THROTTLE || 500;
            const maxConcurrent = process.env.MAX_CONCURRENT_TRANSLATIONS || 20;
            
            // תרגום כל שורת כתובית לעברית עם הגבלת קצב
            // נחלק את העבודה לקבוצות כדי לא לעבור את מגבלות ה-API
            const batchSize = Math.min(parsedSubs.length, maxConcurrent);
            
            for (let i = 0; i < parsedSubs.length; i += batchSize) {
                const batch = parsedSubs.slice(i, i + batchSize);
                
                // תרגום הקבוצה הנוכחית במקביל
                await Promise.all(
                    batch.map(async (sub, idx) => {
                        try {
                            const result = await translate(sub.text, { to: 'he' });
                            parsedSubs[i + idx].text = result.text;
                        } catch (error) {
                            console.error(`Error translating subtitle at index ${i + idx}:`, error);
                            // אם התרגום נכשל, נשאיר את הטקסט המקורי
                        }
                    })
                );
                
                // המתנה לפני הקבוצה הבאה כדי להימנע מחסימת API
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

    console.log('שירות תרגום כתוביות הופעל');
}

module.exports = { addSubtitleTranslationService };
