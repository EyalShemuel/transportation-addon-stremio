// test-addon.js - קובץ לבדיקה ישירה של התוסף
// יש להוסיף קובץ זה לפרויקט ולהריץ עם node test-addon.js

const addonInterface = require('./addon');

// פונקציה לבדיקת יכולת התרגום
async function testAddon() {
    console.log('בודק את פונקציונליות התוסף...');
    
    // בדיקת קבלת מטא-נתונים של סרט פופולרי
    console.log('\n=== בדיקת מטא-נתונים לסרט ===');
    try {
        const movieMeta = await addonInterface.meta({ type: 'movie', id: 'tt1375666' }); // Inception
        console.log('תקציר מתורגם:', movieMeta.meta.description);
        console.log('כותרת מתורגמת:', movieMeta.meta.name);
        if (movieMeta.meta.genres) {
            console.log('ז\'אנרים מתורגמים:', movieMeta.meta.genres.join(', '));
        }
    } catch (error) {
        console.error('שגיאה בבדיקת מטא-נתונים לסרט:', error);
    }
    
    // בדיקת קבלת מטא-נתונים של סדרה פופולרית
    console.log('\n=== בדיקת מטא-נתונים לסדרה ===');
    try {
        const seriesMeta = await addonInterface.meta({ type: 'series', id: 'tt0944947' }); // Game of Thrones
        console.log('תקציר מתורגם:', seriesMeta.meta.description);
        console.log('כותרת מתורגמת:', seriesMeta.meta.name);
        if (seriesMeta.meta.genres) {
            console.log('ז\'אנרים מתורגמים:', seriesMeta.meta.genres.join(', '));
        }
    } catch (error) {
        console.error('שגיאה בבדיקת מטא-נתונים לסדרה:', error);
    }
    
    // בדיקת קבלת קטלוג
    console.log('\n=== בדיקת קטלוג סרטים ===');
    try {
        const catalog = await addonInterface.catalog({ type: 'movie', id: 'hebrew-movies' });
        console.log(`התקבלו ${catalog.metas.length} סרטים בקטלוג.`);
        if (catalog.metas.length > 0) {
            console.log('דוגמה לסרט ראשון:', catalog.metas[0].name);
        }
    } catch (error) {
        console.error('שגיאה בבדיקת קטלוג:', error);
    }
}

// הרצת הבדיקות
testAddon().then(() => {
    console.log('\nבדיקות הסתיימו.');
}).catch(error => {
    console.error('שגיאה בהרצת הבדיקות:', error);
});
