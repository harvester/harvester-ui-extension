import RFB from '@novnc/novnc/core/rfb';

export function normalizeZoom(value) {
  const percent = Number(value);

  if (!Number.isFinite(percent)) {
    return 100;
  }

  return Math.min(200, Math.max(50, Math.round(percent / 10) * 10));
}

export default class ZoomableRFB extends RFB {
  get zoomPercent() {
    return this._zoomPercent ?? 100;
  }

  set zoomPercent(value) {
    this._zoomPercent = normalizeZoom(value);
    this._updateScale();
  }

  _updateScale() {
    if (this.scaleViewport) {
      super._updateScale();
    } else {
      this._display.scale = this.zoomPercent / 100;
      this._fixScrollbars();
    }
  }
}
