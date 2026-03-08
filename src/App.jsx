import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import './App.css';

const snippets = {
  "hello_world": {
    name: "1. Hello World & Basic IO",
    code: `// Welcome to Ignite!
let name = scan("Enter your name: ");
print("Hello, ");
print(name);
print("! Welcome to the Flint Language Environment.\\n");`
  },
  "arrays_strings": {
    name: "2. Arrays & String Manipulation",
    code: `// Testing Arrays and Strings
let arr = [10, 20, 30];
arr.push(40);
print("Array length: "); print(arr.length()); print("\\n");

let popped = arr.pop();
print("Popped value: "); print(popped); print("\\n");

let text = "ignite engine";
text.upper();
print("Uppercase String: "); print(text); print("\\n");`
  },
  "loops_math": {
    name: "3. Loops, Math & Ternary",
    code: `// Calculate factorial using a while loop
let n = 6;
let result = 1;
let i = n;

while (i > 0) {
    result = result * i;
    i = i - 1;
}

print(n); print("! = "); print(result); print("\\n");

// Ternary Operator Test
let isEven = (result % 2 == 0) ? "Even" : "Odd";
print("The result is: "); print(isEven); print("\\n");`
  },
  "functions_lambdas": {
    name: "4. Functions & Lambdas",
    code: `// Higher order functions & closures
let makeAdder = func(x) {
    return func(y) { return x + y; };
};

let add10 = makeAdder(10);
print("10 + 25 = "); 
print(add10(25)); 
print("\\n");`
  },
  "oop_inheritance": {
    name: "5. OOP & Inheritance",
    code: `class Engine {
    class info() { print("Base Engine System\\n"); }
    start() { print("Engine starting...\\n"); }
}

class PhysicsEngine < Engine {
    start() { 
        super.start();
        print("Physics subsystem initialized.\\n"); 
    }
}

Engine.info();
let pyre = PhysicsEngine();
pyre.start();`
  }
};

function App() {
  const [activeSnippet, setActiveSnippet] = useState("hello_world");
  const [code, setCode] = useState(snippets["hello_world"].code);
  const [customInput, setCustomInput] = useState("Dhruv\n");
  const [output, setOutput] = useState('Click "Run" to see output...');
  const [isError, setIsError] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [execTime, setExecTime] = useState("0.00");
  const [outputMode, setOutputMode] = useState("console"); // 'console', 'ast', or 'tokens'
  const [tokensData, setTokensData] = useState([]); // array to hold the parsed tokens

  const handleEditorWillMount = (monaco) => {
    monaco.languages.register({ id: 'flint' });
    monaco.languages.setMonarchTokensProvider('flint', {
      keywords: ['let', 'func', 'if', 'else', 'return', 'while', 'for', 'break', 'continue', 'class', 'super', 'this'],
      typeKeywords: ['true', 'false', 'nothing'],
      tokenizer: {
        root: [
          [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@typeKeywords': 'type', '@default': 'identifier' } }],
          [/[0-9]+(\.[0-9]+)?/, 'number'],
          [/".*?"/, 'string'],
          [/\/\/.*/, 'comment'], 
        ]
      }
    });
  };

  const loadSnippet = (e) => {
    const key = e.target.value;
    setActiveSnippet(key);
    setCode(snippets[key].code);
    setOutput('Click "Run" to see output...');
    setExecTime("0.00");
    if (key === "lexer_demo") setOutputMode("tokens");
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    
    if (outputMode === 'tokens') setOutput("> Running Lexical Scanner...\n");
    else if (outputMode === 'ast') setOutput("> Generating Syntax Tree...\n");
    else setOutput("> Compiling and Executing...\n");
    
    setIsError(false);
    setExecTime("...");

    try {
      const response = await axios.post('/api/run', { 
        code, 
        input: customInput,
        astMode: outputMode === 'ast',
        tokenMode: outputMode === 'tokens'
      });
      
      setIsError(response.data.status === 'error');
      
      if (response.data.status === 'success') {
          if (outputMode === 'tokens') {
              try {
                  setTokensData(JSON.parse(response.data.output));
                  setOutput(""); // clear raw text if parse succeeds
              } catch {
                  setOutput(response.data.output); // fallback to raw text if JSON is broken
                  setTokensData([]);
              }
          } else if (outputMode === 'ast') {
              try {
                  const parsed = JSON.parse(response.data.output);
                  setOutput(JSON.stringify(parsed, null, 2));
              } catch {
                  setOutput(response.data.output); 
              }
          } else {
              setOutput(response.data.output);
          }
      } else {
          setOutput(response.data.output); // It's an error message
      }
      
      setExecTime(response.data.time || "0.00");
    } catch (error) {
      setIsError(true);
      setOutput("Fatal Error: Could not connect to the Ignite execution server.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">🔥</span>
          <h1>Ignite</h1>
        </div>
        <div className="header-links">
          <a href="#" className="active-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
            Compiler Environment
          </a>
          <a href="#">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            Packages
          </a>
          <a href="#">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
            Flint Docs
          </a>
          <a href="#" className="github-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
            GitHub
          </a>
        </div>
        <div className="user-profile">
            <div className="avatar">D</div>
            <span>Dhruv Ranger</span>
        </div>
      </header>

      <div className="workspace">
        <div className="editor-container">
          <div className="action-bar">
            <div className="file-tabs">
              <span className="file-tab active">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                main.flint
              </span>
            </div>
            
            <div className="action-buttons">
              <select className="snippet-dropdown" value={activeSnippet} onChange={loadSnippet}>
                {Object.entries(snippets).map(([key, data]) => (
                  <option key={key} value={key}>{data.name}</option>
                ))}
              </select>
              
              <button className="run-button" onClick={handleRunCode} disabled={isRunning}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                {isRunning ? "Running..." : "Run"}
              </button>
            </div>
          </div>

          <div className="editor-wrapper">
            <Editor
              height="100%"
              language="flint"
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value)}
              beforeMount={handleEditorWillMount}
              options={{ minimap: { enabled: false }, fontSize: 16, fontFamily: "'Fira Code', 'Courier New', monospace", padding: { top: 15 } }}
            />
          </div>
        </div>

        <div className="io-container">
          <div className="input-panel">
            <div className="pane-header">
              <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/></svg> Standard Input</span>
            </div>
            <textarea 
              className="io-textarea"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Enter custom stdin inputs here..."
            />
          </div>

          <div className="output-panel">
            <div className="pane-header output-tabs-header">
                <div className="output-tabs">
                    <button className={`out-tab ${outputMode === 'console' ? 'active' : ''}`} onClick={() => setOutputMode('console')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3fb950" strokeWidth="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg> Console
                    </button>
                    {/* NEW TAB: LEXER TOKENS */}
                    <button className={`out-tab ${outputMode === 'tokens' ? 'active' : ''}`} onClick={() => setOutputMode('tokens')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff8c00" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg> Lexer Tokens
                    </button>
                    <button className={`out-tab ${outputMode === 'ast' ? 'active' : ''}`} onClick={() => setOutputMode('ast')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d2a8ff" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg> AST Engine
                    </button>
                </div>
            </div>
            <div className={`terminal-output ${isError ? 'error-text' : 'success-text'} ${outputMode === 'ast' ? 'ast-text' : ''}`}>
              
              {/* RENDER THE TOKEN GRID IF IN LEXER MODE */}
              {outputMode === 'tokens' && tokensData.length > 0 ? (
                  <div className="token-grid">
                      {tokensData.map((tok, idx) => (
                          <div key={idx} className="token-badge">
                              <span className="token-lexeme">
                                  {tok.lexeme === "" ? "EOF" : tok.lexeme}
                              </span>
                              <span className="token-line">Ln {tok.line}</span>
                          </div>
                      ))}
                  </div>
              ) : (
                  <pre>{output}</pre>
              )}

            </div>
            <div className="status-footer">
              <span>Execution time: <strong className="status-highlight">{execTime} ms</strong></span>
              <span>Memory Used: <strong className="status-highlight">~4 MB</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;