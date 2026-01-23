console.log('1. Starting debug...');
try {
  console.log('2. Requiring path...');
  const path = require('path');
  console.log('3. Requiring fs...');
  const fs = require('fs');
  console.log('4. Requiring express...');
  const express = require('express');
  console.log('5. Requiring body-parser...');
  const bodyParser = require('body-parser');
  console.log('6. Requiring cors...');
  const cors = require('cors');
  console.log('7. Requiring uuid...');
  const { v4: uuidv4 } = require('uuid');
  console.log('8. Requiring israeli-bank-scrapers...');
  const scrapers = require('israeli-bank-scrapers');
  console.log('9. All requires successful.');
} catch (e) {
  console.error('Error during require:', e);
}
