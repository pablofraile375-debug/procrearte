export type Tool = 'brush' | 'smudge' | 'eraser' | 'fill' | 'selection' | 'transform';
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'soft-light' | 'hard-light' | 'color-dodge' | 'linear-dodge' | 'color-burn' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';
export type LayerKind = 'raster' | 'group' | 'mask' | 'effect';
export type TextureKind = 'rough-paper' | 'smooth-paper' | 'watercolor-paper' | 'canvas' | 'cardboard' | 'charcoal' | 'pastel' | 'oil' | 'photo-grain';

export interface CurvePoint { x: number; y: number }
export interface BrushDynamics {
  pressureCurve: CurvePoint[];
  velocityCurve: CurvePoint[];
  tiltCurve: CurvePoint[];
  azimuth: number;
  rotation: number;
  scatter: number;
  jitter: number;
  falloff: number;
}
export interface BrushPreset {
  id: string;
  name: string;
  category: string;
  shapeSource: string;
  grainSource: TextureKind;
  dualBrush: boolean;
  textureOverlay: boolean;
  textureMultiply: number;
  wetMix: number;
  flow: number;
  buildup: number;
  smudgeStrength: number;
  renderingMode: 'glaze' | 'intense' | 'wet' | 'stamp' | 'grain';
  size: number;
  opacity: number;
  spacing: number;
  dynamics: BrushDynamics;
}
export interface Layer {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  locked: boolean;
  alphaLock: boolean;
  clippingMask: boolean;
  reference: boolean;
  opacity: number;
  blendMode: BlendMode;
  children?: Layer[];
}
export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  azimuth: number;
  twist: number;
  time: number;
}
export interface HistoryEntry {
  id: string;
  label: string;
  timestamp: number;
  dirtyRect: DOMRectReadOnly;
  compressedBytes: number;
}
export interface DocumentState {
  id: string;
  name: string;
  width: number;
  height: number;
  zoom: number;
  rotation: number;
  pan: { x: number; y: number };
  activeTool: Tool;
  activeBrushId: string;
  color: string;
  texture: TextureKind;
  layers: Layer[];
  activeLayerId: string;
  history: HistoryEntry[];
  redo: HistoryEntry[];
  recentColors: string[];
  palette: string[];
}
export interface RendererStats { fps: number; dirtyTiles: number; memoryMb: number; latencyMs: number }
