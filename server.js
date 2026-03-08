const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors'); 

const app = express();
app.use(cors()); 
app.use(express.json());

app.use(express.static('public'));

app.post('/api/run', (req, res) => {
    const userCode = req.body.code;
    const customInput = req.body.input || "";
    const astMode = req.body.astMode;
    const tokenMode = req.body.tokenMode;

    const tempFile = path.join(__dirname, 'temp.flint');
    const inputFile = path.join(__dirname, 'input.txt');
    
    fs.writeFileSync(tempFile, userCode);
    fs.writeFileSync(inputFile, customInput);

    const flintExecutable = process.platform === 'win32' ? 'flint.exe' : './flint';

    // figure out which flag to pass to the C++ engine
    let command = `${flintExecutable} ${tempFile} < ${inputFile}`;
    if (astMode) command = `${flintExecutable} --ast ${tempFile}`;
    if (tokenMode) command = `${flintExecutable} --tokens ${tempFile}`;

    const startTime = performance.now();

    exec(command, (error, stdout, stderr) => {
        const endTime = performance.now();
        const executionTime = (endTime - startTime).toFixed(2);

        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);

        if (error || stderr) {
            return res.json({ status: 'error', output: stderr || error.message, time: executionTime });
        }
        res.json({ status: 'success', output: stdout, time: executionTime });
    });
});

app.listen(3000, () => {
    console.log('Ignite Execution Engine running on port 3000');
});