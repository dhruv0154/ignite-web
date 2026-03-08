const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

app.post('/api/run', (req, res) => {
    const userCode = req.body.code;
    const customInput = req.body.input || "";

    const tempFile = path.join(__dirname, 'temp.flint');
    const inputFile = path.join(__dirname, 'input.txt');
    
    fs.writeFileSync(tempFile, userCode);
    fs.writeFileSync(inputFile, customInput);

    const flintExecutable = 'flint.exe';

    // start the timer
    const startTime = performance.now();

    exec(`${flintExecutable} ${tempFile} < ${inputFile}`, (error, stdout, stderr) => {
        // stop the timer
        const endTime = performance.now();
        const executionTime = (endTime - startTime).toFixed(2); // in milliseconds

        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);

        if (error || stderr) {
            return res.json({ status: 'error', output: stderr || error.message, time: executionTime });
        }
        res.json({ status: 'success', output: stdout, time: executionTime });
    });
});

app.listen(3000, () => {
    console.log('FlintScope is live on http://localhost:3000');
});