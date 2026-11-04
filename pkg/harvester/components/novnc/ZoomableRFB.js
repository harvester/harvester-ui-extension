import RFB from '@novnc/novnc/core/rfb';

export const MINIMUM_ZOOM = 50;
export const MAXIMUM_ZOOM = 200;
export const ZOOM_STEP = 10;

// The focus ring and the gap before it, drawn outside the canvas.
const FOCUS_RING_WIDTH = 4;

export function normalizeZoom(value) {
  const percent = Number(value);

  if (!Number.isFinite(percent)) {
    return 100;
  }

  return Math.min(MAXIMUM_ZOOM, Math.max(MINIMUM_ZOOM, Math.round(percent / ZOOM_STEP) * ZOOM_STEP));
}

export default class ZoomableRFB extends RFB {
  get zoomPercent() {
    return this._zoomPercent ?? 100;
  }

  set zoomPercent(value) {
    this._zoomPercent = normalizeZoom(value);
    this._updateScale();
  }

  // The screen takes all the room it has, without a focus ring around it.
  get edgeToEdge() {
    return !!this._edgeToEdge;
  }

  set edgeToEdge(value) {
    this._edgeToEdge = value;
    this._updateScale();
  }

  _updateScale() {
    if (this.scaleViewport) {
      // Fit inside the focus ring the console draws around the canvas, instead of under it.
      const size = this._screenSize();
      const inset = this.edgeToEdge ? 0 : 2 * FOCUS_RING_WIDTH;

      this._display.autoscale(size.w - inset, size.h - inset);
      this._fixScrollbars();
    } else {
      this._display.scale = this.zoomPercent / 100;
      this._fixScrollbars();
    }
  }
}
