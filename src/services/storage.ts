import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { RecordingItem } from '../types';

const STORAGE_KEY = '@voice_recorder/recordings_v1';

export async function loadRecordings(): Promise<RecordingItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecordingItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

async function saveAll(items: RecordingItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function addRecording(item: RecordingItem): Promise<RecordingItem[]> {
  const current = await loadRecordings();
  const next = [item, ...current];
  await saveAll(next);
  return next;
}

export async function deleteRecording(id: string): Promise<RecordingItem[]> {
  const current = await loadRecordings();
  const target = current.find((r) => r.id === id);
  const next = current.filter((r) => r.id !== id);

  if (target?.uri) {
    try {
      await FileSystem.deleteAsync(target.uri, { idempotent: true });
    } catch {
      // File may already be gone; still drop metadata.
    }
  }

  await saveAll(next);
  return next;
}

export async function renameRecording(
  id: string,
  name: string
): Promise<RecordingItem[]> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Name cannot be empty');
  }
  const current = await loadRecordings();
  const next = current.map((r) => (r.id === id ? { ...r, name: trimmed } : r));
  await saveAll(next);
  return next;
}
