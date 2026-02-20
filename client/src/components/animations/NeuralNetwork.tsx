import { useMemo } from 'react';
import { motion } from 'motion/react';

interface Node {
  id: number;
  cx: number;
  cy: number;
  r: number;
  layer: number;
}

interface Edge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface NeuralNetworkProps {
  /** Whether the network is actively "thinking" */
  active?: boolean;
  /** Number of layers */
  layers?: number;
  /** Nodes per layer */
  nodesPerLayer?: number;
  /** CSS class for the SVG container */
  className?: string;
  /** Node color */
  color?: string;
}

function buildNetwork(layers: number, nodesPerLayer: number) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const layerSpacing = 100 / (layers + 1);

  for (let l = 0; l < layers; l++) {
    const x = layerSpacing * (l + 1);
    const nodeSpacing = 100 / (nodesPerLayer + 1);

    for (let n = 0; n < nodesPerLayer; n++) {
      const y = nodeSpacing * (n + 1);
      const node: Node = {
        id: l * nodesPerLayer + n,
        cx: x,
        cy: y,
        r: 2.5,
        layer: l,
      };
      nodes.push(node);

      // Connect to previous layer
      if (l > 0) {
        for (let pn = 0; pn < nodesPerLayer; pn++) {
          const prevNode = nodes[(l - 1) * nodesPerLayer + pn];
          edges.push({
            id: `${prevNode.id}-${node.id}`,
            x1: prevNode.cx,
            y1: prevNode.cy,
            x2: node.cx,
            y2: node.cy,
          });
        }
      }
    }
  }

  return { nodes, edges };
}

function NeuralNetwork({
  active = false,
  layers = 4,
  nodesPerLayer = 4,
  className = '',
  color = 'var(--bmn-color-accent)',
}: NeuralNetworkProps) {
  const { nodes, edges } = useMemo(
    () => buildNetwork(layers, nodesPerLayer),
    [layers, nodesPerLayer],
  );

  return (
    <svg
      viewBox="0 0 100 100"
      className={`w-full h-full ${className}`}
      aria-hidden="true"
    >
      {/* Edges */}
      {edges.map((edge, i) => (
        <motion.line
          key={edge.id}
          x1={edge.x1}
          y1={edge.y1}
          x2={edge.x2}
          y2={edge.y2}
          stroke={color}
          strokeWidth={0.3}
          initial={{ opacity: 0.05 }}
          animate={
            active
              ? {
                  opacity: [0.05, 0.4, 0.05],
                  strokeWidth: [0.3, 0.6, 0.3],
                }
              : { opacity: 0.08 }
          }
          transition={{
            duration: 1.5,
            delay: (i % 8) * 0.15,
            repeat: active ? Infinity : 0,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Nodes */}
      {nodes.map((node, i) => (
        <motion.circle
          key={node.id}
          cx={node.cx}
          cy={node.cy}
          r={node.r}
          fill={color}
          initial={{ opacity: 0.2, scale: 1 }}
          animate={
            active
              ? {
                  opacity: [0.3, 1, 0.3],
                  scale: [1, 1.4, 1],
                }
              : { opacity: 0.3 }
          }
          transition={{
            duration: 1.2,
            delay: (node.layer * 0.3) + (i % nodesPerLayer) * 0.1,
            repeat: active ? Infinity : 0,
            ease: 'easeInOut',
          }}
        />
      ))}
    </svg>
  );
}

export { NeuralNetwork };
export type { NeuralNetworkProps };
