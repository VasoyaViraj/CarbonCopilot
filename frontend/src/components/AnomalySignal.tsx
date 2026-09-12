import { AlertTriangle, Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { AnomalySignal as AnomalySignalType } from "@/services/anomalyService"

type AnomalySignalProps = {
  signal: AnomalySignalType | null
  isLoading: boolean
  error: string | null
}

export default function AnomalySignal({ signal, isLoading, error }: AnomalySignalProps) {
  if (isLoading) {
    return (
      <Alert className="animate-pulse">
        <Info className="size-4" />
        <AlertTitle>Checking for anomalies...</AlertTitle>
        <AlertDescription>Analyzing recent emission intensity against historical baseline.</AlertDescription>
      </Alert>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!signal) {
    return null
  }

  const isAbnormal = signal.status === "ABNORMAL"

  return (
    <Alert variant={isAbnormal ? "destructive" : "default"} className={isAbnormal ? "border-destructive text-destructive" : "text-muted-foreground"}>
      {isAbnormal ? <AlertTriangle className="size-4 text-destructive" /> : <Info className="size-4 text-muted-foreground" />}
      <AlertTitle>{isAbnormal ? "Potential abnormal emission intensity detected" : "Emission intensity normal"}</AlertTitle>
      <AlertDescription className="mt-2 text-sm leading-relaxed">
        <p>{signal.explanation}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>
            <span className="block font-medium opacity-75">Current</span>
            <span>{signal.currentIntensity.toFixed(2)} {signal.unit}</span>
          </div>
          <div>
            <span className="block font-medium opacity-75">Baseline (7d)</span>
            <span>{signal.baselineIntensity.toFixed(2)} {signal.unit}</span>
          </div>
          <div>
            <span className="block font-medium opacity-75">Deviation</span>
            <span>{signal.deviation > 0 ? "+" : ""}{signal.deviation.toFixed(1)}%</span>
          </div>
          <div>
            <span className="block font-medium opacity-75">Threshold</span>
            <span>±{signal.threshold}%</span>
          </div>
        </div>
        <p className="mt-3 text-xs italic opacity-75">
          Note: This is a software-based investigation signal and not a certified physical leak detection result.
        </p>
      </AlertDescription>
    </Alert>
  )
}
