import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';
import { TriangleAlert, Frown, Shield, CircleCheck, Minus } from 'lucide-react-native';
import { DbFeatureVector } from '../database/queries';
import { buildEpisodes, PhaseEpisode } from '../circadian/phaseClassifier';
import { styles } from '../constants/theme';

interface DetectionHistoryProps {
  historicalVectors: DbFeatureVector[];
}

function getIconStyle(phase: string) {
  switch (phase) {
    case 'manik': return styles.riwayatIconManik;
    case 'depresi': return styles.riwayatIconDepresi;
    default: return styles.riwayatIconStabil;
  }
}

function getPhaseIcon(phase: string): { Icon: React.ComponentType<any>; color: string } {
  switch (phase) {
    case 'manik': return { Icon: TriangleAlert, color: '#E8A838' };
    case 'depresi': return { Icon: Frown, color: '#E06060' };
    case 'gated': return { Icon: Shield, color: '#0288D1' };
    default: return { Icon: CircleCheck, color: '#6BBF8A' };
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function EpochDetailTable({ epoch }: { epoch: DbFeatureVector }) {
  const phase = epoch.circadian_valid === 1 ? 'Stabil'
    : epoch.suppressed_reason ? 'Gated'
    : (epoch.vocal_zscore ?? 0) > 1.5 && (epoch.imu_zscore ?? 0) > 1.0 ? 'Manik'
    : (epoch.vocal_zscore ?? 0) < -1.0 && (epoch.imu_zscore ?? 0) < -0.5 ? 'Depresi'
    : 'Stabil';

  const rows: { label: string; value: string }[] = [
    { label: 'Epoch ID', value: epoch.epoch_id?.length > 20 ? epoch.epoch_id.slice(0, 20) + '...' : (epoch.epoch_id || '-') },
    { label: 'Timestamp', value: formatDate(epoch.timestamp) },
    { label: 'Window', value: epoch.window_name || '-' },
    { label: 'HRV (RMSSD)', value: epoch.hrv_rmssd != null ? `${epoch.hrv_rmssd.toFixed(1)} ms` : '-' },
    { label: 'HRV Z-Score', value: epoch.hrv_zscore != null ? epoch.hrv_zscore.toFixed(2) : '-' },
    { label: 'Vocal F0', value: epoch.vocal_f0 != null ? `${epoch.vocal_f0.toFixed(0)} Hz` : '-' },
    { label: 'Vocal Z-Score', value: epoch.vocal_zscore != null ? epoch.vocal_zscore.toFixed(2) : '-' },
    { label: 'IMU Dwell', value: epoch.imu_dwell_min != null ? `${epoch.imu_dwell_min.toFixed(1)} min` : '-' },
    { label: 'IMU Z-Score', value: epoch.imu_zscore != null ? epoch.imu_zscore.toFixed(2) : '-' },
    { label: 'Circadian Valid', value: epoch.circadian_valid === 1 ? 'Ya' : 'Tidak' },
    { label: 'Suppressed', value: epoch.suppressed_reason || '-' },
    { label: 'Phase', value: phase },
  ];

  return (
    <View style={styles.epochModalTable}>
      {rows.map((row, i) => (
        <View key={row.label} style={[styles.epochModalTableRow, i % 2 === 1 && styles.epochModalTableRowAlt]}>
          <Text style={styles.epochModalTableLabel}>{row.label}</Text>
          <Text style={styles.epochModalTableValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

export const DetectionHistory: React.FC<DetectionHistoryProps> = ({ historicalVectors }) => {
  const [selectedEpisode, setSelectedEpisode] = useState<PhaseEpisode | null>(null);
  const [selectedEpoch, setSelectedEpoch] = useState<DbFeatureVector | null>(null);
  const [showAll, setShowAll] = useState(false);

  const episodes = useMemo(() => buildEpisodes(historicalVectors), [historicalVectors]);
  const visibleEpisodes = showAll ? episodes : episodes.slice(0, 3);
  const hasMore = episodes.length > 3;

  return (
    <View style={styles.trenRiwayatSection}>
      <View style={styles.trenRiwayatHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.trenRiwayatTitle}>Riwayat Deteksi</Text>
          <Text style={styles.trenRiwayatSubtitle}>Semua Catatan Fase</Text>
        </View>
        {hasMore && !showAll && (
          <TouchableOpacity onPress={() => setShowAll(true)} style={styles.trenLihatSemuaBtn}>
            <Text style={styles.trenLihatSemuaText}>Lihat Semua</Text>
          </TouchableOpacity>
        )}
      </View>

      {episodes.length > 0 ? (
        <>
          {visibleEpisodes.map((episode) => {
            const { Icon, color } = getPhaseIcon(episode.phase);
            return (
              <TouchableOpacity
                key={episode.id}
                style={styles.trenRiwayatCard}
                onPress={() => setSelectedEpisode(episode)}
                activeOpacity={0.7}
              >
                <View style={[styles.riwayatIcon, getIconStyle(episode.phase)]}>
                  <Icon color={color} size={20} strokeWidth={2} />
                </View>
              <View style={styles.riwayatCardText}>
                <Text style={styles.riwayatCardTitle}>{episode.title}</Text>
                <Text style={styles.riwayatCardSub}>{episode.subtitle}</Text>
              </View>
              <Text style={{ fontSize: 18, color: '#9B8CB0', marginLeft: 8 }}>{'›'}</Text>
              </TouchableOpacity>
            );
          })}

          {hasMore && (
            <TouchableOpacity
              style={styles.trenLihatSemuaBtnFull}
              onPress={() => setShowAll(!showAll)}
              activeOpacity={0.7}
            >
              <Text style={styles.trenLihatSemuaText}>
                {showAll ? 'Sembunyikan' : `Lihat Semua (${episodes.length})`}
              </Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <View style={styles.trenRiwayatCard}>
          <View style={[styles.riwayatIcon, styles.riwayatIconStabil]}>
            <Minus color="#9B8CB0" size={18} strokeWidth={2} />
          </View>
          <View style={styles.riwayatCardText}>
            <Text style={styles.riwayatCardTitle}>Belum Ada Riwayat</Text>
            <Text style={styles.riwayatCardSub}>Hubungkan gelang untuk memulai deteksi sirkadian</Text>
          </View>
        </View>
      )}

      {/* Episode Detail Modal */}
      <Modal
        visible={selectedEpisode !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedEpisode(null)}
      >
        <View style={styles.epochModalOverlay}>
          <View style={styles.epochModalContent}>
            <View style={styles.epochModalHeader}>
              <TouchableOpacity
                style={styles.epochModalBack}
                onPress={() => setSelectedEpisode(null)}
              >
                <Text style={styles.epochModalBackText}>Tutup</Text>
              </TouchableOpacity>
              <Text style={styles.epochModalTitle} numberOfLines={1}>
                {selectedEpisode?.title}
              </Text>
              <View style={styles.epochModalSpacer} />
            </View>
            <Text style={styles.epochModalSectionHeader}>
              {selectedEpisode?.epochCount} Epoch
            </Text>
            <FlatList
              data={selectedEpisode?.epochs ?? []}
              keyExtractor={(item) => item.epoch_id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.epochListItem}
                  onPress={() => setSelectedEpoch(item)}
                  activeOpacity={0.6}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.epochListItemTime}>{formatDate(item.timestamp)}</Text>
                      <Text style={styles.epochListItemSub}>
                        Window: {item.window_name} · HRV: {item.hrv_rmssd?.toFixed(0) ?? '-'} ms · Vocal: {item.vocal_f0?.toFixed(0) ?? '-'}
                      </Text>
                    </View>
                    <Text style={styles.epochListItemArrow}>{'›'}</Text>
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>
        </View>
      </Modal>

      {/* Epoch Detail Modal */}
      <Modal
        visible={selectedEpoch !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedEpoch(null)}
      >
        <View style={styles.epochModalOverlay}>
          <View style={styles.epochModalContent}>
            <View style={styles.epochModalHeader}>
              <TouchableOpacity
                style={styles.epochModalBack}
                onPress={() => setSelectedEpoch(null)}
              >
                <Text style={styles.epochModalBackText}>← Kembali</Text>
              </TouchableOpacity>
              <Text style={styles.epochModalTitle}>Detail Epoch</Text>
              <View style={styles.epochModalSpacer} />
            </View>
            <FlatList
              data={[{ key: 'table' }]}
              renderItem={() => selectedEpoch ? <EpochDetailTable epoch={selectedEpoch} /> : null}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};
