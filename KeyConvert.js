const fs = require('fs');

// getting the key
const key = fs.readFileSync("./To-Dos-adminSDK.json", 'utf-8');
// converting into base64
const encodedKey = Buffer.from(key).toString('base64');
console.log("Key: ", encodedKey)