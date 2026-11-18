export function getMetric(
  clubState,
  metricId
) {
  return (
    clubState.metrics[
      metricId
    ] ?? 0
  );
}

export function setMetric(
  clubState,
  metricId,
  value
) {
  return {
    ...clubState,

    metrics: {
      ...clubState.metrics,

      value
    }
  };
}

export function adjustMetric(
  clubState,
  metricId,
  amount
) {
  const current =
    clubState.metrics[
      metricId
    ] ?? 0;

  const updated =
    Math.max(
      0,
      Math.min(
        100,
        current + amount
      )
    );

  return {
    ...clubState,

    metrics: {
      ...clubState.metrics,

      [metricId]: updated
    }
  };
}