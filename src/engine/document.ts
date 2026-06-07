import { brushPresets } from './brushPresets.js';
import type { BlendMode, DocumentState, Layer } from '../types/app.js';

export const blendModes: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'soft-light', 'hard-light', 'color-dodge', 'linear-dodge', 'color-burn', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];

const makeLayer = (name: string, partial: Partial<Layer> = {}): Layer => ({
  id: crypto.randomUUID(),
  name,
  kind: 'raster',
  visible: true,
  locked: false,
  alphaLock: false,
  clippingMask: false,
  reference: false,
  opacity: 1,
  blendMode: 'normal',
  ...partial
});

export const createInitialDocument = (): DocumentState => {
  const paint = makeLayer('Pintura');
  return {
    id: crypto.randomUUID(),
    name: 'Lienzo Procrearte',
    width: 4096,
    height: 4096,
    zoom: 0.22,
    rotation: 0,
    pan: { x: 0, y: 0 },
    activeTool: 'brush',
    activeBrushId: brushPresets[0].id,
    color: '#f6f2e9',
    texture: 'watercolor-paper',
    layers: [
      makeLayer('Boceto', { opacity: 0.72, blendMode: 'multiply' }),
      paint,
      makeLayer('Luces', { blendMode: 'linear-dodge', opacity: 0.54 })
    ],
    activeLayerId: paint.id,
    history: [],
    redo: [],
    recentColors: ['#f6f2e9', '#15171d', '#f26964', '#f5b64c', '#58d9a3', '#6aa8ff', '#b87dff'],
    palette: ['#101116', '#252936', '#f6f2e9', '#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#7c5cff']
  };
};
