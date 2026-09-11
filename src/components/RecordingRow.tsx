import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import type { RecordingItem } from '../types';
import { formatDate, formatDuration } from '../utils/format';

type Props = {
  item: RecordingItem;
  isPlaying: boolean;
  isLoading: boolean;
  onPlay: () => void;
  onStop: () => void;
  onDelete: () => void;
  onRename: () => void;
};

export function RecordingRow({
  item,
  isPlaying,
  isLoading,
  onPlay,
  onStop,
  onDelete,
  onRename,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.meta}>
          {formatDuration(item.durationMillis)} · {formatDate(item.createdAt)}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, isPlaying ? styles.btnStop : styles.btnPlay]}
          onPress={isPlaying ? onStop : onPlay}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Stop playback' : 'Play recording'}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnText}>{isPlaying ? 'Stop' : 'Play'}</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.btn, styles.btnGhost]}
          onPress={onRename}
          accessibilityRole="button"
          accessibilityLabel="Rename recording"
        >
          <Text style={styles.btnGhostText}>Rename</Text>
        </Pressable>

        <Pressable
          style={[styles.btn, styles.btnDanger]}
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel="Delete recording"
        >
          <Text style={styles.btnText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E2430',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A3140',
  },
  info: {
    marginBottom: 12,
  },
  name: {
    color: '#F2F4F8',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  meta: {
    color: '#9AA3B2',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPlay: {
    backgroundColor: '#3B82F6',
  },
  btnStop: {
    backgroundColor: '#6366F1',
  },
  btnDanger: {
    backgroundColor: '#DC2626',
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3A4356',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  btnGhostText: {
    color: '#C5CDD9',
    fontWeight: '600',
    fontSize: 13,
  },
});
