import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the root directory statically
// This allows access to /index.html, /sw.js, /rafi/*, /alex/*
app.use(express.static(path.join(__dirname, '.')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 Heyx Hub is running!`);
    console.log(`➜  Local:   http://localhost:${PORT}/`);
    console.log(`➜  Rafi:    http://localhost:${PORT}/rafi/`);
    console.log(`➜  Alex:    http://localhost:${PORT}/alex/`);
});