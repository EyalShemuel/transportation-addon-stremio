// תוסף תרגום לעברית עבור Stremio
const { addonBuilder } = require('stremio-addon-sdk');
const fetch = require('node-fetch');
const translate = require('@vitalets/google-translate-api');

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
    try {
        const result = await translate(text, { to: 'he' });
        return result.text;
    } catch (error) {
        console.error('שגיאת תרגום:', error);
        return text; // מחזיר את הטקסט המקורי במקרה של שגיאה
    }
}

// עיבוד מטא-נתונים עם תרגום
async function translateMetadata(meta) {
    if (!meta) return meta;
    
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
        translatedMeta.genres = await Promise.all(
            meta.genres.map(genre => translateToHebrew(genre))
        );
    }
    
    // תרגום פרטי שחקנים
    if (meta.cast && Array.isArray(meta.cast)) {
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
        translatedMeta.director = await Promise.all(
            meta.director.map(director => translateToHebrew(director))
        );
    }
    
    // תרגום תקצירי פרקים (לסדרות)
    if (meta.videos && Array.isArray(meta.videos)) {
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
    
    return translatedMeta;
}

// קבלת מטא-נתונים מקוריים ותרגום שלהם
addon.defineMetaHandler(async ({ type, id }) => {
    try {
        // קבלת המטא-נתונים מהשרתים המקוריים של סטרמיו או תוספים אחרים
        const originalMetaResponse = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${id}.json`);
        
        if (!originalMetaResponse.ok) {
            throw new Error(`Failed to fetch original meta: ${originalMetaResponse.status}`);
        }
        
        const originalMeta = await originalMetaResponse.json();
        
        // תרגום המטא-נתונים לעברית
        const translatedMeta = await translateMetadata(originalMeta.meta);
        
        return { meta: translatedMeta };
    } catch (error) {
        console.error('Meta handler error:', error);
        return { meta: null };
    }
});

// הגדרת קטלוג עם תוכן מתורגם
addon.defineCatalogHandler(async ({ type, id, extra }) => {
    try {
        // אחזור קטלוג מקורי
        let catalogUrl = `https://v3-cinemeta.strem.io/catalog/${type}/top.json`;
        
        if (extra && extra.genre) {
            catalogUrl = `https://v3-cinemeta.strem.io/catalog/${type}/top/${extra.genre}.json`;
        }
        
        if (extra && extra.skip) {
            catalogUrl += `?skip=${extra.skip}`;
        }
        
        const originalCatalogResponse = await fetch(catalogUrl);
        
        if (!originalCatalogResponse.ok) {
            throw new Error(`Failed to fetch original catalog: ${originalCatalogResponse.status}`);
        }
        
        const originalCatalog = await originalCatalogResponse.json();
        
        // תרגום פריטי הקטלוג
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
        
        return {
            metas: translatedMetas
        };
    } catch (error) {
        console.error('Catalog handler error:', error);
        return { metas: [] };
    }
});

// תמיכה בכתוביות בעברית עם אפשרות לתרגום אוטומטי מאנגלית
addon.defineStreamHandler(async ({ type, id }) => {
    try {
        // בהנחה שיש תוסף אחר שמספק כתוביות
        const subtitleResponse = await fetch(`https://v3-community-subs.strem.io/subtitles/${type}/${id}.json`);
        
        if (!subtitleResponse.ok) {
            // אם אין כתוביות, פשוט נמשיך בלעדיהן
            return { streams: [] };
        }
        
        const subtitleData = await subtitleResponse.json();
        
        // מסנן רק כתוביות בעברית
        const hebrewSubtitles = subtitleData.subtitles.filter(sub => 
            sub.lang === 'heb' || sub.lang === 'he' || sub.lang === 'hebrew'
        );
        
        let streams = [];
        
        // אם יש כתוביות בעברית, נשתמש בהן
        if (hebrewSubtitles.length > 0) {
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
            const englishSubtitles = subtitleData.subtitles.filter(sub =>
                sub.lang === 'eng' || sub.lang === 'en' || sub.lang === 'english'
            );
            
            if (englishSubtitles.length > 0) {
                // לוקחים את הכתובית האנגלית הראשונה
                const engSub = englishSubtitles[0];
                
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
                streams.push({
    id: `auto-translated-he-${engSub.id}`,
    title: 'כתוביות מתורגמות אוטומטית לעברית',
    subtitle: {
        // במקום להשתמש בכתובת localhost, נשתמש בשרת הנוכחי
        url: `${process.env.BASE_URL || 'https://transportation-addon-stremio.onrender.com'}/translate-subtitle?url=${encodeURIComponent(engSub.url)}`,
        lang: 'he'
    }
});
            }
        }
        
        return { streams };
    } catch (error) {
        console.error('Stream handler error:', error);
        return { streams: [] };
    }
});

// יצוא התוסף
module.exports = addon.getInterface();
