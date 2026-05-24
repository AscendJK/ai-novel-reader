import { useEffect, useRef, useState } from "react";
// @ts-ignore - d3-force types not installed
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from "d3-force";
import type { GraphData } from "@/hooks/useSummarizer";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, RefreshCw } from "lucide-react";

interface Props {
  graphData: GraphData;
  onRegenerate?: () => void;
}

const GROUP_COLORS: Record<string, string> = {
  "主角": "#7c3aed",
  "配角": "#2563eb",
  "反派": "#dc2626",
  "导师": "#059669",
  "恋人": "#ec4899",
  "其他": "#6b7280",
};

function getColor(group: string): string {
  return GROUP_COLORS[group] || GROUP_COLORS["其他"];
}

interface SimNode { id: string; group: string; description: string; x: number; y: number }
interface SimEdge { source: SimNode; target: SimNode; label: string }

export function CharacterGraph({ graphData, onRegenerate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [simData, setSimData] = useState<{ nodes: SimNode[]; edges: SimEdge[] } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!graphData.nodes.length) return;

    const nodes: SimNode[] = graphData.nodes.map((n) => ({
      ...n, x: (Math.random() - 0.5) * 300, y: (Math.random() - 0.5) * 300,
    }));

    const edges: SimEdge[] = graphData.edges
      .map((e) => ({
        source: nodes.find((n) => n.id === e.source)!,
        target: nodes.find((n) => n.id === e.target)!,
        label: e.label,
      }))
      .filter((l) => l.source && l.target);

    const sim = forceSimulation(nodes)
      .force("link", forceLink<SimNode, SimEdge>(edges).distance(200).strength(0.3))
      .force("charge", forceManyBody().strength(-900))
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide(55))
      .stop();

    for (let i = 0; i < 500; i++) {
      sim.tick();
      if (sim.alpha() < 0.001) break;
    }

    const finalNodes = nodes.map((n) => ({ ...n }));
    const finalEdges = edges.map((e) => ({
      ...e,
      source: finalNodes.find((fn) => fn.id === (e.source as SimNode).id)!,
      target: finalNodes.find((fn) => fn.id === (e.target as SimNode).id)!,
    }));

    setSimData({ nodes: finalNodes, edges: finalEdges });
  }, [graphData]);

  // Reset pan on expand/collapse
  useEffect(() => {
    setDragOffset({ x: 0, y: 0 });
  }, [expanded]);

  if (!graphData.nodes.length) {
    return <div className="text-xs text-muted-foreground text-center py-4">图谱数据为空，请重试</div>;
  }
  if (!simData) {
    return <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">计算布局中...</div>;
  }

  const nodeCount = simData.nodes.length;
  const viewSize = expanded ? Math.max(900, nodeCount * 160) : 280;
  const fontSize = expanded ? 13 : 9;
  const nodeRadius = expanded ? 20 : 10;

  // Mouse drag handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!expanded) return;
    setDragging(true);
    dragStart.current = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !expanded) return;
    setDragOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => setDragging(false);

  return (
    <>
      {/* Inline graph */}
      <div className="relative border rounded-lg bg-muted/20 overflow-hidden" style={{ height: 200 }}>
        <div className="absolute top-1 right-1 z-10 flex gap-1">
          {onRegenerate && (
            <Button variant="ghost" size="icon" className="h-6 w-6 bg-background/80" onClick={onRegenerate} title="重绘">
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6 bg-background/80" onClick={() => setExpanded(true)} title="放大">
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
        <div className="w-full h-full flex items-center justify-center">
          <svg viewBox={`${-viewSize / 2} ${-viewSize / 2} ${viewSize} ${viewSize}`}
            className="w-full h-full">
            {simData.nodes.map((n) => (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r={nodeRadius} fill={getColor(n.group)}
                  stroke="var(--background)" strokeWidth={1.5} />
                <text x={n.x} y={n.y + nodeRadius + 3} textAnchor="middle"
                  className="fill-foreground font-medium" fontSize={fontSize}>
                  {n.id}
                </text>
              </g>
            ))}
            {simData.edges.map((e, i) => {
              if (!e.source || !e.target) return null;
              return (
                <line key={`e-${i}`} x1={e.source.x} y1={e.source.y} x2={e.target.x} y2={e.target.y}
                  stroke="currentColor" strokeOpacity={0.12} strokeWidth={0.8} />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Expanded fullscreen */}
      {expanded && (
        <div className="fixed inset-0 z-50 bg-background/95 flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-sm">人物关系图谱</h3>
              <span className="text-xs text-muted-foreground">
                {simData.nodes.length} 人 · {simData.edges.length} 条关系 · 可拖拽平移
              </span>
            </div>
            <div className="flex gap-1.5">
              {onRegenerate && (
                <Button variant="outline" size="sm" onClick={onRegenerate}>重绘</Button>
              )}
              <Button variant="outline" size="icon" onClick={() => setExpanded(false)}>
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Scrollable graph area */}
          <div
            ref={containerRef}
            className="flex-1 overflow-auto cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              className="min-w-full min-h-full flex items-center justify-center p-8"
              style={{
                transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
              }}
            >
              <svg
                viewBox={`${-viewSize / 2} ${-viewSize / 2} ${viewSize} ${viewSize}`}
                width={viewSize}
                height={viewSize}
                style={{ maxWidth: viewSize, maxHeight: viewSize }}
              >
                {simData.edges.map((e, i) => {
                  if (!e.source || !e.target) return null;
                  const mx = (e.source.x + e.target.x) / 2;
                  const my = (e.source.y + e.target.y) / 2;
                  return (
                    <g key={`ee-${i}`}>
                      <line x1={e.source.x} y1={e.source.y} x2={e.target.x} y2={e.target.y}
                        stroke="currentColor" strokeOpacity={0.15} strokeWidth={1.5} />
                      <text x={mx} y={my} textAnchor="middle" dominantBaseline="middle"
                        className="fill-muted-foreground" fontSize={fontSize} dy={8}>
                        {e.label}
                      </text>
                    </g>
                  );
                })}
                {simData.nodes.map((n) => (
                  <g key={n.id}>
                    <circle cx={n.x} cy={n.y} r={nodeRadius} fill={getColor(n.group)}
                      stroke="var(--background)" strokeWidth={2} />
                    <text x={n.x} y={n.y + nodeRadius + 4} textAnchor="middle"
                      className="fill-foreground font-medium" fontSize={fontSize}>
                      {n.id}
                    </text>
                    {n.description && (
                      <text x={n.x} y={n.y + nodeRadius + 18} textAnchor="middle"
                        className="fill-muted-foreground" fontSize={fontSize - 2}>
                        {n.description.length > 25 ? n.description.slice(0, 25) + "..." : n.description}
                      </text>
                    )}
                  </g>
                ))}
                {/* Legend */}
                <g transform={`translate(${viewSize / 2 - 150}, ${-viewSize / 2 + 10})`}>
                  {Object.entries(GROUP_COLORS).slice(0, -1).map(([group, color], i) => (
                    <g key={group} transform={`translate(0, ${i * 18})`}>
                      <circle cx={0} cy={0} r={4} fill={color} />
                      <text x={10} y={3} className="fill-muted-foreground" fontSize={10}>{group}</text>
                    </g>
                  ))}
                </g>
              </svg>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
