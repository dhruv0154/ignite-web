const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors()); 
app.use(express.json());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));

app.get('/', (req, res) => res.render('index'));
app.get('/docs', (req, res) => res.render('docs'));
app.get('/login', (req, res) => res.render('login'));

const SECRET_KEY = "flint_key";

const usersDB = [
    { username: "dhruv", password: "password123" }
];

// Register Route
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (usersDB.find(u => u.username === username)) {
        return res.status(400).json({ status: 'error', message: 'Username already exists' });
    }
    usersDB.push({ username, password });
    
    // Auto-login after register
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '2h' });
    res.json({ status: 'success', token });
});

// Login Route
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = usersDB.find(u => u.username === username && u.password === password);
    
    if (user) {
        const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '2h' });
        res.json({ status: 'success', token });
    } else {
        res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }
});

// JWT Middleware
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, SECRET_KEY, (err, user) => {
            if (err) return res.status(403).json({ status: 'error', output: 'Invalid/Expired Token. Please login again.' });
            req.user = user;
            next();
        });
    } else {
        res.status(401).json({ status: 'error', output: 'Access Denied: No Token Provided' });
    }
};

// --- 4. PROTECTED COMPILER ROUTE ---
app.post('/api/run', authenticateJWT, (req, res) => {
    const userCode = req.body.code;
    const customInput = req.body.input || "";
    const astMode = req.body.astMode;
    const tokenMode = req.body.tokenMode;

    const tempFile = path.join(__dirname, 'temp.flint');
    const inputFile = path.join(__dirname, 'input.txt');
    
    fs.writeFileSync(tempFile, userCode);
    fs.writeFileSync(inputFile, customInput);

    const flintExecutable = process.platform === 'win32' ? 'flint.exe' : './flint';

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