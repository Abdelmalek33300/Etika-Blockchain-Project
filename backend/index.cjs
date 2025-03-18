const express = require('express');
const app = express();
const PORT = process.env.PORT || 4000;

// ✅ Middleware de logging placé AVANT les routes
app.use((req, res, next) => {
    console.log(`Requête reçue : ${req.method} ${req.url}`);
    console.log(`Headers:`, req.headers);
    console.log(`Body:`, req.body);
    next();
});

app.get('/', (req, res) => res.send('Etika API is running...')); // ✅ Maintenant, cette route sera bien loggée

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
