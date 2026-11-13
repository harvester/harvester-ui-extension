import ZoomableRFB from '../ZoomableRFB';

const GUEST_POINTER = 'url(guest-pointer) 0 0, default';

jest.mock('@novnc/novnc/core/rfb', () => ({
  __esModule: true,
  default:    class {
    constructor() {
      this.scaleViewport = true;
      this._canvas = { style: {} };
      this._cursorImage = { rgbaPixels: new Uint8Array() };
      this._display = { autoscale: jest.fn() };
    }

    _screenSize() {
      return { w: 1000, h: 500 };
    }

    _fixScrollbars() {}

    _handleMouse(ev) {
      ev.stopPropagation();
    }

    // As noVNC does: nothing visible hides the mouse, an image is shown as the pointer.
    _refreshCursor() {
      this._canvas.style.cursor = this._cursorImage.rgbaPixels.length ? 'url(guest-pointer) 0 0, default' : 'none';
    }
  },
}), { virtual: true });

describe('zoomableRFB', () => {
  describe('the pointer over the screen', () => {
    it('should be the system one while the guest sends no pointer image', () => {
      const rfb = new ZoomableRFB();

      rfb._refreshCursor();

      expect(rfb._canvas.style.cursor).toBe('default');
    });

    it('should be the system one when the image the guest sends is fully transparent', () => {
      const rfb = new ZoomableRFB();

      rfb._cursorImage = { rgbaPixels: new Uint8Array([255, 255, 255, 0, 0, 0, 0, 0]) };
      rfb._refreshCursor();

      expect(rfb._canvas.style.cursor).toBe('default');
    });

    it('should be the one the guest sends when it has visible pixels', () => {
      const rfb = new ZoomableRFB();

      rfb._cursorImage = { rgbaPixels: new Uint8Array([0, 0, 0, 0, 0, 0, 0, 255]) };
      rfb._refreshCursor();

      expect(rfb._canvas.style.cursor).toBe(GUEST_POINTER);
    });

    it('should go back to the system one when the guest stops sending an image', () => {
      const rfb = new ZoomableRFB();

      rfb._cursorImage = { rgbaPixels: new Uint8Array([0, 0, 0, 255]) };
      rfb._refreshCursor();
      rfb._cursorImage = { rgbaPixels: [] };
      rfb._refreshCursor();

      expect(rfb._canvas.style.cursor).toBe('default');
    });
  });

  describe('mouse events on the screen', () => {
    it('should let a click through, so an open menu sees it as a click outside', () => {
      const rfb = new ZoomableRFB();
      const stopPropagation = jest.fn();

      rfb._handleMouse({ type: 'click', stopPropagation });

      expect(stopPropagation).not.toHaveBeenCalled();
    });

    it('should leave the others to noVNC', () => {
      const rfb = new ZoomableRFB();
      const stopPropagation = jest.fn();

      rfb._handleMouse({ type: 'mousedown', stopPropagation });

      expect(stopPropagation).toHaveBeenCalledTimes(1);
    });
  });

  describe('the fitted screen', () => {
    it('should keep room for the focus ring', () => {
      const rfb = new ZoomableRFB();

      rfb._updateScale();

      expect(rfb._display.autoscale).toHaveBeenLastCalledWith(992, 492);
    });

    it('should take all the room when it is edge to edge', () => {
      const rfb = new ZoomableRFB();

      rfb.edgeToEdge = true;

      expect(rfb._display.autoscale).toHaveBeenLastCalledWith(1000, 500);
    });
  });
});
