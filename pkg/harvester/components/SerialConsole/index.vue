<script>
import { allHash } from '@shell/utils/promise';
import debounce from 'lodash/debounce';
import Socket, {
  EVENT_CONNECTED,
  EVENT_CONNECTING,
  EVENT_DISCONNECTED,
  EVENT_MESSAGE,
  EVENT_CONNECT_ERROR,
} from '@shell/utils/socket';

export default {
  emits: ['close'],

  props: {
    value: {
      type:     Object,
      required: true,
    },
  },

  data() {
    return {
      socket:        null,
      terminal:      null,
      textDecoder:   null,
      fitAddon:      null,
      searchAddon:   null,
      webglAddon:    null,
      onResize:      null,
      isOpen:        false,
      isOpening:     false,
      backlog:       [],
      firstTime:     true,
      queue:         [],
      isDraining:    false,
      showSearch:    false,
      searchQuery:   '',
      searchOptions: {
        caseSensitive: false,
        regex:         false,
        wholeWord:     false,
        incremental:   true,
        decorations:   {
          matchBackground:               '#B45309',
          matchBorder:                   '#FDBA74',
          matchOverviewRuler:            '#FDBA74',
          activeMatchBackground:         '#EA580C',
          activeMatchBorder:             '#FED7AA',
          activeMatchColorOverviewRuler: '#FED7AA',
        },
      },
    };
  },

  computed: {
    xtermConfig() {
      return {
        allowProposedApi: true,
        cursorBlink:      true,
        cursorStyle:      'bar',
        cursorWidth:      2,
        useStyle:         true,
        fontFamily:       'JetBrains Mono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize:         16,
        lineHeight:       1.3,
      };
    },
  },

  beforeUnmount() {
    this.close();
  },

  async mounted() {
    this.textDecoder = new TextDecoder('utf-8');
    await this.setupTerminal();
    await this.connect();
    this.onResize = debounce(() => this.fit(), 100);
    window.addEventListener('resize', this.onResize);
    this.scheduleFit();
  },

  methods: {
    async setupTerminal() {
      const docStyle = getComputedStyle(document.querySelector('body'));
      const xterm = await import(/* webpackChunkName: "xterm" */ '@xterm/xterm');

      const addons = await allHash({
        fit:      import(/* webpackChunkName: "xterm" */ '@xterm/addon-fit'),
        webgl:    import(/* webpackChunkName: "xterm" */ '@xterm/addon-webgl'),
        weblinks: import(/* webpackChunkName: "xterm" */ '@xterm/addon-web-links'),
        search:   import(/* webpackChunkName: "xterm" */ '@xterm/addon-search'),
        canvas:   import(/* webpackChunkName: "xterm" */ '@xterm/addon-canvas'),
      });

      const terminal = new xterm.Terminal({
        theme: {
          background: docStyle.getPropertyValue('--terminal-bg').trim(),
          cursor:     docStyle.getPropertyValue('--terminal-text').trim(),
          foreground: docStyle.getPropertyValue('--terminal-text').trim()
        },
        ...this.xtermConfig,
      });

      this.fitAddon = new addons.fit.FitAddon();
      this.searchAddon = new addons.search.SearchAddon();
      terminal.loadAddon(this.fitAddon);
      terminal.loadAddon(this.searchAddon);
      terminal.loadAddon(new addons.weblinks.WebLinksAddon());
      terminal.open(this.$refs.xterm);

      // The webgl renderer can fail without throwing: the context may be lost
      // mid-session, or it can attach but silently never paint, leaving the
      // terminal's helper textarea at 0x0. Detect both cases and fall back to the
      // canvas renderer so the terminal stays interactive.
      try {
        this.webglAddon = new addons.webgl.WebglAddon();

        this.webglAddon.onContextLoss(() => {
          if (!this.isUnmounted && this.terminal) {
            this.fallbackToCanvas(terminal, addons);
          }
        });

        terminal.loadAddon(this.webglAddon);

        // Detect the silent "attaches but never paints" failure after a render frame.
        requestAnimationFrame(() => {
          if (this.isUnmounted || !this.terminal) {
            return;
          }

          const textarea = this.$refs.xterm?.querySelector('.xterm-helper-textarea');
          const hasPainted = textarea && textarea.getBoundingClientRect().height > 0;

          if (this.webglAddon && !hasPainted) {
            this.fallbackToCanvas(terminal, addons);
            this.fit();
          }
        });
      } catch (e) {
        // Some browsers (e.g. Safari) don't support the webgl renderer, so don't use it.
        this.fallbackToCanvas(terminal, addons);
      }

      this.fit();
      this.flush();

      terminal.onData((input) => {
        const msg = this.str2ab(input);

        this.write(msg);
      });

      terminal.attachCustomKeyEventHandler((event) => {
        const key = event.key?.toLowerCase();

        if ((event.ctrlKey || event.metaKey) && key === 'f') {
          event.preventDefault();
          this.openSearch();

          return false;
        }

        if (key === 'escape' && this.showSearch) {
          event.preventDefault();
          this.closeSearch();

          return false;
        }

        return true;
      });

      this.terminal = terminal;
    },

    openSearch() {
      this.showSearch = true;

      this.$nextTick(() => {
        const input = this.$refs.searchInput;

        if (input) {
          input.focus();
          input.select();
        }
      });
    },

    closeSearch() {
      this.showSearch = false;
      this.terminal?.focus();
    },

    findNext() {
      if (!this.searchAddon || !this.searchQuery) {
        return;
      }

      this.searchAddon.findNext(this.searchQuery, this.searchOptions);
    },

    findPrevious() {
      if (!this.searchAddon || !this.searchQuery) {
        return;
      }

      this.searchAddon.findPrevious(this.searchQuery, this.searchOptions);
    },

    onSearchInput() {
      if (!this.searchQuery) {
        return;
      }

      this.findNext();
    },

    onSearchKeydown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();

        if (event.shiftKey) {
          this.findPrevious();
        } else {
          this.findNext();
        }
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeSearch();
      }
    },

    scheduleFit() {
      this.$nextTick(() => {
        requestAnimationFrame(() => {
          this.fit();

          // Re-fit after layout settles to avoid undersized rows on first paint.
          setTimeout(() => this.fit(), 120);
        });
      });
    },

    // Dispose the webgl renderer (if any) and switch to the canvas renderer.
    // Used when webgl fails to construct, loses its context, or silently never paints.
    fallbackToCanvas(terminal, addons) {
      if (this.isUnmounted) {
        return;
      }

      this.webglAddon?.dispose();
      this.webglAddon = null;

      if (!this.canvasAddon) {
        this.canvasAddon = new addons.canvas.CanvasAddon();
        terminal.loadAddon(this.canvasAddon);
      }
      this.fit();
    },

    str2ab(str) {
      const enc = new TextEncoder();

      return enc.encode(str);
    },

    write(msg) {
      if ( this.isOpen ) {
        this.socket.send(msg);
      } else {
        this.backlog.push(msg);
      }
    },

    enqueueMessage(messagePromise) {
      this.queue.push(messagePromise);
      this.drainQueue();
    },

    async decodeMessageData(data) {
      if (typeof data === 'string') {
        return data;
      }

      if (!this.textDecoder) {
        this.textDecoder = new TextDecoder('utf-8');
      }

      if (data instanceof Blob) {
        const buffer = await data.arrayBuffer();

        return this.textDecoder.decode(new Uint8Array(buffer), { stream: true });
      }

      if (data instanceof ArrayBuffer) {
        return this.textDecoder.decode(new Uint8Array(data), { stream: true });
      }

      if (ArrayBuffer.isView(data)) {
        const view = data;
        const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);

        return this.textDecoder.decode(bytes, { stream: true });
      }

      return String(data || '');
    },

    async drainQueue() {
      if (this.isDraining || !this.terminal) {
        return;
      }

      this.isDraining = true;

      try {
        while (this.queue.length > 0) {
          const pendingMessages = this.queue.splice(0, this.queue.length);
          const settledMessages = await Promise.allSettled(pendingMessages);
          const messages = settledMessages
            .filter((result) => result.status === 'fulfilled')
            .map((result) => result.value);
          const output = messages.filter(Boolean).join('');

          if (output) {
            this.terminal.write(output);
          }
        }
      } finally {
        this.isDraining = false;

        // If data arrived between the last while-check and releasing the lock,
        // immediately schedule another drain so output never gets stuck.
        if (this.queue.length > 0 && this.terminal) {
          this.drainQueue();
        }
      }
    },

    clear() {
      this.terminal.clear();
    },

    getSocketUrl() {
      return `${ this.value?.getSerialConsolePath }`;
    },

    async connect() {
      if ( this.socket ) {
        await this.socket.disconnect();
        this.socket = null;
        this.terminal.reset();
      }

      const url = this.getSocketUrl();

      if ( !url ) {
        return;
      }

      this.socket = new Socket(url);

      this.socket.addEventListener(EVENT_CONNECTING, (e) => {
        this.isOpen = false;
        this.isOpening = true;
      });

      this.socket.addEventListener(EVENT_CONNECT_ERROR, (e) => {
        this.isOpen = false;
        this.isOpening = false;
        console.error('Connect Error', e); // eslint-disable-line no-console
      });

      this.socket.addEventListener(EVENT_CONNECTED, (e) => {
        this.isOpen = true;
        this.isOpening = false;
        if (this.show) {
          this.fit();
          this.flush();
        }
        this.scheduleFit();

        if (this.firstTime) {
          this.socket.send(this.str2ab('\n'));
          this.firstTime = false;
        }
      });

      this.socket.addEventListener(EVENT_DISCONNECTED, (e) => {
        this.isOpen = false;
        this.isOpening = false;
        this.$emit('close');
      });

      this.socket.addEventListener(EVENT_MESSAGE, (e) => {
        this.enqueueMessage(this.decodeMessageData(e.detail.data));
      });

      this.socket.connect();
      this.terminal.focus();
    },

    flush() {
      const backlog = this.backlog.slice();

      this.backlog = [];

      for ( const data of backlog ) {
        this.socket.send(data);
      }
    },

    fit(arg) {
      if ( !this.fitAddon ) {
        return;
      }

      this.fitAddon.fit();
    },

    close() {
      if (this.onResize) {
        window.removeEventListener('resize', this.onResize);
        this.onResize = null;
      }

      if ( this.socket ) {
        this.socket.disconnect();
      }

      if ( this.terminal ) {
        this.terminal.dispose();
      }
    },
  }
};
</script>

<template>
  <div class="harvester-shell-container">
    <div
      v-if="showSearch"
      class="shell-search"
    >
      <input
        ref="searchInput"
        v-model="searchQuery"
        type="text"
        class="shell-search-input"
        placeholder="Search in terminal"
        @input="onSearchInput"
        @keydown="onSearchKeydown"
      >
      <button
        class="btn role-secondary btn-sm shell-search-btn"
        type="button"
        title="Shift+Enter"
        @click="findPrevious"
      >
        Prev
      </button>
      <button
        class="btn role-secondary btn-sm shell-search-btn"
        type="button"
        title="Enter"
        @click="findNext"
      >
        Next
      </button>
      <button
        class="btn role-secondary btn-sm shell-search-btn"
        type="button"
        title="Esc"
        @click="closeSearch"
      >
        Close
      </button>
    </div>
    <div
      ref="xterm"
      class="shell-body"
    />
    <resize-observer @notify="fit" />
  </div>
</template>

<style lang="scss">
  @import '../../../../node_modules/@xterm/xterm/css/xterm.css';

  body, #__nuxt, #__layout, MAIN {
    height: 100%;
  }

  .harvester-shell-container {
    display: flex;
    flex-direction: column;
    position: relative;
    height: 100%;
    min-height: 0;
    overflow: hidden;

    .resize-observer {
      display: none;
    }

    .shell-search {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: flex-end;
      position: absolute;
      top: 8px;
      right: 10px;
      z-index: 5;
      padding: 8px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: color-mix(in srgb, var(--body-bg) 88%, transparent);
    }

    .shell-search-input {
      min-width: 220px;
      max-width: 420px;
      flex: 0 1 320px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--body-bg);
      color: var(--body-text);
      padding: 6px 8px;
    }

    .shell-search-btn {
      min-width: 64px;
    }

    .shell-body {
      flex: 1 1 auto;
      height: 100%;
      min-height: 0;
      padding: 0 10px;
      box-sizing: border-box;
    }

    .terminal.xterm {
      height: 100%;
    }
  }
</style>
