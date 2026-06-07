import type { BrushPreset, RendererStats, StrokePoint, TextureKind } from '../types/app';

type DrawOptions = { color: string; brush: BrushPreset; tool: string; texture: TextureKind };

export class ProRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gl: WebGL2RenderingContext | null;
  private lastFrame = performance.now();
  private frameCount = 0;
  private fps = 120;
  private dirtyTiles = new Set<string>();
  private lastPoint: StrokePoint | null = null;
  private raf = 0;
  private onStats: (stats: RendererStats) => void;

  constructor(canvas: HTMLCanvasElement, onStats: (stats: RendererStats) => void) {
    this.canvas = canvas;
    this.ctx = this.make2DContext(canvas);
    this.gl = canvas.getContext('webgl2', { alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.onStats = onStats;
    this.resize();
    this.paintPaper('watercolor-paper');
    this.tick();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
  }

  resize() {
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  clear(texture: TextureKind) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.paintPaper(texture);
  }

  begin(point: StrokePoint, options: DrawOptions) {
    this.lastPoint = point;
    this.stamp(point, options, 0);
  }

  move(point: StrokePoint, options: DrawOptions) {
    if (!this.lastPoint) {
      this.begin(point, options);
      return;
    }
    const previous = this.lastPoint;
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    const spacing = Math.max(1, options.brush.size * options.brush.spacing);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      this.stamp({
        x: previous.x + (point.x - previous.x) * t,
        y: previous.y + (point.y - previous.y) * t,
        pressure: previous.pressure + (point.pressure - previous.pressure) * t,
        tiltX: point.tiltX,
        tiltY: point.tiltY,
        azimuth: point.azimuth,
        twist: point.twist,
        time: point.time
      }, options, distance);
    }
    this.lastPoint = point;
  }

  end() {
    this.lastPoint = null;
  }

  export(type: 'image/png' | 'image/jpeg' | 'image/webp') {
    return this.canvas.toDataURL(type, 0.95);
  }

  restore(dataUrl: string) {
    const image = new Image();
    image.onload = () => this.ctx.drawImage(image, 0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    image.src = dataUrl;
  }

  private make2DContext(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true, willReadFrequently: false });
    if (!ctx) throw new Error('No se pudo inicializar Canvas 2D');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
  }

  private stamp(point: StrokePoint, options: DrawOptions, velocity: number) {
    const { brush } = options;
    const pressure = this.curve(brush.dynamics.pressureCurve, point.pressure || 0.5);
    const velocityGain = this.curve(brush.dynamics.velocityCurve, Math.min(1, velocity / 64));
    const radius = Math.max(0.5, brush.size * (0.28 + pressure * 0.9));
    const jitter = brush.dynamics.jitter * radius;
    const x = point.x + (Math.random() - 0.5) * jitter + Math.sin(point.time * 0.012) * brush.dynamics.scatter * radius;
    const y = point.y + (Math.random() - 0.5) * jitter + Math.cos(point.time * 0.01) * brush.dynamics.scatter * radius;
    const alpha = Math.min(1, brush.opacity * brush.flow * velocityGain * (options.tool === 'eraser' ? 1 : 0.96));
    this.ctx.save();
    this.ctx.globalCompositeOperation = options.tool === 'eraser' ? 'destination-out' : options.tool === 'smudge' ? 'soft-light' : 'source-over';
    this.ctx.globalAlpha = alpha;
    this.ctx.translate(x, y);
    this.ctx.rotate((point.twist + brush.dynamics.azimuth) * Math.PI / 180);
    const gradient = this.ctx.createRadialGradient(0, 0, radius * 0.05, 0, 0, radius);
    const edge = brush.renderingMode === 'grain' ? '00' : Math.floor(255 * (1 - brush.dynamics.falloff)).toString(16).padStart(2, '0');
    gradient.addColorStop(0, options.color);
    gradient.addColorStop(0.62, this.withAlpha(options.color, 0.78));
    gradient.addColorStop(1, `${options.color}${edge}`);
    this.ctx.fillStyle = gradient;
    if (brush.shapeSource === 'chisel' || brush.shapeSource === 'flat') {
      this.roundRect(-radius, -radius * 0.34, radius * 2, radius * 0.68, radius * 0.2);
      this.ctx.fill();
    } else {
      this.ctx.beginPath();
      this.ctx.ellipse(0, 0, radius, radius * (brush.shapeSource === 'ragged' ? 0.72 : 1), 0, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = alpha * brush.textureMultiply;
    this.ctx.fillStyle = this.texturePattern(options.texture, radius);
    this.ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    this.ctx.restore();
    this.markDirty(x, y, radius);
  }

  private paintPaper(texture: TextureKind) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.fillStyle = '#20232d';
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.globalAlpha = 0.22;
    for (let i = 0; i < 900; i += 1) {
      const size = texture === 'canvas' ? 2 + Math.random() * 6 : 0.5 + Math.random() * 2.5;
      this.ctx.fillStyle = i % 2 ? '#ffffff' : '#05060a';
      this.ctx.fillRect(Math.random() * width, Math.random() * height, size, size);
    }
    this.ctx.globalAlpha = 1;
  }

  private texturePattern(texture: TextureKind, radius: number) {
    const opacity = texture.includes('paper') ? 0.16 : texture === 'photo-grain' ? 0.25 : 0.2;
    const line = texture === 'canvas' || texture === 'cardboard';
    const pattern = document.createElement('canvas');
    pattern.width = 32;
    pattern.height = 32;
    const pctx = pattern.getContext('2d');
    if (!pctx) return '#ffffff22';
    pctx.fillStyle = `rgba(255,255,255,${opacity})`;
    for (let i = 0; i < 40; i += 1) pctx.fillRect(Math.random() * 32, Math.random() * 32, Math.max(1, radius / 24), Math.max(1, radius / 24));
    if (line) {
      pctx.strokeStyle = `rgba(0,0,0,${opacity})`;
      pctx.beginPath();
      for (let y = 0; y < 32; y += 8) { pctx.moveTo(0, y); pctx.lineTo(32, y); }
      for (let x = 0; x < 32; x += 8) { pctx.moveTo(x, 0); pctx.lineTo(x, 32); }
      pctx.stroke();
    }
    return this.ctx.createPattern(pattern, 'repeat') ?? '#ffffff22';
  }

  private curve(points: { x: number; y: number }[], value: number) {
    const sorted = [...points].sort((a, b) => a.x - b.x);
    const nextIndex = sorted.findIndex(point => point.x >= value);
    if (nextIndex <= 0) return sorted[0]?.y ?? value;
    const a = sorted[nextIndex - 1];
    const b = sorted[nextIndex];
    const t = (value - a.x) / Math.max(0.0001, b.x - a.x);
    return a.y + (b.y - a.y) * t;
  }

  private withAlpha(hex: string, alpha: number) {
    const channel = Math.floor(alpha * 255).toString(16).padStart(2, '0');
    return `${hex}${channel}`;
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number) {
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, width, height, radius);
  }

  private markDirty(x: number, y: number, radius: number) {
    const tile = 256;
    const left = Math.floor((x - radius) / tile);
    const right = Math.floor((x + radius) / tile);
    const top = Math.floor((y - radius) / tile);
    const bottom = Math.floor((y + radius) / tile);
    for (let tx = left; tx <= right; tx += 1) for (let ty = top; ty <= bottom; ty += 1) this.dirtyTiles.add(`${tx}:${ty}`);
  }

  private tick = () => {
    const now = performance.now();
    this.frameCount += 1;
    if (now - this.lastFrame > 500) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFrame));
      this.frameCount = 0;
      this.lastFrame = now;
      this.onStats({ fps: Math.min(120, this.fps), dirtyTiles: this.dirtyTiles.size, memoryMb: Math.round((this.canvas.width * this.canvas.height * 4) / 1024 / 1024), latencyMs: Math.max(3, Math.round(1000 / Math.max(1, this.fps))) });
      this.dirtyTiles.clear();
    }
    this.raf = requestAnimationFrame(this.tick);
  };
}
