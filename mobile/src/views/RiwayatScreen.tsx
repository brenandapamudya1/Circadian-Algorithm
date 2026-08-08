import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, Linking } from 'react-native';
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

export const RiwayatScreen: React.FC<RiwayatScreenProps> = ({ historicalVectors }) => {
  const [selectedArticle, setSelectedArticle] = useState<EduArticle | null>(null);

  const episodes = useMemo(() => buildEpisodes(historicalVectors), [historicalVectors]);

  return (
    <View style={styles.riwayatContainer}>
      <Text style={styles.riwayatTitle}>Riwayat Deteksi</Text>
      <Text style={styles.riwayatSubtitle}>Semua Catatan Fase</Text>

      {episodes.length > 0 ? (
        episodes.map((episode) => (
          <View key={episode.id} style={styles.riwayatCard}>
            <View style={[styles.riwayatIcon, getIconStyle(episode.phase)]}>
              <Text style={styles.riwayatIconText}>{getIconChar(episode.phase)}</Text>
            </View>
            <View style={styles.riwayatCardText}>
              <Text style={styles.riwayatCardTitle}>{episode.title}</Text>
              <Text style={styles.riwayatCardSub}>{episode.subtitle}</Text>
            </View>
          </View>
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
