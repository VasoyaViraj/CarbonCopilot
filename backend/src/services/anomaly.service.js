import { getEmissionSummary, REPORTING_CO2E_UNIT } from './emissionAnalytics.service.js';

export async function detectAnomaly(factory, { threshold = 20, baselineDays = 7 }) {
  // We need to compare the "current" intensity (most recent day) with the "baseline" (e.g. previous 7 days)
  
  const today = new Date();
  
  // Get summary for the last (baselineDays + 1) days to have both baseline and current
  const from = new Date(today);
  from.setUTCDate(today.getUTCDate() - baselineDays);

  const query = {
    from,
    to: today,
    granularity: 'day'
  };

  const summary = await getEmissionSummary(factory, query);
  
  // We can extract intensities if we group them by day. 
  // However, getEmissionSummary only returns overall intensity and daily co2e history.
  // Wait, the prompt says: "Emission Intensity = CO2e / production quantity".
  // Let's see if we can just get the overall intensity of the last 7 days vs today, or just use getEmissionSummary.
  // Actually getEmissionSummary aggregates everything. We'd need to fetch production and co2e for the current day separately, and baseline separately.
  
  const currentDay = new Date(today);
  const baselineFrom = new Date(today);
  baselineFrom.setUTCDate(today.getUTCDate() - baselineDays);
  const baselineTo = new Date(today);
  baselineTo.setUTCDate(today.getUTCDate() - 1);
  
  const currentSummary = await getEmissionSummary(factory, { from: currentDay, to: currentDay, granularity: 'day' });
  const baselineSummary = await getEmissionSummary(factory, { from: baselineFrom, to: baselineTo, granularity: 'day' });
  
  const currentIntensity = currentSummary.intensity.value || 0;
  const baselineIntensity = baselineSummary.intensity.value || 0;
  
  let deviation = 0;
  let status = 'NORMAL';
  let explanation = 'Emission intensity is within expected limits.';
  
  if (baselineIntensity > 0) {
    deviation = ((currentIntensity - baselineIntensity) / baselineIntensity) * 100;
  } else if (currentIntensity > 0) {
    deviation = 100; // if baseline is 0 but current is > 0
  }
  
  if (deviation > threshold) {
    status = 'ABNORMAL';
    explanation = 'Potential abnormal emission intensity detected. The current emission intensity significantly exceeds the historical baseline. This is a software-based investigation signal and not a physical leak detection result.';
  } else if (deviation < -threshold) {
    explanation = 'Emission intensity is significantly lower than baseline.';
  }
  
  return {
    currentIntensity,
    baselineIntensity,
    deviation,
    threshold,
    status,
    explanation,
    unit: currentSummary.intensity.unit || `${REPORTING_CO2E_UNIT}/unit`
  };
}
