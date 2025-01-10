import React from 'react';
import ReactFlow, {
    Controls,
    Background,
    useNodesState,
    useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

function LineageGraph({ tableName, sources, processes }) {
    // Create nodes for the graph
    const createNodes = () => {
        const nodes = [];
        const edges = [];

        // Add current table as the main node
        nodes.push({
            id: tableName,
            position: { x: 400, y: 200 },
            data: { label: tableName },
            type: 'default',
            style: {
                background: '#e3f2fd',
                color: '#1976d2',
                border: '1px solid #bbdefb',
                borderRadius: '4px',
                padding: '10px',
                fontSize: '12px',
                fontFamily: 'Roboto Mono, monospace',
                width: 250,
            },
        });

        // If there are source tables, add them and their connections
        if (sources && sources.length > 0) {
            sources.forEach((source, index) => {
                const sourceId = `source-${index}`;
                const yPos = 50 + (index * 100);

                // Add source node
                nodes.push({
                    id: sourceId,
                    position: { x: 50, y: yPos },
                    data: { label: source },
                    type: 'default',
                    style: {
                        background: '#f8f9fa',
                        border: '1px solid #e9ecef',
                        borderRadius: '4px',
                        padding: '10px',
                        fontSize: '12px',
                        fontFamily: 'Roboto Mono, monospace',
                        width: 250,
                    },
                });

                // Add edge from source to target
                edges.push({
                    id: `edge-${sourceId}`,
                    source: sourceId,
                    target: tableName,
                    animated: true,
                    style: { stroke: '#1976d2' },
                });

                // If there are processes, add them as labels on the edges
                const relatedProcess = processes?.find(p => p.sql?.includes(source));
                if (relatedProcess) {
                    edges[edges.length - 1].label = 'SQL Transform';
                    edges[edges.length - 1].labelStyle = {
                        fill: '#666',
                        fontSize: '10px',
                        fontFamily: 'Roboto Mono, monospace'
                    };
                }
            });
        }

        return { nodes, edges };
    };

    const { nodes: initialNodes, edges: initialEdges } = createNodes();
    const [nodes, , onNodesChange] = useNodesState(initialNodes);
    const [edges, , onEdgesChange] = useEdgesState(initialEdges);

    return (
        <div style={{ height: '400px', background: 'white' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
            >
                <Controls />
                <Background color="#f8f9fa" />
            </ReactFlow>
        </div>
    );
}

export default LineageGraph; 