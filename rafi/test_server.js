console.log('Starting...');
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Hello'));
const PORT = 30000;
console.log(`Attempting to listen on ${PORT}...`);
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Test server running on ${PORT}`);
    process.exit(0); // Exit successfully to prove it worked
});
setTimeout(() => {
    console.log('Timeout reached, exiting...');
    process.exit(1);
}, 5000);
