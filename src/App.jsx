import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import './App.css';
import ASTGraph from './ASTGraph';

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
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const urlUser = urlParams.get('user');

    if (urlToken) {
        // Save the token to port 5173's local storage
        localStorage.setItem('flint_token', urlToken);
        localStorage.setItem('flint_user', urlUser || "User");
        
        // Clean up the URL so the token isn't sitting in the address bar
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const currentToken = localStorage.getItem('flint_token');
    if (!currentToken) {
        window.location.href = "http://localhost:3000/login";
    }
  }, []);

  const [activeSnippet, setActiveSnippet] = useState("hello_world");
  const [code, setCode] = useState(snippets["hello_world"].code);
  const [customInput, setCustomInput] = useState("Dhruv\n");
  const [output, setOutput] = useState('Click "Run" to see output...');
  const [isError, setIsError] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [execTime, setExecTime] = useState("0.00");
  
  const [outputMode, setOutputMode] = useState("console"); 
  const [tokensData, setTokensData] = useState([]); 
  const [astData, setAstData] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [selectedNode, setSelectedNode] = useState(null);
  const editorRef = useRef(null);
  const decorationsRef = useRef([]);

  const [token, setToken] = useState(localStorage.getItem('flint_token') || null);
  const [username, setUsername] = useState(localStorage.getItem('flint_user') || "User");

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor; 
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

  const handleASTNodeClick = (data) => {
      if (!data) {
          setSelectedNode(null);
          if (editorRef.current) {
              decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
          }
          return;
      }

      setSelectedNode(data);
      
      if (editorRef.current && data.searchQuery) {
          const model = editorRef.current.getModel();
          const matches = model.findMatches(data.searchQuery, false, false, false, null, true);
          
          if (matches.length > 0) {
              let targetMatch = matches[0]; 
              
              if (data.rawNode.line && data.rawNode.line > 0) {
                  const exactMatch = matches.find(m => m.range.startLineNumber === data.rawNode.line);
                  if (exactMatch) targetMatch = exactMatch;
              }

              editorRef.current.revealLineInCenter(targetMatch.range.startLineNumber);
              decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, [
                  { range: targetMatch.range, options: { inlineClassName: 'ast-highlight' } }
              ]);
          }
      }
  };

  const loadSnippet = (e) => {
    const key = e.target.value;
    setActiveSnippet(key);
    setCode(snippets[key].code);
    setOutput('Click "Run" to see output...');
    setExecTime("0.00");
    if (key === "lexer_demo") setOutputMode("tokens");
  };

  const handleRunCode = async (silent = false) => {
    if (!silent) setIsRunning(true);
    
    if (!silent) {
        if (outputMode === 'tokens') setOutput("> Running Lexical Scanner...\n");
        else if (outputMode === 'ast') setOutput("> Generating Syntax Tree...\n");
        else setOutput("> Compiling and Executing...\n");
    }
    
    setIsError(false);
    if (!silent) setExecTime("...");

    try {
      const currentToken = localStorage.getItem('flint_token');
      const response = await axios.post('http://localhost:3000/api/run', { 
        code, input: customInput, astMode: outputMode === 'ast', tokenMode: outputMode === 'tokens'
      }, {
        headers: { Authorization: `Bearer ${currentToken}` } 
      });
      
      setIsError(response.data.status === 'error');
      
      if (response.data.status === 'success') {
          if (outputMode === 'tokens') {
              try { setTokensData(JSON.parse(response.data.output)); if (!silent) setOutput(""); } 
              catch { setOutput(response.data.output); setTokensData([]); }
          } else if (outputMode === 'ast') {
              try {
                  let cleanOutput = response.data.output.trim().replace(/\n/g, "\\n").replace(/\r/g, "\\r");
                  setAstData(JSON.parse(cleanOutput)); 
                  if (!silent) setOutput("");
              } catch (err) {
                  setOutput(response.data.output); setAstData(null);
              }
          } else {
              setOutput(response.data.output);
          }
      } else {
          setOutput(response.data.output); 
      }
      setExecTime(response.data.time || "0.00");
    } catch (error) {
      setIsError(true);
      setOutput("Fatal Error: Could not connect to the Ignite execution server.");
    } finally {
      if (!silent) setIsRunning(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('flint_token');
    localStorage.removeItem('flint_user');
    window.location.href = "http://localhost:3000/login";
  };

  useEffect(() => {
      if (outputMode === 'ast' || outputMode === 'tokens') {
          const timeoutId = setTimeout(() => handleRunCode(true), 600);
          return () => clearTimeout(timeoutId);
      }
  }, [code, outputMode]);

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo"><span className="logo-icon">🔥</span><h1>Ignite</h1></div>
        <div className="header-links">
          <a href="#" className="active-link">Compiler Environment</a>
          <a href="http://localhost:3000/docs">Flint Docs</a>
        </div>
        <div className="user-profile" style={{cursor: 'pointer', marginLeft: 'auto'}} onClick={handleLogout} title="Click to Logout">
            <div className="avatar">{username.charAt(0).toUpperCase()}</div>
            <span>{username}</span>
        </div>
      </header>

      <div className="workspace">
        <div className="editor-container">
          <div className="action-bar">
            <div className="file-tabs"><span className="file-tab active">main.flint</span></div>
            <div className="action-buttons">
              <select className="snippet-dropdown" value={activeSnippet} onChange={loadSnippet}>
                {Object.entries(snippets).map(([key, data]) => (
                  <option key={key} value={key}>{data.name}</option>
                ))}
              </select>
              <button className="run-button" onClick={() => handleRunCode(false)} disabled={isRunning}>
                {isRunning ? "Running..." : "Run"}
              </button>
            </div>
          </div>
          <div className="editor-wrapper">
            <Editor
              height="100%" language="flint" theme="vs-dark" value={code}
              onChange={(value) => setCode(value)} onMount={handleEditorDidMount}
              options={{ minimap: { enabled: false }, fontSize: 16, fontFamily: "'Fira Code', 'Courier New', monospace", padding: { top: 15 } }}
            />
          </div>
        </div>

        <div className="io-container">
          {outputMode === 'console' && (
              <div className="input-panel">
                <div className="pane-header"><span>Standard Input</span></div>
                <textarea className="io-textarea" value={customInput} onChange={(e) => setCustomInput(e.target.value)}/>
              </div>
          )}

          <div className={`output-panel ${isFullscreen ? 'fullscreen' : ''}`} style={{ flex: outputMode === 'console' ? 7 : 1 }}>
            <div className="pane-header output-tabs-header">
                <div className="output-tabs">
                    <button className={`out-tab ${outputMode === 'console' ? 'active' : ''}`} onClick={() => setOutputMode('console')}>Console</button>
                    <button className={`out-tab ${outputMode === 'tokens' ? 'active' : ''}`} onClick={() => setOutputMode('tokens')}>Lexer Tokens</button>
                    <button className={`out-tab ${outputMode === 'ast' ? 'active' : ''}`} onClick={() => setOutputMode('ast')}>AST Engine</button>
                </div>
                <div className="output-actions">
                    <button className="icon-btn" onClick={() => setIsFullscreen(!isFullscreen)}>
                        {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    </button>
                </div>
            </div>

            <div className={`terminal-output ${isError ? 'error-text' : 'success-text'} ${outputMode === 'ast' ? 'ast-text' : ''}`} style={{position: 'relative'}}>
              {outputMode === 'tokens' && tokensData.length > 0 ? (
                  <div className="token-grid">
                      {tokensData.map((tok, idx) => (
                          <div key={idx} className="token-badge">
                              <span className="token-lexeme">{tok.lexeme === "" ? "EOF" : tok.lexeme}</span>
                              <span className="token-line">Ln {tok.line}</span>
                          </div>
                      ))}
                  </div>
              ) : outputMode === 'ast' && astData ? (
                  <>
                      <div style={{ height: '100%', width: '100%', minHeight: '400px' }}>
                          <ASTGraph astData={astData} onNodeClick={handleASTNodeClick} />
                      </div>
                      
                      {selectedNode && (
                          <div className="ast-inspector">
                              <h4>Node Inspector</h4>
                              <div className="inspector-row"><span>Type:</span> {selectedNode.title}</div>
                              <div className="inspector-row"><span>Details:</span> <span className="highlight-val">{selectedNode.details}</span></div>
                              <div className="inspector-desc">
                                  {selectedNode.title === "Literal Value" && "A hardcoded value injected directly into the memory."}
                                  {selectedNode.title === "Variable" && "An identifier representing a stored value in the current Environment."}
                                  {selectedNode.title === "Declaration" && "Allocates a new space in memory for a variable in this specific block scope."}
                                  {selectedNode.title === "Function Call" && "Pauses current execution, pushes a new frame to the Call Stack, and invokes the Callee."}
                              </div>
                          </div>
                      )}
                  </>
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