// Gerenciador de paralaxe


const cenas = [...document.querySelectorAll(".cena")];
const visiveis = new Set();
let agendado = false;

const io = new IntersectionObserver((es) => {
  es.forEach((e) => (e.isIntersecting ? visiveis.add(e.target) : visiveis.delete(e.target)));
  atualizar();
});
cenas.forEach((c) => io.observe(c));

function atualizar() {
  agendado = false;
  for (const c of visiveis) {
    const r = c.getBoundingClientRect();
    const p = (innerHeight - r.top) / (innerHeight + r.height); // 0 = entrando, 1 = saindo
    c.style.setProperty("--p", Math.min(1, Math.max(0, p)).toFixed(4));
  }
}
addEventListener("scroll", () => {
  if (!agendado) { agendado = true; requestAnimationFrame(atualizar); }
}, { passive: true });
addEventListener("resize", atualizar);