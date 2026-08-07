import { DbFeatureVector } from '../database/queries';

export type PhaseLabel = 'stabil' | 'manik' | 'depresi' | 'gated';

export interface PhaseEpisode {
  id: string;
  phase: PhaseLabel;
  title: string;
  subtitle: string;
  windowName: string;
  startTime: string;
  endTime: string;
  epochCount: number;
  avgHrv: number;
  avgVocal: number;
}

function classifyVector(fv: DbFeatureVector): PhaseLabel {
  if (fv.circadian_valid === 1) return 'stabil';
  if (fv.suppressed_reason) return 'gated';

  const vocalZ = fv.vocal_zscore ?? 0;
  const imuZ = fv.imu_zscore ?? 0;

  if (vocalZ > 1.5 && imuZ > 1.0) return 'manik';
  if (vocalZ < -1.0 && imuZ < -0.5) return 'depresi';

  return 'stabil';
}

function formatDuration(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) return `${diffMins} menit`;
  const diffHours = Math.floor(diffMins / 60);
  const remainMins = diffMins % 60;
  if (remainMins === 0) return `${diffHours} jam`;
  return `${diffHours} jam ${remainMins} menit`;
}

function formatTimeRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const sameDay = startDate.toDateString() === endDate.toDateString();

  const startStr = startDate.toLocaleString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (sameDay) {
    const startTime = startDate.toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const endTime = endDate.toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `${startStr} · ${startTime}–${endTime}`;
  }

  const endStr = endDate.toLocaleString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${startStr} – ${endStr}`;
}

function buildTitle(phase: PhaseLabel, windowName: string): string {
  switch (phase) {
    case 'stabil':
      return `Fase Stabil (${windowName})`;
    case 'manik':
      return `Potensi Manik Ringan (${windowName})`;
    case 'depresi':
      return `Potensi Depresi (${windowName})`;
    case 'gated':
      return `Fase Stabil (Gated)`;
  }
}

export function buildEpisodes(vectors: DbFeatureVector[]): PhaseEpisode[] {
  if (vectors.length === 0) return [];

  const sorted = [...vectors].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const episodes: PhaseEpisode[] = [];
  let currentPhase = classifyVector(sorted[0]);
  let currentWindow = sorted[0].window_name;
  let currentEpochs: DbFeatureVector[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const fv = sorted[i];
    const phase = classifyVector(fv);
    const prevTime = new Date(sorted[i - 1].timestamp).getTime();
    const currTime = new Date(fv.timestamp).getTime();
    const gapMinutes = (currTime - prevTime) / 60000;

    const samePhase = phase === currentPhase;
    const closeInTime = gapMinutes <= 30;

    if (samePhase && closeInTime) {
      currentEpochs.push(fv);
    } else {
      episodes.push(buildEpisode(currentPhase, currentWindow, currentEpochs, episodes.length));
      currentPhase = phase;
      currentWindow = fv.window_name;
      currentEpochs = [fv];
    }
  }

  episodes.push(buildEpisode(currentPhase, currentWindow, currentEpochs, episodes.length));

  return episodes.reverse();
}

function buildEpisode(
  phase: PhaseLabel,
  windowName: string,
  epochs: DbFeatureVector[],
  index: number
): PhaseEpisode {
  const startTime = epochs[0].timestamp;
  const endTime = epochs[epochs.length - 1].timestamp;

  const avgHrv = epochs.reduce((sum, e) => sum + (e.hrv_rmssd ?? 0), 0) / epochs.length;
  const avgVocal = epochs.reduce((sum, e) => sum + (e.vocal_f0 ?? 0), 0) / epochs.length;

  const duration = formatDuration(startTime, endTime);
  const timeRange = formatTimeRange(startTime, endTime);

  return {
    id: `episode_${index}_${startTime}`,
    phase,
    title: buildTitle(phase, windowName),
    subtitle: epochs.length === 1
      ? `${timeRange} · HRV: ${avgHrv.toFixed(0)} ms · Vocal: ${avgVocal.toFixed(0)}`
      : `${timeRange} · ${duration} · ${epochs.length} epoch`,
    windowName,
    startTime,
    endTime,
    epochCount: epochs.length,
    avgHrv,
    avgVocal,
  };
}
