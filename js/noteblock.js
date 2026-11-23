/**
 * NoteBlock — bloco de notas com textos iteráveis.
 * Uso: new NoteBlock(document.getElementById("bloco-historia"), ["texto 1", "texto 2"], { loop: false });
 *
 * Eventos disparados no container:
 *   "note:change" -> detail: { index, text }
 *   "note:play"   -> detail: { index, text }   (botão de áudio ligado)
 *   "note:stop"   -> botão de áudio desligado
 */
class NoteBlock {
  constructor(container, texts = [], opts = {}) {
    this.root = container;
    this.texts = texts;
    this.loop = !!opts.loop;
    this.tts = opts.tts || null; // { speak(texto, { onend }), cancel() } — a implementar
    this.i = 0;
    this.busy = false;
    this.speaking = false;
    this.build();
    this.setTexts(texts);
  }

  build() {
    const r = this.root;
    r.classList.add("notepad");
    r.setAttribute("role", "group");
    r.setAttribute("aria-roledescription", "bloco de notas");
    r.setAttribute("aria-label", "Textos");
    r.tabIndex = 0;
    r.innerHTML = `
      <div class="notepad__back"></div>
      <div class="notepad__stack"></div>
      <div class="notepad__count" aria-hidden="true"></div>
      <div class="sr-only" aria-live="polite"></div>
      <div class="notepad__controls">
        <button type="button" class="notepad__btn" data-act="prev" aria-label="Texto anterior">
          <svg viewBox="0 0 24 24"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>
        </button>
        <button type="button" class="notepad__btn" data-act="play" aria-pressed="false" aria-label="Ouvir texto">
          <svg class="i-play" viewBox="0 0 24 24"><path d="M5 5h2v14H5zM9 5l11 7-11 7z"/></svg>
          <svg class="i-stop" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
        </button>
        <button type="button" class="notepad__btn" data-act="next" aria-label="Próximo texto">
          <svg viewBox="0 0 24 24"><path d="M8.6 5.4 10 4l8 8-8 8-1.4-1.4L15.2 12z"/></svg>
        </button>
      </div>`;
    this.stack = r.querySelector(".notepad__stack");
    this.count = r.querySelector(".notepad__count");
    this.live = r.querySelector("[aria-live]");
    this.btn = {
      prev: r.querySelector('[data-act="prev"]'),
      play: r.querySelector('[data-act="play"]'),
      next: r.querySelector('[data-act="next"]'),
    };
    this.btn.prev.onclick = () => this.go(-1);
    this.btn.next.onclick = () => this.go(1);
    this.btn.play.onclick = () => this.toggleSpeech();
    r.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") this.go(-1);
      if (e.key === "ArrowRight") this.go(1);
    });
  }

  /** Troca toda a lista de textos (ex.: ao carregar outra história). */
  setTexts(texts) {
    this.stopSpeech();
    this.texts = texts;
    this.i = 0;
    this.stack.innerHTML = "";
    if (texts.length) {
      this.current = this.makeNote(0);
      this.stack.append(this.current);
      this.fit(this.current);
    }
    this.sync();
  }

  makeNote(index) {
    const n = document.createElement("div");
    n.className = "note";
    const t = document.createElement("div");
    t.className = "note__text";
    t.textContent = this.texts[index];
    n.append(t);
    return n;
  }

  // reduz a fonte até o texto caber no papel
  fit(note) {
    const t = note.firstChild;
    let size = 30;
    t.style.fontSize = size + "px";
    while (t.scrollHeight > t.clientHeight && size > 14) {
      size -= 1;
      t.style.fontSize = size + "px";
    }
  }

  go(dir) {
    if (this.busy || !this.texts.length) return;
    let next = this.i + dir;
    if (next < 0 || next >= this.texts.length) {
      if (!this.loop) return;
      next = (next + this.texts.length) % this.texts.length;
    }
    if (next === this.i) return;
    this.stopSpeech();
    this.busy = true;

    const old = this.current;
    const incoming = this.makeNote(next);
    const away = "translate(-115%, -8%) rotate(-10deg)";
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const D = still ? 1 : 480;
    const opts = { duration: D, easing: "cubic-bezier(.3,.7,.3,1)", fill: "both" };

    if (dir > 0) {
      incoming.style.zIndex = 1; old.style.zIndex = 2;
      this.stack.append(incoming);
      this.fit(incoming);
      incoming.animate([{ transform: "scale(.95) translateY(10px)" }, { transform: "none" }], opts);
      old.animate([{ transform: "none", opacity: 1 }, { transform: away, opacity: 0 }], opts);
    } else {
      incoming.style.zIndex = 3; old.style.zIndex = 2;
      this.stack.append(incoming);
      this.fit(incoming);
      incoming.animate([{ transform: away, opacity: 0 }, { transform: "none", opacity: 1 }], opts);
      old.animate([{ transform: "none" }, { transform: "scale(.95) translateY(10px)" }], opts);
    }

    setTimeout(() => {
      old.remove();
      incoming.getAnimations().forEach((a) => a.cancel());
      incoming.style.zIndex = "";
      this.current = incoming;
      this.i = next;
      this.busy = false;
      this.sync();
      this.root.dispatchEvent(new CustomEvent("note:change", { detail: { index: next, text: this.texts[next] } }));
    }, D);
  }

  sync() {
    const n = this.texts.length;
    this.count.textContent = n ? `${this.i + 1} / ${n}` : "";
    this.live.textContent = n ? `Texto ${this.i + 1} de ${n}` : "";
    this.btn.prev.disabled = !n || (!this.loop && this.i === 0);
    this.btn.next.disabled = !n || (!this.loop && this.i === n - 1);
    this.btn.play.disabled = !n;
  }

  // ---- TTS: por enquanto só o gancho ----
  toggleSpeech() {
    this.speaking ? this.stopSpeech() : this.startSpeech();
  }
  startSpeech() {
    this.speaking = true;
    this.btn.play.setAttribute("aria-pressed", "true");
    this.btn.play.setAttribute("aria-label", "Parar áudio");
    const text = this.texts[this.i];
    this.root.dispatchEvent(new CustomEvent("note:play", { detail: { index: this.i, text } }));
    if (this.tts) this.tts.speak(text, { onend: () => this.stopSpeech(true) });
  }
  stopSpeech(ended = false) {
    if (!this.speaking) return;
    this.speaking = false;
    this.btn.play.setAttribute("aria-pressed", "false");
    this.btn.play.setAttribute("aria-label", "Ouvir texto");
    if (this.tts && !ended) this.tts.cancel();
    this.root.dispatchEvent(new CustomEvent("note:stop"));
  }
}

window.NoteBlock = NoteBlock;