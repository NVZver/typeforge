'use client';

import clsx from 'clsx';

interface KeyboardHeatmapProps {
  keyTimes: Record<string, number[]>;  // key -> array of times in ms
}

// Workman keyboard layout
const WORKMAN_LAYOUT = [
  ['q', 'd', 'r', 'w', 'b', 'j', 'f', 'u', 'p', ';'],
  ['a', 's', 'h', 't', 'g', 'y', 'n', 'e', 'o', 'i'],
  ['z', 'x', 'm', 'c', 'v', 'k', 'l', ',', '.', '/'],
];

export function KeyboardHeatmap({ keyTimes }: KeyboardHeatmapProps) {
  // Calculate average time for each key
  const keyAvgTimes: Record<string, number> = {};
  let maxAvg = 0;
  let minAvg = Infinity;

  for (const [key, times] of Object.entries(keyTimes)) {
    if (times.length > 0) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      keyAvgTimes[key.toLowerCase()] = avg;
      maxAvg = Math.max(maxAvg, avg);
      minAvg = Math.min(minAvg, avg);
    }
  }

  // If no data or all same, set defaults
  if (minAvg === Infinity) minAvg = 0;
  if (maxAvg === minAvg) maxAvg = minAvg + 100;

  // Get heat level (0-4) based on timing - higher = slower = more heat
  const getHeatLevel = (key: string): number => {
    const avg = keyAvgTimes[key.toLowerCase()];
    if (avg === undefined) return -1; // No data

    const range = maxAvg - minAvg;
    const normalized = (avg - minAvg) / range;

    // 0 = fastest (green), 4 = slowest (red)
    return Math.min(4, Math.floor(normalized * 5));
  };

  // Find the slowest keys for highlighting
  const sortedKeys = Object.entries(keyAvgTimes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => key);

  return (
    <div className="keyboard-heatmap">
      <div className="keyboard-title">Session Performance (Workman Layout)</div>
      <div className="keyboard">
        {WORKMAN_LAYOUT.map((row, rowIndex) => (
          <div key={rowIndex} className="keyboard-row">
            {row.map((key) => {
              const heatLevel = getHeatLevel(key);
              const isWeakest = sortedKeys.includes(key.toLowerCase());
              const hasData = heatLevel >= 0;

              return (
                <div
                  key={key}
                  className={clsx(
                    'keyboard-key',
                    hasData && `heat-${heatLevel}`,
                    !hasData && 'no-data',
                    isWeakest && 'weakest'
                  )}
                  title={hasData
                    ? `${key}: ${Math.round(keyAvgTimes[key.toLowerCase()])}ms avg`
                    : `${key}: no data`
                  }
                >
                  {key.toUpperCase()}
                </div>
              );
            })}
          </div>
        ))}
        <div className="keyboard-row spacebar-row">
          <div className="keyboard-key spacebar no-data">Space</div>
        </div>
      </div>
      <div className="heatmap-legend">
        <span className="legend-label">Fast</span>
        <div className="legend-scale">
          <div className="legend-block heat-0"></div>
          <div className="legend-block heat-1"></div>
          <div className="legend-block heat-2"></div>
          <div className="legend-block heat-3"></div>
          <div className="legend-block heat-4"></div>
        </div>
        <span className="legend-label">Slow</span>
      </div>
    </div>
  );
}
