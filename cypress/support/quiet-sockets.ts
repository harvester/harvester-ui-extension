/**
 * A replay has no live updates, so the shell's subscribe sockets fail and it keeps warning that the
 * connection was lost; inside Rancher those warnings cover the page. In a replay the subscribe sockets
 * connect and stay quiet instead, with the pings steve sends so the shell's watchdog doesn't reconnect.
 */
const PING_EVERY = 10000;

type Handler = ((event: Event) => void) | null;

class QuietSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = QuietSocket.CONNECTING;
  url: string;
  protocol = '';
  extensions = '';
  binaryType = 'blob';
  bufferedAmount = 0;
  onopen: Handler = null;
  onmessage: Handler = null;
  onerror: Handler = null;
  onclose: Handler = null;
  private pings?: ReturnType<typeof setInterval>;

  constructor(url: string) {
    super();
    this.url = url;
    setTimeout(() => {
      this.readyState = QuietSocket.OPEN;
      this.emit(new Event('open'), this.onopen);
      this.pings = setInterval(() => this.emit(new MessageEvent('message', { data: JSON.stringify({ name: 'ping', data: {} }) }), this.onmessage), PING_EVERY);
    });
  }

  send() {}

  close() {
    clearInterval(this.pings);
    this.readyState = QuietSocket.CLOSED;
    this.emit(new CloseEvent('close', { code: 1000, wasClean: true }), this.onclose);
  }

  private emit(event: Event, handler: Handler) {
    this.dispatchEvent(event);
    handler?.(event);
  }
}

/**
 * Make the page's steve subscribe sockets quiet ones; any other socket stays real
 */
export function quietSubscribeSockets(win: Cypress.AUTWindow) {
  win.WebSocket = new Proxy(win.WebSocket, {
    construct(RealSocket, args: [string | URL, (string | string[])?]) {
      return /\/subscribe(\?|$)/.test(String(args[0])) ? new QuietSocket(String(args[0])) : new RealSocket(...args);
    }
  });
}
