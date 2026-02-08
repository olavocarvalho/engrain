/**
 * Test helpers for engrain-tapi
 */

export function createMockAnalyticsEngine() {
  const dataPoints: Array<{
    indexes: [string];
    blobs: string[];
    doubles: number[];
  }> = [];

  return {
    writeDataPoint: (dp: {
      indexes: [string];
      blobs: string[];
      doubles: number[];
    }) => {
      dataPoints.push(dp);
    },
    getDataPoints: () => dataPoints,
    clear: () => {
      dataPoints.length = 0;
    },
  };
}

export type MockAnalyticsEngine = ReturnType<typeof createMockAnalyticsEngine>;
