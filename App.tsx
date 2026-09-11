import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from 'expo-audio';
import type { RecordingItem } from './src/types';
import {
  addRecording,
  deleteRecording,
  loadRecordings,
  renameRecording,
} from './src/services/storage';
import { defaultRecordingName, formatDuration } from './src/utils/format';
import { RecordingRow } from './src/components/RecordingRow';

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'document' as const,
};

type PermissionState = 'checking' | 'granted' | 'denied';

export default function App() {
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(audioRecorder, 200);

  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);

  const [permission, setPermission] = useState<PermissionState>('checking');
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<RecordingItem | null>(null);
  const [renameText, setRenameText] = useState('');

  const wasPlayingRef = useRef(false);
  const currentUriRef = useRef<string | null>(null);

  const refreshList = useCallback(async () => {
    const items = await loadRecordings();
    setRecordings(items);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const existing = await getRecordingPermissionsAsync();
        if (existing.granted) {
          if (!cancelled) setPermission('granted');
        } else {
          const requested = await requestRecordingPermissionsAsync();
          if (!cancelled) {
            setPermission(requested.granted ? 'granted' : 'denied');
          }
        }

        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
          interruptionMode: 'doNotMix',
        });

        await refreshList();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to initialize audio');
          setPermission('denied');
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshList]);

  // Clear playing highlight when track finishes
  useEffect(() => {
    if (wasPlayingRef.current && !playerStatus.playing && playerStatus.didJustFinish) {
      setPlayingId(null);
    }
    wasPlayingRef.current = playerStatus.playing;
  }, [playerStatus.playing, playerStatus.didJustFinish]);

  const liveDurationMillis = useMemo(() => {
    return recorderState.durationMillis ?? 0;
  }, [recorderState.durationMillis]);

  const startRecording = async () => {
    if (permission !== 'granted') {
      Alert.alert(
        'Microphone permission needed',
        'Please allow microphone access to record voice notes.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    setError(null);
    setBusy(true);
    try {
      if (playerStatus.playing) {
        player.pause();
        setPlayingId(null);
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        interruptionMode: 'doNotMix',
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start recording');
    } finally {
      setBusy(false);
    }
  };

  const stopRecording = async () => {
    setBusy(true);
    setError(null);
    try {
      const durationMillis = recorderState.durationMillis ?? 0;
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (!uri) {
        throw new Error('Recording finished but no file was created');
      }

      const now = new Date();
      const item: RecordingItem = {
        id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
        name: defaultRecordingName(now),
        uri,
        durationMillis,
        createdAt: now.toISOString(),
      };

      const next = await addRecording(item);
      setRecordings(next);

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        interruptionMode: 'doNotMix',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save recording');
    } finally {
      setBusy(false);
    }
  };

  const handleStopPlayback = () => {
    try {
      player.pause();
    } catch {
      // ignore
    }
    setPlayingId(null);
  };

  const handlePlay = async (item: RecordingItem) => {
    setError(null);
    try {
      if (playingId === item.id && playerStatus.playing) {
        handleStopPlayback();
        return;
      }

      setPlayingId(item.id);

      if (currentUriRef.current === item.uri) {
        await player.seekTo(0);
        player.play();
        return;
      }

      player.replace({ uri: item.uri });
      currentUriRef.current = item.uri;
      player.play();
    } catch (e) {
      setPlayingId(null);
      setError(e instanceof Error ? e.message : 'Playback failed');
    }
  };

  const handleDelete = (item: RecordingItem) => {
    Alert.alert('Delete recording', `Delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (playingId === item.id) {
              handleStopPlayback();
              currentUriRef.current = null;
            }
            const next = await deleteRecording(item.id);
            setRecordings(next);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Delete failed');
          }
        },
      },
    ]);
  };

  const openRename = (item: RecordingItem) => {
    setRenameTarget(item);
    setRenameText(item.name);
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    try {
      const next = await renameRecording(renameTarget.id, renameText);
      setRecordings(next);
      setRenameTarget(null);
      setRenameText('');
    } catch (e) {
      Alert.alert('Rename failed', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const isRecording = recorderState.isRecording;

  if (permission === 'checking' || loadingList) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Preparing Voice Recorder…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <Text style={styles.title}>Voice Recorder</Text>
        <Text style={styles.subtitle}>Record, save, and play voice notes</Text>

        {permission === 'denied' && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Microphone permission is required. Enable it in system settings to record.
            </Text>
            <Pressable style={styles.bannerBtn} onPress={() => Linking.openSettings()}>
              <Text style={styles.bannerBtnText}>Open Settings</Text>
            </Pressable>
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.recorderCard}>
          <View style={[styles.pulseDot, isRecording && styles.pulseDotActive]} />
          <Text style={styles.timer}>{formatDuration(liveDurationMillis)}</Text>
          <Text style={styles.recorderHint}>
            {isRecording ? 'Recording…' : 'Tap Record to start'}
          </Text>

          <Pressable
            style={[
              styles.recordBtn,
              isRecording ? styles.recordBtnStop : styles.recordBtnStart,
              (busy || permission !== 'granted') && styles.recordBtnDisabled,
            ]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={busy || permission !== 'granted'}
            accessibilityRole="button"
            accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.recordBtnText}>{isRecording ? 'Stop' : 'Record'}</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>
          Recordings{recordings.length ? ` (${recordings.length})` : ''}
        </Text>

        {recordings.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No recordings yet</Text>
            <Text style={styles.emptyBody}>
              Your saved voice notes will appear here with name, duration, and date.
            </Text>
          </View>
        ) : (
          <FlatList
            data={recordings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <RecordingRow
                item={item}
                isPlaying={playingId === item.id && playerStatus.playing}
                isLoading={
                  playingId === item.id && !playerStatus.isLoaded && !playerStatus.playing
                }
                onPlay={() => handlePlay(item)}
                onStop={handleStopPlayback}
                onDelete={() => handleDelete(item)}
                onRename={() => openRename(item)}
              />
            )}
          />
        )}
      </View>

      {renameTarget ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename</Text>
            <TextInput
              style={styles.input}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Recording name"
              placeholderTextColor="#6B7280"
              autoFocus
              maxLength={80}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setRenameTarget(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalSave]}
                onPress={submitRename}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0F14',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#9AA3B2',
    fontSize: 15,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#8B95A8',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  banner: {
    backgroundColor: '#3A1D1D',
    borderColor: '#7F1D1D',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  bannerText: {
    color: '#FECACA',
    fontSize: 13,
    marginBottom: 8,
  },
  bannerBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bannerBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: '#2A1520',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
  },
  recorderCard: {
    backgroundColor: '#141A22',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#243041',
    marginBottom: 20,
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#374151',
    marginBottom: 12,
  },
  pulseDotActive: {
    backgroundColor: '#EF4444',
  },
  timer: {
    color: '#F8FAFC',
    fontSize: 48,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  recorderHint: {
    color: '#8B95A8',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 22,
  },
  recordBtn: {
    minWidth: 160,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
    alignItems: 'center',
  },
  recordBtnStart: {
    backgroundColor: '#EF4444',
  },
  recordBtnStop: {
    backgroundColor: '#6366F1',
  },
  recordBtnDisabled: {
    opacity: 0.45,
  },
  recordBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#E2E8F0',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 10,
  },
  listContent: {
    paddingBottom: 32,
  },
  empty: {
    backgroundColor: '#141A22',
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: '#243041',
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyBody: {
    color: '#8B95A8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1A2030',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A3140',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#0F141C',
    borderWidth: 1,
    borderColor: '#2A3140',
    borderRadius: 10,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3A4356',
  },
  modalSave: {
    backgroundColor: '#3B82F6',
  },
  modalCancelText: {
    color: '#C5CDD9',
    fontWeight: '600',
  },
  modalSaveText: {
    color: '#fff',
    fontWeight: '700',
  },
});
