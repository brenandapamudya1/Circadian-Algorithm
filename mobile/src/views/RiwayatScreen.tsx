import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView } from 'react-native';
import { DbFeatureVector } from '../database/queries';
import { EDU_ARTICLES, EduArticle } from '../data/educationContent';
import { styles } from '../constants/theme';

interface RiwayatScreenProps {
  historicalVectors: DbFeatureVector[];
}

const FALLBACK_HISTORY = [
  { title: 'Fase Stabil', sub: 'Hari ini · berlangsung 18 jam', icon: '✓', iconStyle: 'stabil' as const },
  { title: 'Potensi Manik Ringan', sub: 'Kam, 19 Jun · 6 jam', icon: '⚠', iconStyle: 'manik' as const },
  { title: 'Fase Stabil', sub: 'Sel–Rab, 10–18 Jun · 8 hari', icon: '✓', iconStyle: 'stabil' as const },
  { title: 'Potensi Depresi', sub: 'Sen, 09 Jun · 1 hari', icon: '☹', iconStyle: 'depresi' as const },
];

export const RiwayatScreen: React.FC<RiwayatScreenProps> = ({ historicalVectors }) => {
  const [selectedArticle, setSelectedArticle] = useState<EduArticle | null>(null);

  return (
    <View style={styles.riwayatContainer}>
      <Text style={styles.riwayatTitle}>Riwayat Deteksi</Text>
      <Text style={styles.riwayatSubtitle}>Semua Catatan Fase</Text>

      {historicalVectors.length > 0 ? (
        historicalVectors.map((fv) => (
          <View key={fv.epoch_id} style={styles.riwayatCard}>
            <View style={[
              styles.riwayatIcon,
              fv.circadian_valid === 1 ? styles.riwayatIconStabil : styles.riwayatIconManik,
            ]}>
              <Text style={styles.riwayatIconText}>
                {fv.circadian_valid === 1 ? '✓' : '⚠'}
              </Text>
            </View>
            <View style={styles.riwayatCardText}>
              <Text style={styles.riwayatCardTitle}>
                {fv.circadian_valid === 1
                  ? `Fase Stabil (${fv.window_name})`
                  : fv.suppressed_reason
                    ? `Fase Stabil (Gated: ${fv.suppressed_reason})`
                    : `Potensi Relaps/Anomali (${fv.window_name})`}
              </Text>
              <Text style={styles.riwayatCardSub}>
                {new Date(fv.timestamp).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })} · HRV: {fv.hrv_rmssd?.toFixed(0)} ms · Vocal: {fv.vocal_f0?.toFixed(0)}
              </Text>
            </View>
          </View>
        ))
      ) : (
        FALLBACK_HISTORY.map((item, idx) => (
          <View key={idx} style={styles.riwayatCard}>
            <View style={[
              styles.riwayatIcon,
              item.iconStyle === 'stabil' ? styles.riwayatIconStabil
                : item.iconStyle === 'manik' ? styles.riwayatIconManik
                : styles.riwayatIconDepresi,
            ]}>
              <Text style={styles.riwayatIconText}>{item.icon}</Text>
            </View>
            <View style={styles.riwayatCardText}>
              <Text style={styles.riwayatCardTitle}>{item.title}</Text>
              <Text style={styles.riwayatCardSub}>{item.sub}</Text>
            </View>
          </View>
        ))
      )}

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
                  <Text style={styles.eduSourceUrl} numberOfLines={1}>{article.sourceUrl}</Text>
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
              <Text style={styles.eduDetailUrl} numberOfLines={2}>{selectedArticle.sourceUrl}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};
