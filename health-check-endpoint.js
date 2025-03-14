// הוספת ה-health check נדרשת ל-Render.com
// יש להוסיף את הקוד הזה ל-server.js

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
