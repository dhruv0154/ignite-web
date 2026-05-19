// server.js
require('dotenv').config(); // Loads secrets from your .env file
const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User'); // Imports the blueprint we just made

const app = express();
app.use(cors()); 
app.use(express.json());

// --- 1. CONNECT TO MONGODB ---
// This reaches out to MongoDB Atlas over the internet using the URL in your .env file
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas Cloud Database!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- 2. SSR CONFIGURATION ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

app.get('/', (req, res) => res.render('index'));
app.get('/docs', (req, res) => res.render('docs'));
app.get('/login', (req, res) => res.render('login'));

// --- 3. AUTHENTICATION (NOW USING REAL DATABASE) ---

// [REGISTER ROUTE]
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // 1. Ask MongoDB if this username already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ status: 'error', message: 'Username already taken.' });
        }
        
        // 2. Hash the password (turns "password123" into scrambled text)
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 3. Save the new user into the MongoDB Cloud
        await User.create({
            username: username,
            password: hashedPassword
        });
        
        // 4. Give them a VIP Token so they don't have to log in immediately
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '2h' });
        res.json({ status: 'success', token });

    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Server error during registration.' });
    }
});

// [LOGIN ROUTE]
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // 1. Ask MongoDB to find the user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'User not found.' });
        }
        
        // 2. Compare the typed password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (isMatch) {
            // Passwords match! Give them a token.
            const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '2h' });
            res.json({ status: 'success', token });
        } else {
            // Passwords don't match
            res.status(401).json({ status: 'error', message: 'Incorrect password.' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Server error during login.' });
    }
});

// [SECURITY MIDDLEWARE]
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) return res.status(403).json({ status: 'error', output: 'Invalid/Expired Token.' });
            req.user = user;
            next(); // Token is real! Let them run the C++ code.
        });
    } else {
        res.status(401).json({ status: 'error', output: 'Access Denied: No Token Provided.' });
    }
};

// --- 4. C++ EXECUTION ROUTE ---
app.post('/api/run', authenticateJWT, (req, res) => {
    const userCode = req.body.code;
    const customInput = req.body.input || "";
    const astMode = req.body.astMode;
    const tokenMode = req.body.tokenMode;
    const assemblyMode = req.body.assemblyMode; // NEW: Grab the assembly flag

    const tempFile = path.join(__dirname, 'temp.flint');
    const inputFile = path.join(__dirname, 'input.txt');
    
    fs.writeFileSync(tempFile, userCode);
    fs.writeFileSync(inputFile, customInput);

    const flintExecutable = process.platform === 'win32' ? 'flint.exe' : './flint';

    // Figure out which mode to run the C++ engine in
    let command = `${flintExecutable} ${tempFile} < ${inputFile}`;
    if (astMode) command = `${flintExecutable} --ast ${tempFile}`;
    if (tokenMode) command = `${flintExecutable} --tokens ${tempFile}`;
    if (assemblyMode) command = `${flintExecutable} --assembly ${tempFile}`;

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