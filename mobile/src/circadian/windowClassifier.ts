// ── CONFIGURATIONS (Sesuai dengan config/circadian_windows.yaml) ─────────────
export interface TimeRange {
  start: string; // "HH:MM:SS"
  end: string;   // "HH:MM:SS"
  description: string;
}

export const DEFAULT_CIRCADIAN_WINDOWS: Record<string, TimeRange> = {
  NOCTURNAL: {
    start: '00:00:00',
    end: '05:59:59',
    description: 'baseline tidur, parasimpatis dominan',
  },
  MORNING: {
    start: '06:00:00',
    end: '11:59:59',
    description: 'aktivasi simpatis, pitch naik natural',
  },
  AFTERNOON: {
    start: '12:00:00',
    end: '16:59:59',
    description: 'aktivitas puncak, HRV bervariasi tinggi',
  },
  EVENING: {
    start: '17:00:00',
    end: '21:59:59',
    description: 'transisi, penurunan pitch natural',
  },
  'PRE-SLEEP': {
    start: '22:00:00',
    end: '23:59:59',
    description: 'wind-down, HRV mulai naik',
  },
};

/**
 * Konversi string waktu "HH:MM:SS" menjadi menit sejak tengah malam.
 */
function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  const seconds = parseInt(parts[2] || '0', 10);
  return hours * 60 + minutes + seconds / 60;
}

/**
 * Memetakan timestamp ISO 8601 (UTC atau Local) ke Biological Window pengguna
 * berdasarkan konfigurasi jam biologis.
 * 
 * @param timestamp ISO 8601 string (contoh: "2026-07-01T08:30:00Z")
 * @param windows Konfigurasi range jendela biologis (opsional, fallback ke default)
 * @returns Nama window ("MORNING", "AFTERNOON", "EVENING", "PRE-SLEEP", "NOCTURNAL", atau "UNKNOWN")
 */
export function getBiologicalWindow(
  timestamp: string,
  windows: Record<string, TimeRange> = DEFAULT_CIRCADIAN_WINDOWS
): string {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      console.warn('[Classifier] Timestamp tidak valid:', timestamp);
      return 'UNKNOWN';
    }

    // Mendapatkan jam, menit, dan detik dalam waktu lokal pengguna
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    
    const localMinutes = hours * 60 + minutes + seconds / 60;

    for (const [windowName, range] of Object.entries(windows)) {
      const startMin = timeToMinutes(range.start);
      const endMin = timeToMinutes(range.end);

      // Handle window yang menyeberang tengah malam (jika ada di masa depan)
      if (startMin <= endMin) {
        if (localMinutes >= startMin && localMinutes <= endMin) {
          return windowName;
        }
      } else {
        // Melintasi tengah malam, contoh: 22:00:00 s.d 05:00:00
        if (localMinutes >= startMin || localMinutes <= endMin) {
          return windowName;
        }
      }
    }
  } catch (error) {
    console.error('[Classifier] Gagal melakukan klasifikasi window:', error);
  }

  return 'UNKNOWN';
}
