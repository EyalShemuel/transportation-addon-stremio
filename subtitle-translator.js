//subtitle-translator.js
// שירות תרגום כתוביות מאנגלית לעברית
const fetch = require('node-fetch');
const srtParser = require('subtitles-parser');
const translate = require('@vitalets/google-translate-api');

// הגדרת שירות תרגום הכתוביות
function setupSubtitleTranslation(app) {
    if (!app) {
        throw new Error('אפליקציית Express חסרה בהגדרת שירות תרגום הכתוביות');
    }

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
                console.error(`שגיאה בהורדת הכתוביות: ${subtitleResponse.status}`);
                return res.status(404).send('Could not fetch subtitle file');
            }
            
            const subtitleText = await subtitleResponse.text();
            
            // ניסיון לפרסר את הכתוביות
            let parsedSubs;
            try {
                // ניסיון לפרסר בפורמט SRT
                parsedSubs = srtParser.fromSrt(subtitleText);
                console.log(`נמצאו ${parsedSubs.length} שורות כתוביות לתרגום`);
            } catch (error) {
                console.error('שגיאה בפרסור הכתוביות:', error);
                return res.status(400).send('Unsupported subtitle format. Only SRT is supported.');
            }
            
            // הגבלת קצב התרגומים כדי להימנע מחריגה ממגבלות API
            const throttleMs = process.env.GOOGLE_TRANSLATE_THROTTLE || 500;
            const maxConcurrent = process.env.MAX_CONCURRENT_TRANSLATIONS || 20;
            
            // תרגום כל שורת כתובית לעברית עם הגבלת קצב
            // נחלק את העבודה לקבוצות כדי לא לעבור את מגבלות ה-API
            const batchSize = Math.min(parsedSubs.length, maxConcurrent);
            console.log(`מתרגם בקבוצות של ${batchSize} שורות, עם השהיה של ${throttleMs}ms בין קבוצות`);
            
            for (let i = 0; i < parsedSubs.length; i += batchSize) {
                const batch = parsedSubs.slice(i, i + batchSize);
                console.log(`מתרגם קבוצה ${Math.floor(i/batchSize) + 1}/${Math.ceil(parsedSubs.length/batchSize)}`);
                
                // תרגום הקבוצה הנוכחית במקביל
                await Promise.all(
                    batch.map(async (sub, idx) => {
                        try {
                            const result = await translate(sub.text, { to: 'he' });
                            parsedSubs[i + idx].text = result.text;
                        } catch (error) {
                            console.error(`שגיאה בתרגום שורה ${i + idx}:`, error);
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
            console.log('התרגום הושלם, שולח כתוביות מתורגמות');
            
            // שליחת הכתוביות המתורגמות
            res.set('Content-Type', 'text/plain');
            res.set('Content-Disposition', 'attachment; filename="hebrew-subtitles.srt"');
            res.send(translatedSrt);
        } catch (error) {
            console.error('שגיאה כללית בתרגום כתוביות:', error);
            res.status(500).send('Error translating subtitles');
        }
    });

    console.log('שירות תרגום כתוביות הופעל');
    return app;
}

module.exports = { setupSubtitleTranslation };
