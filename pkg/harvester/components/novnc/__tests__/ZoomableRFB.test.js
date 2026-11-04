import ZoomableRFB from '../ZoomableRFB';

jest.mock('@novnc/novnc/core/rfb', () => ({
  __esModule: true,
  default:    class {
    constructor() {
      this.scaleViewport = true;
      this._display = { autoscale: jest.fn() };
    }

    _screenSize() {
      return { w: 1000, h: 500 };
    }

    _fixScrollbars() {}
  },
}), { virtual: true });

describe('zoomableRFB', () => {
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
