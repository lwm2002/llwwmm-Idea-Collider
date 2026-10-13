import { useEffect, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Handle,
  Position,
  useNodesInitialized,
  useNodesState,
} from '@xyflow/react';
import type { Edge, Node, NodeProps, ReactFlowInstance } from '@xyflow/react';
import { ArrowUpRight, Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';
import type { Concept } from '../types';
import '@xyflow/react/dist/style.css';

type BoardData = {
  side: 'a' | 'b' | 'note';
  concept?: Concept;
  onOpen?: (concept: Concept) => void;
};
type BoardNode = Node<BoardData>;
const desktopPositions = { a: { x: 30, y: 70 }, b: { x: 440, y: 125 }, note: { x: 215, y: 330 } };
const mobilePositions = { a: { x: 10, y: 30 }, b: { x: 10, y: 250 }, note: { x: 245, y: 150 } };
function SketchOutline() {
  return (
    <svg
      className="sketch-note-outline"
      viewBox="0 0 230 210"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <path d="M12 7C73 4 150 8 218 6Q224 7 223 17L225 194Q224 204 213 203C153 205 71 201 14 204Q7 204 8 193L6 20Q5 8 12 7Z" />
      <path d="M13 8C86 9 154 4 218 8L223 197C154 202 80 205 9 201L8 15" />
    </svg>
  );
}
function ConceptNote({ data }: NodeProps<BoardNode>) {
  if (data.side === 'note')
    return (
      <div className="board-thought">
        <SketchOutline />
        <Handle type="target" position={Position.Top} />
        <span>试着把它们连起来</span>
        <strong>
          新的可能，
          <br />
          从这里发生。
        </strong>
        <span className="thought-mark" aria-hidden="true">
          ✳
        </span>
      </div>
    );
  const concept = data.concept!;
  return (
    <div className={`board-concept arena-${data.side}`}>
      <SketchOutline />
      <Handle type="source" position={Position.Bottom} />
      <span className="note-label">
        概念 {data.side.toUpperCase()}
        <span>{concept.category}</span>
      </span>
      <button
        className="nodrag"
        aria-label={`查看实验台概念 ${data.side.toUpperCase()}：${concept.name}`}
        onClick={() => data.onOpen?.(concept)}
      >
        <strong>{concept.name}</strong>
        <ArrowUpRight size={18} />
      </button>
      <p>{concept.description}</p>
      <div className="note-properties">
        {concept.properties.slice(0, 2).map((property) => (
          <span key={property}>{property}</span>
        ))}
      </div>
    </div>
  );
}
const nodeTypes = { note: ConceptNote };
const edges: Edge[] = ['a', 'b'].map((source, i) => ({
  id: `${source}-idea`,
  source,
  target: 'note',
  type: 'smoothstep',
  style: { stroke: i === 0 ? '#bd8995' : '#9292b3', strokeWidth: 1.6 },
  label: i === 0 ? '换一个视角' : '试一次相遇',
  labelStyle: { fill: '#827d8d', fontSize: 11 },
  labelBgStyle: { fill: '#faf9f6', fillOpacity: 1 },
  labelBgPadding: [8, 5],
}));

function Board({ a, b, onOpen }: { a: Concept; b: Concept; onOpen: (concept: Concept) => void }) {
  const [layout, setLayout, onNodesChange] = useNodesState<BoardNode>(
    Object.entries(desktopPositions).map(([id, position]) => ({
      id,
      type: 'note',
      position,
      data: { side: id as BoardData['side'] },
    })),
  );
  const flow = useRef<ReactFlowInstance<BoardNode> | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const lastCompact = useRef<boolean | null>(null);
  const fitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useNodesInitialized();
  useEffect(() => {
    if (!initialized) return;
    const timer = setTimeout(() => void flow.current?.fitView({ padding: 0.18, maxZoom: 1 }), 100);
    return () => clearTimeout(timer);
  }, [initialized]);
  const nodes: BoardNode[] = layout.map((node) => ({
    ...node,
    data: { ...node.data, concept: node.id === 'a' ? a : node.id === 'b' ? b : undefined, onOpen },
  }));
  function arrange() {
    const positions =
      (container.current?.clientWidth ?? 800) < 550 ? mobilePositions : desktopPositions;
    setLayout((current) =>
      current.map((node) => ({ ...node, position: positions[node.id as keyof typeof positions] })),
    );
    if (fitTimer.current) clearTimeout(fitTimer.current);
    fitTimer.current = setTimeout(
      () => void flow.current?.fitView({ padding: 0.2, maxZoom: 1 }),
      100,
    );
  }
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const compact = entry.contentRect.width < 550;
      if (compact === lastCompact.current) return;
      lastCompact.current = compact;
      const positions = compact ? mobilePositions : desktopPositions;
      setLayout((current) =>
        current.map((node) => ({
          ...node,
          position: positions[node.id as keyof typeof positions],
        })),
      );
      if (fitTimer.current) clearTimeout(fitTimer.current);
      fitTimer.current = setTimeout(
        () => void flow.current?.fitView({ padding: 0.18, maxZoom: 1 }),
        100,
      );
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      if (fitTimer.current) clearTimeout(fitTimer.current);
    };
  }, [setLayout]);
  return (
    <div ref={container} className="concept-whiteboard">
      <ReactFlow<BoardNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onInit={(instance) => {
          flow.current = instance;
        }}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={1.6}
        colorMode="light"
        nodesConnectable={false}
        edgesReconnectable={false}
        deleteKeyCode={null}
        zoomOnDoubleClick={false}
      >
        <Background color="#dbd8d2" gap={22} size={1} />
      </ReactFlow>
      <div className="board-view-tools" aria-label="画布视图工具">
        <button onClick={() => void flow.current?.zoomOut()} aria-label="缩小画布">
          <Minus size={16} />
        </button>
        <button
          onClick={() => void flow.current?.fitView({ padding: 0.2, maxZoom: 1 })}
          aria-label="适应画布"
        >
          <Maximize2 size={15} />
        </button>
        <button onClick={() => void flow.current?.zoomIn()} aria-label="放大画布">
          <Plus size={16} />
        </button>
        <span />
        <button onClick={arrange} aria-label="重新排列概念">
          <RotateCcw size={15} />
        </button>
      </div>
      <span className="board-gesture-hint">拖动便签 · 拖动空白处移动画布 · 滚轮缩放</span>
    </div>
  );
}

export function ConceptWorkbench(props: {
  a: Concept;
  b: Concept;
  onOpen: (concept: Concept) => void;
}) {
  return (
    <ReactFlowProvider>
      <Board {...props} />
    </ReactFlowProvider>
  );
}
