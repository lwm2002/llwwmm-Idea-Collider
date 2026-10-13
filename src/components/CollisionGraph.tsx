import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import type { Node, NodeProps, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Concept, Connection } from '../types';
import { formatScore } from '../services/ai/scores';
type GraphData = {
  label: string;
  sub: string;
  type: 'a' | 'b' | 'connection' | 'property-a' | 'property-b';
  connectionId?: string;
};
type GraphNode = Node<GraphData>;
function LabNode({ data }: NodeProps<GraphNode>) {
  const property = data.type.startsWith('property');
  return (
    <div
      className={`lab-node lab-node-${data.type}`}
      title={`${data.label}${data.sub ? ` · ${data.sub}` : ''}`}
    >
      <Handle type="target" position={Position.Left} />
      {data.type === 'connection' ? (
        <button>
          <small>CONNECTION</small>
          <strong>{data.label}</strong>
          <span>{data.sub} ↗</span>
        </button>
      ) : (
        <div>
          <small>{property ? 'PROPERTY' : `CONCEPT ${data.type.toUpperCase()}`}</small>
          <strong>{data.label}</strong>
          {data.sub && <span>{data.sub}</span>}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { lab: LabNode };
function graph(
  a: Concept,
  b: Concept,
  connections: Connection[],
): { nodes: GraphNode[]; edges: Edge[] } {
  const nodes: GraphNode[] = [
    {
      id: 'concept:a',
      type: 'lab',
      position: { x: 0, y: 225 },
      data: { label: a.name, sub: `${a.category} · ${a.functions.join(' / ')}`, type: 'a' },
    },
    {
      id: 'concept:b',
      type: 'lab',
      position: { x: 1120, y: 225 },
      data: { label: b.name, sub: `${b.category} · ${b.functions.join(' / ')}`, type: 'b' },
    },
  ];
  const edges: Edge[] = [];
  connections.forEach((c, i) => {
    const pa = `property-a:${c.id}`,
      pb = `property-b:${c.id}`,
      connectionId = `connection:${c.id}`;
    nodes.push(
      {
        id: pa,
        type: 'lab',
        position: { x: 290, y: i * 115 + 14 },
        data: { label: c.conceptAProperty, sub: '', type: 'property-a' },
      },
      {
        id: connectionId,
        type: 'lab',
        position: { x: 555, y: i * 115 },
        data: {
          label: c.title,
          sub: `新颖 ${formatScore(c.novelty)} · 可行 ${formatScore(c.plausibility)}`,
          type: 'connection',
          connectionId: c.id,
        },
      },
      {
        id: pb,
        type: 'lab',
        position: { x: 900, y: i * 115 + 14 },
        data: { label: c.conceptBProperty, sub: '', type: 'property-b' },
      },
    );
    for (const [source, target, stroke] of [
      ['concept:a', pa, '#db9ca9'],
      [pa, connectionId, '#db9ca9'],
      [connectionId, pb, '#8e9fe9'],
      [pb, 'concept:b', '#8e9fe9'],
    ])
      edges.push({
        id: `${source}-${target}`,
        source,
        target,
        animated: false,
        style: { stroke, strokeWidth: 1.6 },
      });
  });
  return { nodes, edges };
}
export function CollisionGraph({
  a,
  b,
  connections,
  onSelect,
}: {
  a: Concept;
  b: Concept;
  connections: Connection[];
  onSelect: (id: string) => void;
}) {
  const initial = graph(a, b, connections);
  const [nodes, , onNodesChange] = useNodesState(initial.nodes);
  const [edges, , onEdgesChange] = useEdgesState(initial.edges);
  const onNodeClick = useCallback(
    (_: unknown, node: GraphNode) => {
      if (node.data.type === 'connection' && node.data.connectionId)
        onSelect(node.data.connectionId);
    },
    [onSelect],
  );
  return (
    <div className="graph-container">
      <div className="graph-label">
        <span className="eyebrow">LIVE CONNECTION MAP</span>
        <span>拖动节点 · 滚轮缩放 · 点击连接生成创意</span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.25}
        maxZoom={1.6}
        colorMode="light"
        nodesConnectable={false}
        proOptions={{ hideAttribution: false }}
      >
        <Background color="#ddd9d3" gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
