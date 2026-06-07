import type { BrushPreset, TextureKind } from '../types/app';

const categories = ['Pencil', 'Sketching', 'Ink', 'Calligraphy', 'Painting', 'Oil', 'Acrylic', 'Watercolor', 'Gouache', 'Airbrush', 'Charcoal', 'Pastel', 'Texture', 'Organic', 'Spray', 'Special Effects'];
const textures: TextureKind[] = ['rough-paper', 'smooth-paper', 'watercolor-paper', 'canvas', 'cardboard', 'charcoal', 'pastel', 'oil', 'photo-grain'];
const modes: BrushPreset['renderingMode'][] = ['glaze', 'intense', 'wet', 'stamp', 'grain'];

export const brushPresets: BrushPreset[] = categories.flatMap((category, categoryIndex) =>
  Array.from({ length: 4 }, (_, index) => {
    const seed = categoryIndex * 4 + index;
    return {
      id: `${category.toLowerCase().replaceAll(' ', '-')}-${index + 1}`,
      name: `${category} ${['Studio', 'Soft', 'Dynamic', 'Pro'][index]}`,
      category,
      shapeSource: ['round', 'chisel', 'ragged', 'flat'][index],
      grainSource: textures[seed % textures.length],
      dualBrush: index % 2 === 0,
      textureOverlay: true,
      textureMultiply: 0.2 + (index * 0.18),
      wetMix: category.match(/Watercolor|Oil|Gouache|Acrylic/) ? 0.72 : 0.15 + index * 0.1,
      flow: 0.45 + index * 0.12,
      buildup: 0.35 + (categoryIndex % 5) * 0.1,
      smudgeStrength: category.match(/Charcoal|Pastel|Oil/) ? 0.66 : 0.22,
      renderingMode: modes[seed % modes.length],
      size: 8 + index * 10 + (categoryIndex % 3) * 4,
      opacity: 0.62 + index * 0.09,
      spacing: 0.08 + index * 0.03,
      dynamics: {
        pressureCurve: [{ x: 0, y: 0.05 }, { x: 0.45, y: 0.36 + index * 0.08 }, { x: 1, y: 1 }],
        velocityCurve: [{ x: 0, y: 1 }, { x: 0.65, y: 0.72 }, { x: 1, y: 0.38 }],
        tiltCurve: [{ x: 0, y: 0.2 }, { x: 1, y: 0.92 }],
        azimuth: seed * 13 % 360,
        rotation: 0.15 + index * 0.18,
        scatter: index * 0.12,
        jitter: 0.04 + (seed % 7) * 0.025,
        falloff: 0.58 + index * 0.08
      }
    };
  })
);

export const brushCategories = categories;
