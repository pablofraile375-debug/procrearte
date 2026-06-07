import type { HistoryEntry } from '../types/app';

type Request = { type: 'snapshot'; label: string; rect: { x: number; y: number; width: number; height: number }; bytesHint: number };

self.onmessage = ({ data }: MessageEvent<Request>) => {
  if (data.type !== 'snapshot') return;
  const compressedBytes = Math.max(128, Math.round(data.bytesHint * 0.38));
  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    label: data.label,
    timestamp: Date.now(),
    dirtyRect: new DOMRectReadOnly(data.rect.x, data.rect.y, data.rect.width, data.rect.height),
    compressedBytes
  };
  self.postMessage(entry);
};
