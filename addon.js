// תוסף תרגום לעברית עבור Stremio
const { addonBuilder } = require('stremio-addon-sdk');
const fetch = require('node-fetch');
const translate = require('@vitalets/google-translate-api');

// השתמש בכתובת הבסיס מהמשתנה סביבה (מוגדר ב-server.js)
const BASE_URL = process.env.BASE_URL;
console.log(`addon.js: Using BASE_URL: ${BASE_URL}`);

// יצירת תוסף חדש
const addon = new addonBuilder({
    id: 'org.hebrew.translation',
    version: '1.0.0',
    name: 'תרגום לעברית',
    description: 'תוסף זה מתרגם תוכן סטרמיו לעברית',
    resources: ['catalog', 'meta', 'stream'],
    types: ['movie', 'series'],
    catalogs: [
        {
            type: 'movie',
            id: 'hebrew-movies'
        },
        {
            type: 'series',
            id: 'hebrew-series'
        }
    ],
    background: 'https://www.publicdomainpictures.net/pictures/290000/velka/israel-flag.jpg',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/d/d4/Flag_of_Israel.svg'
});

// פונקציה לתרגום טקסט לעברית
async function translateToHebrew(text) {
    if (!text) return text;
    
    console.log(`מנסה לתרגם: "${text.substring(0, 30)}..."`);
    
    try {
        const result = await translate(text, { to: 'he' });
        console.log(`תרגום הצליח: "${result.text.substring(0, 30)}..."`);
        return result.text;
    } catch (error) {
        console.error('שגיאת תרגום:', error.message || error);
        // בגלל שגיאה, מחזירים את הטקסט המקורי
        return text;
    }
}

// עיבוד מטא-נתונים עם תרגום
async function translateMetadata(meta) {
    if (!meta) return meta;
    
    console.log(`מתחיל תרגום מטא-נתונים עבור: ${meta.name || 'ללא שם'}`);
    
    const translatedMeta = { ...meta };
    
    // תרגום כותרת
    if (meta.name) {
        translatedMeta.name = await translateToHebrew(meta.name);
    }
    
    // תרגום תקציר
    if (meta.description) {
        translatedMeta.description = await translateToHebrew(meta.description);
    }
    
    // תרגום ז'אנרים
    if (meta.genres && Array.isArray(meta.genres)) {
        console.log(`מתרגם ${meta.genres.length} ז'אנרים`);
        translatedMeta.genres = await Promise.all(
            meta.genres.map(genre => translateToHebrew(genre))
        );
    }
    
    // תרגום פרטי שחקנים
    if (meta.cast && Array.isArray(meta.cast)) {
        console.log(`מתרגם ${meta.cast.length} פרטי שחקנים`);
        translatedMeta.cast = await Promise.all(
            meta.cast.map(async (actor) => {
                if (typeof actor === 'string') {
                    return await translateToHebrew(actor);
                } else if (actor && actor.name) {
                    return {
                        ...actor,
                        name: await translateToHebrew(actor.name),
                    };
                }
                return actor;
            })
        );
    }
    
    // תרגום שמות במאים
    if (meta.director && Array.isArray(meta.director)) {
        console.log(`מתרגם ${meta.director.length} שמות במאים`);
        translatedMeta.director = await Promise.all(
            meta.director.map(director => translateToHebrew(director))
        );
    }
    
    // תרגום תקצירי פרקים (לסדרות)
    if (meta.videos && Array.isArray(meta.videos)) {
        console.log(`מתרגם ${meta.videos.length} תקצירי פרקים`);
        translatedMeta.videos = await Promise.all(
            meta.videos.map(async (video) => {
                return {
                    ...video,
                    title: video.title ? await translateToHebrew(video.title) : video.title,
                    overview: video.overview ? await translateToHebrew(video.overview) : video.overview,
                };
            })
        );
    }
    
    console.log(`סיים תרגום מטא-נתונים עבור: ${translatedMeta.name || 'ללא שם'}`);
    return translatedMeta;
}

// קבלת מטא-נתונים מקוריים ותרגום שלהם
addon.defineMetaHandler(async ({ type, id }) => {
    console.log(`מטפל בבקשת meta: ${type} ${id}`);
    
    try {
        // קבלת המטא-נתונים מהשרתים המקוריים של סטרמיו או תוספים אחרים
        console.log(`שולח בקשה למטא-נתונים מקוריים: ${type} ${id}`);
        const originalMetaResponse = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${id}.json`);
        
        if (!originalMetaResponse.ok) {
            throw new Error(`Failed to fetch original meta: ${originalMetaResponse.status}`);
        }
        
        const originalMeta = await originalMetaResponse.json();
        console.log(`קיבל מטא-נתונים מקוריים: ${type} ${id}`, 
                    originalMeta.meta ? originalMeta.meta.name : 'ללא שם');
        
        // תרגום המטא-נתונים לעברית
        console.log(`מתחיל תרגום המטא-נתונים: ${type} ${id}`);
        const translatedMeta = await translateMetadata(originalMeta.meta);
        console.log(`סיים תרגום המטא-נתונים: ${type} ${id}`, 
                    translatedMeta ? translatedMeta.name : 'ללא שם');
        
        return { meta: translatedMeta };
    } catch (error) {
        console.error(`שגיאה בטיפול במטא-נתונים: ${type} ${id}`, error);
        return { meta: null };
    }
});

// הגדרת קטלוג עם תוכן מתורגם
addon.defineCatalogHandler(async ({ type, id, extra }) => {
    console.log(`מטפל בבקשת catalog: ${type} ${id}`, extra);
    
    try {
        // אחזור קטלוג מקורי
        let catalogUrl = `https://v3-cinemeta.strem.io/catalog/${type}/top.json`;
        
        if (extra && extra.genre) {
            catalogUrl = `https://v3-cinemeta.strem.io/catalog/${type}/top/${extra.genre}.json`;
        }
        
        if (extra && extra.skip) {
            catalogUrl += `?skip=${extra.skip}`;
        }
        
        console.log(`שולח בקשה לקטלוג מקורי: ${catalogUrl}`);
        const originalCatalogResponse = await fetch(catalogUrl);
        
        if (!originalCatalogResponse.ok) {
            throw new Error(`Failed to fetch original catalog: ${originalCatalogResponse.status}`);
        }
        
        const originalCatalog = await originalCatalogResponse.json();
        console.log(`קיבל קטלוג מקורי עם ${originalCatalog.metas ? originalCatalog.metas.length : 0} פריטים`);
        
        // תרגום פריטי הקטלוג
        console.log(`מתחיל תרגום פריטי הקטלוג`);
        const translatedMetas = await Promise.all(
            originalCatalog.metas.map(async (item) => {
                const translated = { ...item };
                
                // תרגום כותרת
                if (item.name) {
                    translated.name = await translateToHebrew(item.name);
                }
                
                // תרגום תקציר
                if (item.description) {
                    translated.description = await translateToHebrew(item.description);
                }
                
                return translated;
            })
        );
        
        console.log(`סיים תרגום ${translatedMetas.length} פריטי קטלוג`);
        return {
            metas: translatedMetas
        };
    } catch (error) {
        console.error('שגיאה בטיפול בקטלוג:', error);
        return { metas: [] };
    }
});

// תמיכה בכתוביות בעברית עם אפשרות לתרגום אוטומטי מאנגלית
addon.defineStreamHandler(async ({ type, id }) => {
    console.log(`מטפל בבקשת stream: ${type} ${id}`);
    
    try {
        // בהנחה שיש תוסף אחר שמספק כתוביות
        console.log(`שולח בקשה לכתוביות עבור: ${type} ${id}`);
        const subtitleResponse = await fetch(`https://v3-community-subs.strem.io/subtitles/${type}/${id}.json`);
        
        if (!subtitleResponse.ok) {
            console.log(`לא נמצאו כתוביות עבור: ${type} ${id}`);
            // אם אין כתוביות, פשוט נמשיך בלעדיהן
            return { streams: [] };
        }
        
        const subtitleData = await subtitleResponse.json();
        console.log(`נמצאו ${subtitleData.subtitles ? subtitleData.subtitles.length : 0} כתוביות`);
        
        // מסנן רק כתוביות בעברית
        const hebrewSubtitles = subtitleData.subtitles.filter(sub => 
            sub.lang === 'heb' || sub.lang === 'he' || sub.lang === 'hebrew'
        );
        
        console.log(`נמצאו ${hebrewSubtitles.length} כתוביות בעברית`);
        
        let streams = [];
        
        // אם יש כתוביות בעברית, נשתמש בהן
        if (hebrewSubtitles.length > 0) {
            console.log(`משתמש בכתוביות בעברית מקוריות`);
            streams = hebrewSubtitles.map(sub => ({
                id: `he-subtitle-${sub.id}`,
                title: 'כתוביות בעברית',
                subtitle: {
                    url: sub.url,
                    lang: 'he'
                }
            }));
        } else {
            // אם אין כתוביות בעברית, ננסה למצוא כתוביות באנגלית ולספק אפשרות לתרגום אוטומטי
            console.log(`מחפש כתוביות באנגלית לתרגום אוטומטי`);
            const englishSubtitles = subtitleData.subtitles.filter(sub =>
                sub.lang === 'eng' || sub.lang === 'en' || sub.lang === 'english'
            );
            
            if (englishSubtitles.length > 0) {
                // לוקחים את הכתובית האנגלית הראשונה
                const engSub = englishSubtitles[0];
                console.log(`נמצאה כתובית באנגלית: ${engSub.id}`);
                
                // מוסיפים זרם של כתובית באנגלית
                streams.push({
                    id: `en-subtitle-${engSub.id}`,
                    title: 'כתוביות באנגלית',
                    subtitle: {
                        url: engSub.url,
                        lang: 'en'
                    }
                });
                
                // מוסיפים אפשרות לכתוביות מתורגמות אוטומטית לעברית
                console.log(`מוסיף אפשרות לכתוביות מתורגמות אוטומטית לעברית`);
                streams.push({
                    id: `auto-translated-he-${engSub.id}`,
                    title: 'כתוביות מתורגמות אוטומטית לעברית',
                    subtitle: {
                        // שימוש בכתובת הבסיס הדינמית
                        url: `${BASE_URL}/translate-subtitle?url=${encodeURIComponent(engSub.url)}`,
                        lang: 'he'
                    }
                });
            } else {
                console.log(`לא נמצאו כתוביות באנגלית לתרגום`);
            }
        }
        
        console.log(`מחזיר ${streams.length} אפשרויות כתוביות`);
        return { streams };
    } catch (error) {
        console.error('שגיאה בטיפול בכתוביות:', error);
        return { streams: [] };
    }
});

// לוגים נוספים לסיום הטעינה
console.log('addon.js נטען בהצלחה');

// יצוא התוסף
module.exports = addon.getInterface();
