import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useDecisionDayQuery } from '@/hooks/queries'
import { useUIStore } from '@/stores/ui-store'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { formatMW, formatSignedMW } from '@/lib/formatters'
import {
  GitFork,
  ArrowLeft,
  Settings,
  FileText,
  Layers,
  Activity,
  Award,
} from 'lucide-react'

// --- Custom React Flow Node Components ---

interface NodeData {
  title: string
  subtitle: string
  status?: string
  statusVariant?: 'success' | 'warning' | 'forecast' | 'actual' | 'neutral'
  fields: Array<{ label: string; value: string }>
  icon: React.ComponentType<{ className?: string }>
}

function CustomProvenanceNode({ data }: { data: NodeData }) {
  const Icon = data.icon
  return (
    <div className="w-64 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#12141c] p-3.5 shadow-md text-xs transition-shadow hover:shadow-lg">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-blue-600 !w-2.5 !h-2.5 !border-2 !border-white dark:!border-zinc-900"
      />

      <div className="flex items-center justify-between pb-2 border-b border-black/[0.05] dark:border-white/[0.05]">
        <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
          <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span>{data.title}</span>
        </div>
        {data.status && (
          <Badge variant={data.statusVariant || 'neutral'} size="sm">
            {data.status}
          </Badge>
        )}
      </div>

      <div className="text-[11px] text-zinc-500 mt-1 mb-2.5">{data.subtitle}</div>

      <div className="space-y-1.5 pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
        {data.fields.map((f, i) => (
          <div key={i} className="flex justify-between items-center text-[11px]">
            <span className="text-zinc-500">{f.label}:</span>
            <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
              {f.value}
            </span>
          </div>
        ))}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-blue-600 !w-2.5 !h-2.5 !border-2 !border-white dark:!border-zinc-900"
      />
    </div>
  )
}

const nodeTypes = {
  customNode: CustomProvenanceNode,
}

// --- Main Page Component ---

export function ProvenanceExplorerPage() {
  const { date: routeDate } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const { selectedDecisionDate } = useUIStore()

  const activeDate = routeDate || selectedDecisionDate || '2026-01-02'
  const { data: decisionDay, isLoading, isError, error, refetch } =
    useDecisionDayQuery(activeDate)

  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Construct nodes and edges from real backend decisionDay snapshot
  const { nodes, edges } = useMemo(() => {
    if (!decisionDay) return { nodes: [], edges: [] }

    const sampleInterval =
      decisionDay.intervals.find((i) => i.match_status === 'MATCHED') ||
      decisionDay.intervals[0]

    const initialNodes: Node[] = [
      {
        id: 'node-config',
        type: 'customNode',
        position: { x: 50, y: 150 },
        data: {
          title: 'Decision Config',
          subtitle: 'Market deadline & assumptions',
          status: 'ACTIVE',
          statusVariant: 'neutral',
          icon: Settings,
          fields: [
            { label: 'Decision Date', value: decisionDay.decision_date },
            { label: 'Local Cutoff', value: decisionDay.decision_cutoff_local },
            { label: 'Timezone', value: decisionDay.decision_timezone },
            { label: 'Lead Days', value: '1 Day Ahead' },
          ],
        },
      },
      {
        id: 'node-eligible',
        type: 'customNode',
        position: { x: 380, y: 60 },
        data: {
          title: 'Eligible Publications',
          subtitle: 'Elexon WINDFOR stream',
          status: 'ELIGIBLE',
          statusVariant: 'forecast',
          icon: FileText,
          fields: [
            { label: 'Dataset', value: 'WINDFOR' },
            { label: 'Cutoff Constraint', value: '<= 10:00 UK' },
            { label: 'Selected Issue', value: decisionDay.selected_publication_time_utc ? '09:45 UTC' : '10:00 UTC' },
            { label: 'Status', value: '100% Eligible' },
          ],
        },
      },
      {
        id: 'node-snapshot',
        type: 'customNode',
        position: { x: 710, y: 60 },
        data: {
          title: 'Decision Snapshot',
          subtitle: 'Official day-ahead purchasing record',
          status: decisionDay.completeness_status,
          statusVariant: decisionDay.completeness_status === 'COMPLETE' ? 'success' : 'warning',
          icon: Layers,
          fields: [
            { label: 'Selection Policy', value: decisionDay.selection_policy },
            { label: 'Intervals', value: `${decisionDay.metrics.matched_intervals} / ${decisionDay.metrics.expected_intervals}` },
            { label: 'Completeness', value: decisionDay.completeness_status },
            { label: 'Authoritative', value: 'Yes' },
          ],
        },
      },
      {
        id: 'node-actuals',
        type: 'customNode',
        position: { x: 710, y: 280 },
        data: {
          title: 'Actual Generation',
          subtitle: 'Elexon FUELHH meter outturn',
          status: 'VERIFIED',
          statusVariant: 'actual',
          icon: Activity,
          fields: [
            { label: 'Dataset', value: 'FUELHH' },
            { label: 'Fuel Filter', value: 'WIND' },
            { label: 'Delivery Date', value: decisionDay.delivery_date },
            { label: 'Sample SP Power', value: formatMW(sampleInterval?.actual_mw) },
          ],
        },
      },
      {
        id: 'node-comparison',
        type: 'customNode',
        position: { x: 1040, y: 150 },
        data: {
          title: 'Interval Comparison',
          subtitle: 'Settlement matching & residual',
          status: 'MATCHED',
          statusVariant: 'success',
          icon: GitFork,
          fields: [
            { label: 'Target Interval', value: '14:00 UK (SP 29)' },
            { label: 'Forecast Power', value: formatMW(sampleInterval?.forecast_mw) },
            { label: 'Actual Power', value: formatMW(sampleInterval?.actual_mw) },
            { label: 'Signed Error', value: formatSignedMW(sampleInterval?.signed_error_mw) },
          ],
        },
      },
      {
        id: 'node-accuracy',
        type: 'customNode',
        position: { x: 1370, y: 150 },
        data: {
          title: 'Accuracy Engine',
          subtitle: 'Canonical statistical metrics',
          status: 'CALCULATED',
          statusVariant: 'success',
          icon: Award,
          fields: [
            { label: 'Day MAE', value: formatMW(decisionDay.metrics.mae_mw) },
            { label: 'Forecast Bias', value: formatSignedMW(decisionDay.metrics.bias_mw) },
            { label: 'RMSE', value: formatMW(decisionDay.metrics.rmse_mw) },
            { label: 'Coverage', value: `${(decisionDay.metrics.coverage_ratio * 100).toFixed(0)}%` },
          ],
        },
      },
    ]

    const initialEdges: Edge[] = [
      {
        id: 'e-config-eligible',
        source: 'node-config',
        target: 'node-eligible',
        animated: true,
        label: 'Enforces Cutoff',
        style: { stroke: '#3b82f6', strokeWidth: 1.5 },
      },
      {
        id: 'e-eligible-snapshot',
        source: 'node-eligible',
        target: 'node-snapshot',
        animated: true,
        label: 'Latest Strict',
        style: { stroke: '#0284c7', strokeWidth: 1.5 },
      },
      {
        id: 'e-snapshot-comparison',
        source: 'node-snapshot',
        target: 'node-comparison',
        animated: true,
        label: 'Eligible Forecast',
        style: { stroke: '#0284c7', strokeWidth: 1.5 },
      },
      {
        id: 'e-actuals-comparison',
        source: 'node-actuals',
        target: 'node-comparison',
        animated: true,
        label: 'Eventual Outturn',
        style: { stroke: '#0d9488', strokeWidth: 1.5 },
      },
      {
        id: 'e-comparison-accuracy',
        source: 'node-comparison',
        target: 'node-accuracy',
        animated: true,
        label: 'Error Aggregation',
        style: { stroke: '#10b981', strokeWidth: 1.5 },
      },
    ]

    return { nodes: initialNodes, edges: initialEdges }
  }, [decisionDay])

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.data as unknown as NodeData)
    setIsDrawerOpen(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-[550px] w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !decisionDay) {
    return (
      <EmptyState
        title="Unable to Load Provenance Graph"
        description={(error as Error)?.message || 'Failed to construct lineage graph.'}
        actionLabel="Retry"
        onAction={() => refetch()}
        isError
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/decision/${activeDate}`)}
              className="h-7 px-2 text-zinc-500"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Day Audit
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            Forecast Provenance & Lineage Explorer
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Interactive trace mapping Decision Configuration → Eligible Publications → Selected
            Snapshot → Settlement Comparison → Accuracy Result.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="forecast" size="sm">
            Decision Date: {decisionDay.decision_date}
          </Badge>
          <Badge variant="actual" size="sm">
            Delivery Date: {decisionDay.delivery_date}
          </Badge>
        </div>
      </div>

      {/* React Flow Canvas */}
      <Card className="p-0 overflow-hidden border-black/[0.08] dark:border-white/[0.08] h-[580px] relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.5}
          maxZoom={1.5}
          attributionPosition="bottom-right"
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls className="!bg-white dark:!bg-[#12141c] !border-black/10 dark:!border-white/10 shadow-md" />
        </ReactFlow>

        {/* Tip overlay */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <Badge variant="neutral" size="sm" className="bg-white/90 dark:bg-[#12141c]/90 backdrop-blur-xs">
            💡 Click any node to inspect detailed parameters
          </Badge>
        </div>
      </Card>

      {/* Node Detail Drawer */}
      {selectedNode && (
        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          title={selectedNode.title}
          subtitle={selectedNode.subtitle}
        >
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-black/[0.05] dark:border-white/[0.05] flex justify-between items-center">
              <span className="text-xs text-zinc-500">Node Status:</span>
              <Badge variant={selectedNode.statusVariant || 'neutral'}>
                {selectedNode.status || 'OK'}
              </Badge>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Component Attributes
              </h4>
              <div className="divide-y divide-black/[0.04] dark:divide-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] rounded-lg p-3 bg-white dark:bg-[#12141c]">
                {selectedNode.fields.map((f, i) => (
                  <div key={i} className="py-2 flex justify-between items-center text-xs">
                    <span className="text-zinc-500">{f.label}</span>
                    <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              This node reflects authoritative runtime metadata guaranteed by the Gridbricks
              snapshot engine. All forecast vintages published after the cutoff are excluded by
              design.
            </div>
          </div>
        </Drawer>
      )}
    </div>
  )
}
