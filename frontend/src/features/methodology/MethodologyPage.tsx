import { Calculator, Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'

export function MethodologyPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Editorial Header */}
      <div className="pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
          Methodology & Analytical Conventions
        </h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Formal definitions, statistical formulas, temporal cutoff rules, and market interpretation
          guidelines for Gridbricks.
        </p>
      </div>

      {/* Critical Business Disclaimer */}
      <Alert variant="warning" title="Retrospective Analytical Scope & Procurement Disclaimer">
        <p>
          Gridbricks is a retrospective decision-support platform designed to evaluate historical
          forecast performance at the day-ahead purchasing deadline.
          <strong>
            {' '}
            Wind forecast error does not automatically equal overall electricity procurement error.
          </strong>{' '}
          Day-ahead procurement requirements depend on customer demand forecasts, non-wind generation
          portfolios, transmission constraints, and balancing mechanism positions. Historical
          accuracy must not be taken as a guarantee of future operational performance.
        </p>
      </Alert>

      {/* Core Statistical Metrics */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Calculator className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Statistical Metric Definitions
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            title="Mean Absolute Error (MAE)"
            subtitle="Unit: MW • Population: Matched Settlement Intervals"
          >
            <div className="bg-zinc-100 dark:bg-zinc-800/80 p-2.5 rounded font-mono text-xs text-zinc-800 dark:text-zinc-200 mb-2">
              MAE = (1 / N) * Σ |Forecast_i - Actual_i|
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Represents the average expected magnitude of forecast error across all settlement
              periods, treating positive and negative deviations equally. Unlike RMSE, MAE is not
              disproportionately skewed by rare outlier spikes.
            </p>
          </Card>

          <Card
            title="Root Mean Squared Error (RMSE)"
            subtitle="Unit: MW • Quadratic Loss Penalty"
          >
            <div className="bg-zinc-100 dark:bg-zinc-800/80 p-2.5 rounded font-mono text-xs text-zinc-800 dark:text-zinc-200 mb-2">
              RMSE = sqrt((1 / N) * Σ (Forecast_i - Actual_i)²)
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Penalizes large forecast errors quadratically. Because extreme supply errors create
              steep cashout balancing charges on the UK electricity market, a high ratio of RMSE to
              MAE signifies tail-risk volatility.
            </p>
          </Card>

          <Card
            title="Forecast Bias (Mean Signed Error)"
            subtitle="Unit: MW • Directional Asymmetry"
          >
            <div className="bg-zinc-100 dark:bg-zinc-800/80 p-2.5 rounded font-mono text-xs text-zinc-800 dark:text-zinc-200 mb-2">
              Bias = (1 / N) * Σ (Forecast_i - Actual_i)
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Standard sign convention: <strong>Forecast minus Actual</strong>.
            </p>
            <div className="mt-2 flex gap-2">
              <Badge variant="overforecast" size="sm">
                Positive (+) = Overforecast
              </Badge>
              <Badge variant="underforecast" size="sm">
                Negative (-) = Underforecast
              </Badge>
            </div>
          </Card>

          <Card
            title="Weighted Absolute Percentage Error (WAPE)"
            subtitle="Unit: % • Scale-Independent Comparison"
          >
            <div className="bg-zinc-100 dark:bg-zinc-800/80 p-2.5 rounded font-mono text-xs text-zinc-800 dark:text-zinc-200 mb-2">
              WAPE = (Σ |Forecast_i - Actual_i| / Σ Actual_i) * 100
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Normalizes aggregate absolute error by total actual wind volume produced. Avoids the
              infinite division distortion of standard MAPE during periods of low or near-zero wind
              generation.
            </p>
          </Card>

          <Card
            title="P90 Absolute Error"
            subtitle="Unit: MW • 90th Percentile Risk Horizon"
          >
            <div className="bg-zinc-100 dark:bg-zinc-800/80 p-2.5 rounded font-mono text-xs text-zinc-800 dark:text-zinc-200 mb-2">
              P90 = Percentile(|Forecast - Actual|, 90)
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Indicates that 90% of settlement intervals exhibited an absolute forecast deviation
              less than or equal to this threshold. Useful for setting reserve margins and balancing
              risk tolerances.
            </p>
          </Card>

          <Card
            title="Power (MW) vs Energy Volume (MWh)"
            subtitle="Settlement Duration: 30 Minutes (0.5 h)"
          >
            <div className="bg-zinc-100 dark:bg-zinc-800/80 p-2.5 rounded font-mono text-xs text-zinc-800 dark:text-zinc-200 mb-2">
              Energy Error (MWh) = Error (MW) * 0.5 hours
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              UK electricity settlement is conducted in half-hour settlement periods (SP 1 to 48).
              A persistent 200 MW forecast error across a single 30-minute interval represents a 100
              MWh imbalance volume.
            </p>
          </Card>
        </div>
      </div>

      {/* Temporal and Market Conventions */}
      <div className="space-y-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Temporal Cutoff & Market Selection Policy
        </h2>

        <Card>
          <div className="space-y-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            <div>
              <strong className="text-zinc-900 dark:text-zinc-100 block mb-1">
                1. The Day-Ahead Decision Cutoff (10:00 Europe/London)
              </strong>
              Day-ahead power trading on the EPEX SPOT and Nord Pool UK wholesale auctions closes at
              midday. Utility procurement teams execute position preparation and bidding models
              against forecast snapshots locked in advance (configured at 10:00 UK local time).
            </div>

            <div>
              <strong className="text-zinc-900 dark:text-zinc-100 block mb-1">
                2. Decision Date vs Delivery Date
              </strong>
              A procurement decision taken on <strong>January 1, 2026</strong> purchases physical
              electricity delivered during the 48 settlement periods of{' '}
              <strong>January 2, 2026</strong>.
            </div>

            <div>
              <strong className="text-zinc-900 dark:text-zinc-100 block mb-1">
                3. Historical Snapshot Selection vs Intraday Revisions
              </strong>
              Gridbricks strictly enforces the rule that no forecast published after the decision
              cutoff can be included in the official decision snapshot. Any later revisions shown in
              the Forecast Evolution screen are for post-decision analysis only and are explicitly
              labelled as excluded from the original decision.
            </div>

            <div>
              <strong className="text-zinc-900 dark:text-zinc-100 block mb-1">
                4. Missing Observations Policy
              </strong>
              Missing intervals (due to upstream telemetry or BMRS outage) are never treated as zero
              MW. Incomplete settlement days are marked with <code>MIXED_OR_PARTIAL</code> status,
              and statistics are computed strictly over valid matched observation pairs.
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
