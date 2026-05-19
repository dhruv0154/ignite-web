import React, { useMemo, useEffect } from 'react';
import ReactFlow, { Background, Controls, MarkerType, useNodesState, useEdgesState } from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction, ranksep: 80, nodesep: 40 });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: 180, height: 75 });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = 'top';
        node.sourcePosition = 'bottom';
        node.position = {
            x: nodeWithPosition.x - 90,
            y: nodeWithPosition.y - 35,
        };
        return node;
    });

    return { nodes, edges };
};

const generateNodesAndEdges = (astNodes) => {
    const initialNodes = [];
    const initialEdges = [];
    let idCounter = 0;

    const addEdge = (source, target, label = "") => {
        initialEdges.push({
            id: `e_${source}-${target}`,
            source,
            target,
            label,
            labelStyle: { fill: '#8b949e', fontWeight: 700, fontSize: 11 },
            labelBgStyle: { fill: '#0d1117' },
            animated: true,
            style: { stroke: '#ff8c00', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#ff8c00' }
        });
    };

    const traverse = (node, parentId = null, edgeLabel = "") => {
        if (!node) return null;
        const currentId = `n_${idCounter++}`;

        let nodeTitle = node.type || "Unknown Node";
        let nodeDetails = "";
        let searchQuery = ""; 

        if (node.type === "Variable") { nodeTitle = "Variable"; nodeDetails = node.name; searchQuery = node.name; }
        if (node.type === "Literal") { nodeTitle = "Literal Value"; nodeDetails = node.value === null ? "nothing" : node.value; searchQuery = String(node.value); }
        if (node.type === "Call") { nodeTitle = "Function Call"; nodeDetails = "Invoke"; }
        if (node.type === "Binary") { nodeTitle = "Binary Operation"; nodeDetails = `Operator: ${node.op}`; searchQuery = node.op; }
        if (node.type === "Logical") { nodeTitle = "Logical Check"; nodeDetails = `Operator: ${node.op}`; searchQuery = node.op; }
        if (node.type === "ExpressionStmt") { nodeTitle = "Expression Stmt"; nodeDetails = "Eval & Discard"; }
        if (node.type === "Lambda") { nodeTitle = "Lambda"; nodeDetails = "Anonymous Func"; searchQuery = "func"; }
        if (node.type === "FunctionStmt") { nodeTitle = "Function Def"; nodeDetails = node.name || "lambda"; searchQuery = node.name; }
        if (node.type === "ReturnStmt") { nodeTitle = "Return Stmt"; nodeDetails = "Exit Context"; searchQuery = "return"; }
        if (node.type === "IfStmt") { nodeTitle = "Conditional"; nodeDetails = "If / Else"; searchQuery = "if"; }
        if (node.type === "WhileStmt") { nodeTitle = "Loop"; nodeDetails = "While"; searchQuery = "while"; }
        if (node.type === "Get") { nodeTitle = "Property Access"; nodeDetails = `.${node.name}`; searchQuery = node.name; }
        if (node.type === "Set") { nodeTitle = "Property Assign"; nodeDetails = `.${node.name} =`; searchQuery = node.name; }
        if (node.type === "ClassStmt") { nodeTitle = "Class Def"; nodeDetails = node.name; searchQuery = node.name; }
        if (node.type === "Array") { nodeTitle = "Array Init"; nodeDetails = `[ ${node.elements?.length || 0} items ]`; searchQuery = "["; }

        initialNodes.push({
            id: currentId,
            data: { 
                rawNode: node,
                searchQuery,
                title: nodeTitle,
                details: nodeDetails,
                label: (
                    <div style={{ padding: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '1px' }}>{nodeTitle}</div>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#58a6ff', marginTop: '4px' }}>{nodeDetails || '<...>' }</div>
                    </div>
                )
            },
            style: {
                backgroundColor: '#161b22', border: '1px solid #30363d',
                borderRadius: '8px', minWidth: '160px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                cursor: 'pointer' 
            }
        });

        if (parentId) addEdge(parentId, currentId, edgeLabel);

        switch (node.type) {
            case "ExpressionStmt":
                if (node.expression) traverse(node.expression, currentId, "expr");
                break;
            case "LetStmt":
                if (node.declarations) {
                    node.declarations.forEach(decl => {
                        const declId = `n_${idCounter++}`;
                        initialNodes.push({
                            id: declId,
                            data: { rawNode: decl, searchQuery: decl.name, title: "Declaration", details: decl.name, label: <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffba00' }}>Declare: {decl.name}</div> },
                            style: { backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', cursor: 'pointer' }
                        });
                        addEdge(currentId, declId, "decl");
                        if (decl.initializer) traverse(decl.initializer, declId, "init");
                    });
                }
                break;
            case "Call":
                if (node.callee) traverse(node.callee, currentId, "callee");
                if (node.arguments) node.arguments.forEach((arg, i) => traverse(arg, currentId, `arg ${i}`));
                break;
            case "Binary":
            case "Logical":
                if (node.left) traverse(node.left, currentId, "left");
                if (node.right) traverse(node.right, currentId, "right");
                break;
            case "BlockStmt":
                if (node.statements) node.statements.forEach((stmt, i) => traverse(stmt, currentId, `stmt ${i}`));
                break;
            case "Lambda":
                if (node.function) traverse(node.function, currentId, "body");
                break;
            case "FunctionStmt":
                if (node.body) node.body.forEach((s, i) => traverse(s, currentId, `stmt ${i}`));
                break;
            case "ReturnStmt":
                if (node.value) traverse(node.value, currentId, "returns");
                break;
            case "IfStmt":
                if (node.condition) traverse(node.condition, currentId, "condition");
                if (node.thenBranch) traverse(node.thenBranch, currentId, "then");
                if (node.elseBranch) traverse(node.elseBranch, currentId, "else");
                break;
            case "WhileStmt":
                if (node.condition) traverse(node.condition, currentId, "condition");
                if (node.statement) traverse(node.statement, currentId, "body");
                break;
            case "Get":
                if (node.object) traverse(node.object, currentId, "object");
                break;
            case "Set":
                if (node.object) traverse(node.object, currentId, "object");
                if (node.value) traverse(node.value, currentId, "value");
                break;
            case "ClassStmt":
                if (node.superClass) traverse(node.superClass, currentId, "extends");
                if (node.instanceMethods) node.instanceMethods.forEach(m => traverse(m, currentId, "method"));
                if (node.classMethods) node.classMethods.forEach(m => traverse(m, currentId, "static"));
                break;
            case "Array":
                if (node.elements) node.elements.forEach((e, i) => traverse(e, currentId, `[${i}]`));
                break;
            case "GetIndex":
                if (node.array) traverse(node.array, currentId, "array");
                if (node.index) traverse(node.index, currentId, "index");
                break;
            case "SetIndex":
                if (node.array) traverse(node.array, currentId, "array");
                if (node.index) traverse(node.index, currentId, "index");
                if (node.value) traverse(node.value, currentId, "value");
                break;
            default:
                if (node.expression) traverse(node.expression, currentId, "expr");
                if (node.body) traverse(node.body, currentId, "body");
                break;
        }
        return currentId;
    };

    const rootId = "root";
    initialNodes.push({
        id: rootId,
        data: { title: "Program Root", details: "Main execution flow", label: <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'white' }}>Program Root</div> },
        style: { backgroundColor: '#238636', border: 'none', borderRadius: '8px' }
    });

    if (Array.isArray(astNodes)) {
        astNodes.forEach((stmt, i) => traverse(stmt, rootId, `stmt ${i}`));
    }

    return getLayoutedElements(initialNodes, initialEdges);
};

export default function ASTGraph({ astData, onNodeClick }) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        if (astData) {
            const { nodes: layoutedNodes, edges: layoutedEdges } = generateNodesAndEdges(astData);
            setNodes(layoutedNodes);
            setEdges(layoutedEdges);
        }
    }, [astData, setNodes, setEdges]);

    return (
        <div style={{ height: '100%', width: '100%', minHeight: '500px' }}>
            <ReactFlow 
                nodes={nodes} 
                edges={edges} 
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(e, node) => onNodeClick && onNodeClick(node.data)}
                onPaneClick={() => onNodeClick && onNodeClick(null)}
                fitView
                attributionPosition="bottom-right"
            >
                <Background color="#30363d" gap={20} size={2} />
                <Controls />
            </ReactFlow>
        </div>
    );
}