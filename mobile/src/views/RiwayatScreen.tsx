import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, Linking, Modal, FlatList } from 'react-native';
import { DbFeatureVector } from '../database/queries';
import { EDU_ARTICLES, EduArticle } from '../data/educationContent';
import { buildEpisodes, PhaseEpisode } from '../circadian/phaseClassifier';
import { styles } from '../constants/theme';

interface RiwayatScreenProps {
  historicalVectors: DbFeatureVector[];
}

function getIconStyle(phase: string) {
  switch (phase) {
    case 'manik': return styles.riwayatIconManik;
    case 'depresi': return styles.riwayatIconDepresi;
    default: return styles.riwayatIconStabil;
  }
}

function getIconChar(phase: string): string {
  switch (phase) {
    case 'manik': return '⚠';
    case 'depresi': return '☹';
    case 'gated': return '🛡';
    default: return '✓';
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

export const RiwayatScreen: React.FC<RiwayatScreenProps> = ({ historicalVectors }) => {
  const [selectedArticle, setSelectedArticle] = useState<EduArticle | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<PhaseEpisode | null>(null);
  const [selectedEpoch, setSelectedEpoch] = useState<DbFeatureVector | null>(null);

  const episodes = useMemo(() => buildEpisodes(historicalVectors), [historicalVectors]);

  return (
    <View style={styles.riwayatContainer}>
      <Text style={styles.riwayatTitle}>Riwayat Deteksi</Text>
      <Text style={styles.riwayatSubtitle}>Semua Catatan Fase</Text>

      {episodes.length > 0 ? (
        episodes.map((episode) => (
          <TouchableOpacity
            key={episode.id}
            style={styles.riwayatCard}
            onPress={() => setSelectedEpisode(episode)}
            activeOpacity={0.7}
          >
            <View style={[styles.riwayatIcon, getIconStyle(episode.phase)]}>
              <Text style={styles.riwayatIconText}>{getIconChar(episode.phase)}</Text>
            </View>
            <View style={styles.riwayatCardText}>
              <Text style={styles.riwayatCardTitle}>{episode.title}</Text>
              <Text style={styles.riwayatCardSub}>{episode.subtitle}</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#9B8CB0', marginLeft: 8 }}>{'›'}</Text>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.riwayatCard}>
          <View style={[styles.riwayatIcon, styles.riwayatIconStabil]}>
            <Text style={styles.riwayatIconText}>—</Text>
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

      {selectedArticle === null ? (
        <View style={styles.eduSection}>
          <Text style={styles.eduSectionTitle}>Artikel Edukasi</Text>
          <Text style={styles.eduSectionSubtitle}>Pelajari lebih lanjut tentang fase bipolar</Text>

          {EDU_ARTICLES.map((article) => (
            <TouchableOpacity
              key={article.id}
              style={styles.eduCard}
              onPress={() => setSelectedArticle(article)}
              activeOpacity={0.88}
            >
              <Image
                source={article.thumbnail}
                style={styles.eduThumbnail}
                resizeMode="cover"
              />
                <View style={styles.eduCardBody}>
                <Text style={styles.eduCardTitle} numberOfLines={2}>{article.title}</Text>
                <Text style={styles.eduCardExcerpt} numberOfLines={3}>{article.excerpt}</Text>
                <View style={styles.eduCardSource}>
                  <Text style={styles.eduSourceName}>{article.sourceName}</Text>
                  <TouchableOpacity onPress={() => Linking.openURL(article.sourceUrl)}>
                    <Text style={styles.eduSourceUrl} numberOfLines={1}>{article.sourceUrl}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.eduDetail}>
          <TouchableOpacity
            style={styles.eduDetailBack}
            onPress={() => setSelectedArticle(null)}
          >
            <Text style={styles.eduDetailBackText}>← Kembali</Text>
          </TouchableOpacity>

          <Image
            source={selectedArticle.thumbnail}
            style={styles.eduDetailThumbnail}
            resizeMode="cover"
          />

          <View style={styles.eduDetailBody}>
            <Text style={styles.eduDetailTitle}>{selectedArticle.title}</Text>

            <View style={styles.eduDetailSourceRow}>
              <Text style={styles.eduDetailSourceName}>{selectedArticle.sourceName}</Text>
            </View>

            <Text style={styles.eduDetailContent}>{selectedArticle.content}</Text>

            <View style={styles.eduDetailUrlRow}>
              <Text style={styles.eduDetailUrlLabel}>Sumber: </Text>
              <TouchableOpacity onPress={() => Linking.openURL(selectedArticle.sourceUrl)}>
                <Text style={styles.eduDetailUrl} numberOfLines={2}>{selectedArticle.sourceUrl}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};
