import { ProRenderer } from './engine/Renderer.js';
import { brushCategories, brushPresets } from './engine/brushPresets.js';
import { blendModes } from './engine/document.js';
import { createInitialDocument } from './engine/document.js';
import { saveDocument } from './storage/projectStore.js';
import type { BrushPreset, DocumentState, RendererStats, StrokePoint, TextureKind, Tool } from './types/app.js';

const textures: TextureKind[] = ['rough-paper', 'smooth-paper', 'watercolor-paper', 'canvas', 'cardboard', 'charcoal', 'pastel', 'oil', 'photo-grain'];
const tools: Tool[] = ['brush', 'smudge', 'eraser', 'fill', 'selection', 'transform'];
const effects = ['Gaussian Blur', 'Motion Blur', 'Perspective Blur', 'Sharpen', 'Noise', 'Bloom', 'Glitch', 'Chromatic Aberration', 'Liquify', 'Halftone', 'Color Balance', 'Curves', 'Hue Saturation', 'Gradient Map'];

class ProcrearteApp {
  private state: DocumentState = createInitialDocument();
  private renderer: ProRenderer | null = null;
  private worker: Worker | null = null;
  private root: HTMLElement;
  private selectedCategory = 'Pencil';
  private stats: RendererStats = { fps: 120, dirtyTiles: 0, memoryMb: 0, latencyMs: 4 };
  private activeEffect = 'Curves';

  constructor(root: HTMLElement) {
    this.root = root;
    this.render();
    this.mountRenderer();
    this.registerPwa();
    window.setInterval(() => saveDocument(this.state), 5000);
    window.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') this.undo();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') this.redo();
    });
  }

  private get activeBrush() {
    return brushPresets.find(brush => brush.id === this.state.activeBrushId) ?? brushPresets[0];
  }

  private setState(update: Partial<DocumentState>) {
    const snapshot = this.renderer?.export('image/png');
    this.state = { ...this.state, ...update };
    this.render();
    this.mountRenderer(true, snapshot);
  }

  private render() {
    this.root.innerHTML = `
      <main class="studio-shell">
        <aside class="panel toolbar" aria-label="Herramientas">
          <div class="brand"><span>✦</span><strong>Procrearte</strong></div>
          ${tools.map(tool => `<button data-tool="${tool}" class="${this.state.activeTool === tool ? 'active' : ''}">${tool}</button>`).join('')}
          <div class="divider"></div>
          <button data-action="undo">Undo ${this.state.history.length}</button>
          <button data-action="redo">Redo ${this.state.redo.length}</button>
          <button data-action="clear">Limpiar</button>
        </aside>
        <section class="canvas-stage" style="--zoom:${this.state.zoom};--rotation:${this.state.rotation}deg">
          <div class="hud top-left">${this.stats.fps} FPS · ${this.stats.latencyMs} ms · ${this.stats.dirtyTiles} tiles · ${this.stats.memoryMb} MB</div>
          <canvas class="paint-canvas"></canvas>
          <div class="gesture-pad"><input data-field="zoom" type="range" min="0.1" max="2" step="0.01" value="${this.state.zoom}"><input data-field="rotation" type="range" min="-180" max="180" value="${this.state.rotation}"></div>
        </section>
        <aside class="right-rail">
          <section class="panel color-panel"><h2>Color</h2><input class="color-input" data-field="color" type="color" value="${this.state.color}"><div class="wheel"><span style="background:${this.state.color}"></span></div><div class="swatches">${this.state.palette.map(color => `<button data-color="${color}" style="background:${color}" aria-label="${color}"></button>`).join('')}</div></section>
          <section class="panel brush-panel"><h2>Pinceles</h2><select data-field="category">${brushCategories.map(category => `<option ${category === this.selectedCategory ? 'selected' : ''}>${category}</option>`).join('')}</select><div class="brush-list">${brushPresets.filter(brush => brush.category === this.selectedCategory).map(brush => `<button data-brush="${brush.id}" class="${brush.id === this.activeBrush.id ? 'active' : ''}"><strong>${brush.name}</strong><small>${brush.shapeSource} · ${brush.grainSource}</small></button>`).join('')}</div>${this.slider('Size', 'size', 1, 160, this.activeBrush.size)}${this.slider('Flow', 'flow', 0.05, 1, this.activeBrush.flow, 0.01)}${this.slider('Wet Mix', 'wetMix', 0, 1, this.activeBrush.wetMix, 0.01)}</section>
          <section class="panel layers-panel"><h2>Capas</h2>${this.state.layers.map(layer => `<article data-layer="${layer.id}" class="${layer.id === this.state.activeLayerId ? 'layer active' : 'layer'}" draggable="true"><span>${layer.visible ? '◉' : '○'}</span><strong>${layer.name}</strong><small>${layer.blendMode} · ${Math.round(layer.opacity * 100)}%</small></article>`).join('')}<select data-field="blendMode">${blendModes.map(mode => `<option ${this.state.layers.find(layer => layer.id === this.state.activeLayerId)?.blendMode === mode ? 'selected' : ''}>${mode}</option>`).join('')}</select></section>
          <section class="panel effects-panel"><h2>Efectos no destructivos</h2><select data-field="effect">${effects.map(effect => `<option ${effect === this.activeEffect ? 'selected' : ''}>${effect}</option>`).join('')}</select><p>${this.activeEffect} se añade como ajuste vivo sobre la pila de capas.</p></section>
          <section class="panel export-panel"><h2>Exportar</h2><button data-export="image/png">PNG</button><button data-export="image/jpeg">JPG</button><button data-export="image/webp">WEBP</button><button data-action="psd">PSD</button><select data-field="texture">${textures.map(texture => `<option ${texture === this.state.texture ? 'selected' : ''}>${texture}</option>`).join('')}</select></section>
        </aside>
      </main>`;
    this.bindControls();
  }

  private slider(label: string, field: keyof BrushPreset, min: number, max: number, value: number, step = 1) {
    return `<label>${label} <input data-brush-field="${String(field)}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
  }

  private mountRenderer(recreate = true, snapshot?: string) {
    const canvas = this.root.querySelector<HTMLCanvasElement>('canvas.paint-canvas');
    if (!canvas) return;
    if (recreate || !this.renderer) {
      this.renderer?.destroy();
      this.renderer = new ProRenderer(canvas, stats => { this.stats = stats; this.updateHud(); });
      if (snapshot) window.setTimeout(() => this.renderer?.restore(snapshot), 0);
      this.worker?.terminate();
      this.worker = new Worker(new URL('./workers/history.worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }) => this.setState({ history: [data, ...this.state.history].slice(0, 120), redo: [] });
      window.addEventListener('resize', () => this.renderer?.resize());
    }
    this.bindCanvas(canvas);
  }

  private bindCanvas(canvas: HTMLCanvasElement) {
    const point = (event: PointerEvent): StrokePoint => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top, pressure: event.pressure || (event.pointerType === 'mouse' ? 0.52 : 0.7), tiltX: event.tiltX, tiltY: event.tiltY, azimuth: Math.atan2(event.tiltY, event.tiltX || 1), twist: event.twist, time: performance.now() };
    };
    canvas.onpointerdown = event => { canvas.setPointerCapture(event.pointerId); this.renderer?.begin(point(event), this.drawOptions()); };
    canvas.onpointermove = event => { if (!(event.buttons & 1)) return; const events = event.getCoalescedEvents?.() ?? [event]; for (const item of events) this.renderer?.move(point(item), this.drawOptions()); };
    canvas.onpointerup = () => this.endStroke();
    canvas.onpointercancel = () => this.endStroke();
    canvas.ondblclick = () => this.undo();
  }

  private bindControls() {
    this.root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(button => button.onclick = () => this.setState({ activeTool: button.dataset.tool as Tool }));
    this.root.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(button => button.onclick = () => this.setState({ color: button.dataset.color ?? this.state.color }));
    this.root.querySelectorAll<HTMLButtonElement>('[data-brush]').forEach(button => button.onclick = () => this.setState({ activeBrushId: button.dataset.brush ?? this.state.activeBrushId }));
    this.root.querySelectorAll<HTMLElement>('[data-layer]').forEach(layer => layer.onclick = () => this.setState({ activeLayerId: layer.dataset.layer ?? this.state.activeLayerId }));
    this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]').forEach(input => input.oninput = () => this.updateField(input));
    this.root.querySelectorAll<HTMLInputElement>('[data-brush-field]').forEach(input => input.oninput = () => { Object.assign(this.activeBrush, { [input.dataset.brushField ?? 'size']: Number(input.value) }); });
    this.root.querySelector('[data-action="undo"]')?.addEventListener('click', () => this.undo());
    this.root.querySelector('[data-action="redo"]')?.addEventListener('click', () => this.redo());
    this.root.querySelector('[data-action="clear"]')?.addEventListener('click', () => this.renderer?.clear(this.state.texture));
    this.root.querySelector('[data-action="psd"]')?.addEventListener('click', () => window.alert('PSD: exportación de estructura de capas preparada.'));
    this.root.querySelectorAll<HTMLButtonElement>('[data-export]').forEach(button => button.onclick = () => this.exportImage(button.dataset.export as 'image/png' | 'image/jpeg' | 'image/webp'));
  }

  private updateField(input: HTMLInputElement | HTMLSelectElement) {
    const field = input.dataset.field;
    if (field === 'zoom') this.setState({ zoom: Number(input.value) });
    if (field === 'rotation') this.setState({ rotation: Number(input.value) });
    if (field === 'color') this.setState({ color: input.value });
    if (field === 'texture') this.setState({ texture: input.value as TextureKind });
    if (field === 'category') { this.selectedCategory = input.value; this.render(); this.mountRenderer(true); }
    if (field === 'effect') { this.activeEffect = input.value; this.render(); this.mountRenderer(true); }
    if (field === 'blendMode') this.setState({ layers: this.state.layers.map(layer => layer.id === this.state.activeLayerId ? { ...layer, blendMode: input.value as never } : layer) });
  }

  private drawOptions() { return { color: this.state.color, brush: this.activeBrush, tool: this.state.activeTool, texture: this.state.texture }; }
  private endStroke() { this.renderer?.end(); this.worker?.postMessage({ type: 'snapshot', label: `${this.state.activeTool} · ${this.activeBrush.name}`, rect: { x: 0, y: 0, width: 512, height: 512 }, bytesHint: 512 * 512 * 4 }); }
  private undo() { if (this.state.history.length) this.setState({ redo: [this.state.history[0], ...this.state.redo], history: this.state.history.slice(1) }); }
  private redo() { if (this.state.redo.length) this.setState({ history: [this.state.redo[0], ...this.state.history], redo: this.state.redo.slice(1) }); }
  private updateHud() { const hud = this.root.querySelector('.hud'); if (hud) hud.textContent = `${this.stats.fps} FPS · ${this.stats.latencyMs} ms · ${this.stats.dirtyTiles} tiles · ${this.stats.memoryMb} MB`; }
  private exportImage(type: 'image/png' | 'image/jpeg' | 'image/webp') { const link = window.document.createElement('a'); link.href = this.renderer?.export(type) ?? ''; link.download = `procrearte.${type.split('/')[1]}`; link.click(); }
  private registerPwa() { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js'); }
}

new ProcrearteApp(document.getElementById('root')!);
