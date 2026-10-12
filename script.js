// =====================================================
//  Le Web, vu de l'intérieur — moteur de slides
//  JavaScript pur : aucune librairie, juste le DOM.
// =====================================================

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const stage = $("#stage");
const slides = $$(".slide", stage);
let current = 0;
let typingTimer = null;

// ---------- 1. Adapter la scène 1280×720 à l'écran ----------
function fit() {
  const box = $("#viewport").getBoundingClientRect();
  const scale = Math.min(box.width / 1280, box.height / 720);
  stage.style.setProperty("--s", Math.max(scale, 0.1));
}
window.addEventListener("resize", fit);

// ---------- 2. Barre d'adresse : on tape le chemin comme un vrai navigateur ----------
function typePath(path) {
  const el = $("#path");
  clearInterval(typingTimer);
  if (reduceMotion) { el.textContent = path; return; }
  let i = 0;
  el.textContent = "";
  typingTimer = setInterval(() => {
    el.textContent = path.slice(0, ++i);
    if (i >= path.length) clearInterval(typingTimer);
  }, 22);
}

function slugOf(slide) {
  const p = slide.dataset.path.replace(/^\//, "").replace(/\//g, "-");
  return p || "accueil";
}

// ---------- 3. Aller à une slide ----------
function go(index) {
  index = Math.max(0, Math.min(slides.length - 1, index));
  slides[current].classList.remove("active");
  current = index;
  const slide = slides[current];
  slide.classList.add("active");
  stage.classList.toggle("deco-full", slide.classList.contains("deco-full"));

  typePath(slide.dataset.path);
  const status = slide.dataset.status || "200 OK";
  const pill = $("#status");
  pill.textContent = status;
  pill.classList.toggle("error", !status.startsWith("2"));

  $("#chapter").textContent = slide.dataset.chapter || "";
  $("#counter").textContent = `${current + 1} / ${slides.length}`;
  $("#progress").style.width = `${((current + 1) / slides.length) * 100}%`;
  document.title = `${slide.dataset.path} · Le Web, vu de l'intérieur`;

  try { history.replaceState(null, "", "#" + slugOf(slide)); } catch (e) { /* ignoré */ }
  refreshDrawers();
}
const next = () => go(current + 1);
const prev = () => go(current - 1);

// ---------- 4. Clavier, boutons et swipe ----------
document.addEventListener("keydown", (e) => {
  const t = e.target;
  const typing = t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && !["checkbox", "range"].includes(t.type));
  if (typing) return;
  const k = e.key.toLowerCase();
  if (["arrowright", "pagedown", " "].includes(k)) { e.preventDefault(); next(); }
  else if (["arrowleft", "pageup"].includes(k)) { e.preventDefault(); prev(); }
  else if (k === "home") go(0);
  else if (k === "end") go(slides.length - 1);
  else if (k === "s") toggleDrawer("sourceDrawer");
  else if (k === "n") toggleDrawer("notesDrawer");
  else if (k === "f") toggleFullscreen();
  else if (k === "escape") closeDrawers();
});
$("#nextBtn").addEventListener("click", next);
$("#prevBtn").addEventListener("click", prev);
$("#restartBtn").addEventListener("click", () => go(0));

let touchX = null;
stage.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
stage.addEventListener("touchend", (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 60) (dx < 0 ? next : prev)();
  touchX = null;
});

function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  } catch (e) { /* plein écran indisponible */ }
}
$("#fullBtn").addEventListener("click", toggleFullscreen);

// ---------- 5. « Voir le code source » et notes du formateur ----------
function toggleDrawer(id) {
  const d = document.getElementById(id);
  const willOpen = d.hidden;
  closeDrawers();
  d.hidden = !willOpen;
  $("#sourceBtn").classList.toggle("on", id === "sourceDrawer" && willOpen);
  $("#notesBtn").classList.toggle("on", id === "notesDrawer" && willOpen);
  refreshDrawers();
}
function closeDrawers() {
  $$(".drawer").forEach((d) => (d.hidden = true));
  $("#sourceBtn").classList.remove("on");
  $("#notesBtn").classList.remove("on");
}
function refreshDrawers() {
  const slide = slides[current];
  if (!$("#sourceDrawer").hidden) {
    const copy = slide.cloneNode(true);
    copy.classList.remove("active");
    copy.querySelector(".notes")?.remove();
    $("#sourceCode").textContent = copy.outerHTML
      .replace(/ class=""/g, "")
      .replace(/\n\s*\n/g, "\n")
      .replace(/^ {6}/gm, "");
  }
  if (!$("#notesDrawer").hidden) {
    $("#notesText").textContent = slide.querySelector(".notes")?.textContent || "Pas de notes pour cette slide.";
  }
}
$("#sourceBtn").addEventListener("click", () => toggleDrawer("sourceDrawer"));
$("#notesBtn").addEventListener("click", () => toggleDrawer("notesDrawer"));
$$("[data-close]").forEach((b) => b.addEventListener("click", closeDrawers));

// ---------- 6. Chronomètres des activités ----------
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
$$(".timer").forEach((btn) => {
  let left = Number(btn.dataset.seconds);
  let tick = null;
  btn.textContent = fmt(left);
  btn.setAttribute("aria-label", "Lancer ou mettre en pause le chrono");
  btn.addEventListener("click", () => {
    if (btn.classList.contains("done")) {
      left = Number(btn.dataset.seconds);
      btn.classList.remove("done");
      btn.textContent = fmt(left);
      return;
    }
    if (tick) { clearInterval(tick); tick = null; btn.classList.remove("running"); return; }
    btn.classList.add("running");
    tick = setInterval(() => {
      left -= 1;
      btn.textContent = fmt(left);
      if (left <= 0) {
        clearInterval(tick); tick = null;
        btn.classList.remove("running");
        btn.classList.add("done");
        btn.textContent = "Temps !";
      }
    }, 1000);
  });
});

// ---------- 7. Cartes à révéler ----------
$$(".reveal").forEach((card) => card.addEventListener("click", () => card.classList.toggle("shown")));

// ---------- 8. Explications au clic (URL, arborescence, squelette) ----------
$$("[data-explainer]").forEach((box) => {
  const out = box.querySelector("[data-out]");
  $$("[data-info]", box).forEach((item) => item.addEventListener("click", () => {
    $$("[data-info]", box).forEach((i) => i.classList.toggle("on", i === item));
    out.textContent = item.dataset.info;
  }));
});

// ---------- 9. Onglets (balises HTML, propriétés CSS) ----------
$$(".tabbed").forEach((tabbed) => {
  const tabs = $$(".tabs .chip", tabbed);
  tabs.forEach((tab) => tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.toggle("active", t === tab));
    $$(".tab-panel", tabbed).forEach((p) => (p.hidden = p.dataset.panel !== tab.dataset.tab));
  }));
});

// ---------- 10. Le voyage d'une page (DNS → serveur → navigateur) ----------
const journey = [
  { node: 0, at: 0, label: "souk.tn ⏎" },
  { node: 1, at: 50, label: "Où est souk.tn ?" },
  { node: 0, at: 0, label: "41.229.10.7" },
  { node: 2, at: 100, label: "GET /" },
  { node: 0, at: 0, label: "200 OK + HTML" },
  { node: 0, at: 0, label: "page affichée ✓" },
];
let jStep = -1;
let jPlay = null;
function journeyGo(i) {
  jStep = i % journey.length;
  const s = journey[jStep];
  // Centres du premier et du dernier nœud dans la piste de 1136px (scène moins les marges)
  const left = 115, right = 1136 - 115;
  const packet = $("#packet");
  packet.style.left = `${left + ((right - left) * s.at) / 100}px`;
  packet.textContent = s.label;
  $$(".journey .node").forEach((n, k) => n.classList.toggle("lit", k === s.node));
  $$("#journeySteps li").forEach((li, k) => li.classList.toggle("on", k === jStep));
}
const playBtn = $("#journeyPlay");
$("#journeyStep").addEventListener("click", () => {
  clearInterval(jPlay); jPlay = null; playBtn.textContent = "▶ Lancer";
  journeyGo(jStep + 1);
});
playBtn.addEventListener("click", () => {
  if (jPlay) { clearInterval(jPlay); jPlay = null; playBtn.textContent = "▶ Lancer"; return; }
  playBtn.textContent = "❚❚ Pause";
  journeyGo(0);
  jPlay = setInterval(() => {
    if (jStep >= journey.length - 1) { clearInterval(jPlay); jPlay = null; playBtn.textContent = "↻ Rejouer"; return; }
    journeyGo(jStep + 1);
  }, 1700);
});

// ---------- 11. Front ou back ? ----------
let sorted = 0;
$$(".sort-item").forEach((item) => {
  item.querySelectorAll("button").forEach((btn) => btn.addEventListener("click", () => {
    if (item.classList.contains("ok")) return;
    if (btn.textContent.trim().toLowerCase() === item.dataset.answer) {
      item.classList.add("ok");
      btn.classList.add("picked");
      sorted += 1;
      $("#sortScore").textContent = `${sorted} / 8`;
    } else {
      item.classList.remove("wrong");
      void item.offsetWidth;          // relance l'animation
      item.classList.add("wrong");
    }
  }));
});

// ---------- 12. Éditeur HTML en direct ----------
const liveHtml = $("#liveHtml");
const preview = $("#livePreview");
function renderLive() {
  preview.srcdoc = `<style>body{font-family:system-ui,sans-serif;padding:16px 22px;color:#14183D;line-height:1.5}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}</style>${liveHtml.value}`;
}
liveHtml.addEventListener("input", renderLive);
liveHtml.addEventListener("keydown", (e) => {   // Tab insère deux espaces au lieu de quitter la zone
  if (e.key === "Tab") {
    e.preventDefault();
    const { selectionStart: a, selectionEnd: b, value } = liveHtml;
    liveHtml.value = value.slice(0, a) + "  " + value.slice(b);
    liveHtml.selectionStart = liveHtml.selectionEnd = a + 2;
    renderLive();
  }
});
renderLive();

// ---------- 13. Chasse aux bugs ----------
let bugsFound = 0;
$$("#bugCode .line").forEach((line) => line.addEventListener("click", () => {
  if (line.dataset.bug === undefined) {
    line.classList.remove("nope"); void line.offsetWidth; line.classList.add("nope");
    return;
  }
  if (line.classList.contains("found")) return;
  line.classList.add("found");
  bugsFound += 1;
  $("#bugScore").textContent = `${bugsFound} / 5`;
  const list = $("#bugFound");
  list.querySelector(".empty")?.remove();
  const li = document.createElement("li");
  li.textContent = line.dataset.bug;
  list.appendChild(li);
}));

// ---------- 14. Laboratoire des sélecteurs ----------
const demo = $("#domDemo");
$$(".sel-btn").forEach((btn) => btn.addEventListener("click", () => {
  $$(".sel-btn").forEach((b) => b.classList.toggle("on", b === btn));
  $$(".hit", demo).forEach((el) => el.classList.remove("hit"));
  const matches = $$(btn.dataset.sel, demo);
  matches.forEach((el) => el.classList.add("hit"));
  $("#selCount").textContent = `${matches.length} élément${matches.length > 1 ? "s" : ""} ciblé${matches.length > 1 ? "s" : ""}`;
  $("#selDesc").textContent = btn.dataset.desc;
}));

// ---------- 15. Modèle de boîte ----------
const pg = { margin: 24, border: 6, padding: 24, radius: 12, color: "#FFC93C" };
function renderBox() {
  const box = $("#pgBox");
  $("#marginZone").style.padding = pg.margin + "px";
  box.style.padding = pg.padding + "px";
  box.style.borderWidth = pg.border + "px";
  box.style.borderRadius = pg.radius + "px";
  box.style.background = pg.color;
  $("#oMargin").textContent = pg.margin + "px";
  $("#oBorder").textContent = pg.border + "px";
  $("#oPadding").textContent = pg.padding + "px";
  $("#oRadius").textContent = pg.radius + "px";
  $("#pgCode").innerHTML =
`<span class="t">.boite</span> {
  <span class="a">margin</span>: ${pg.margin}px;
  <span class="a">border</span>: ${pg.border}px solid;
  <span class="a">padding</span>: ${pg.padding}px;
  <span class="a">border-radius</span>: ${pg.radius}px;
  <span class="a">background</span>: ${pg.color};
}`;
}
[["pgMargin", "margin"], ["pgBorder", "border"], ["pgPadding", "padding"], ["pgRadius", "radius"]].forEach(([id, key]) => {
  document.getElementById(id).addEventListener("input", (e) => { pg[key] = Number(e.target.value); renderBox(); });
});
$$(".swatch").forEach((sw) => sw.addEventListener("click", () => {
  pg.color = sw.dataset.color;
  $$(".swatch").forEach((s) => s.classList.toggle("on", s === sw));
  renderBox();
}));
$(".swatch").classList.add("on");
renderBox();

// ---------- 16. Flexbox ----------
const flex = { jc: "flex-start", fd: "row", ai: "center" };
function renderFlex() {
  const d = $("#flexDemo");
  d.style.justifyContent = flex.jc;
  d.style.flexDirection = flex.fd;
  d.style.alignItems = flex.ai;
  $("#flexCode").innerHTML =
`<span class="t">nav</span> {
  <span class="a">display</span>: flex;
  <span class="a">flex-direction</span>: ${flex.fd};
  <span class="a">justify-content</span>: ${flex.jc};
  <span class="a">align-items</span>: ${flex.ai};
}`;
}
[["jc", "jc"], ["fd", "fd"], ["ai", "ai"]].forEach(([cls, key]) => {
  $$(`.chip.${cls}`).forEach((chip) => chip.addEventListener("click", () => {
    $$(`.chip.${cls}`).forEach((c) => c.classList.toggle("active", c === chip));
    flex[key] = chip.dataset[key];
    renderFlex();
  }));
});
renderFlex();

// ---------- 17. Score des missions CSS ----------
// Chaque liste [data-tally] met à jour son compteur : points si data-pts, sinon tâches faites.
$$("[data-tally]").forEach((box) => {
  const out = document.getElementById(box.dataset.tally);
  const inputs = $$('input[type="checkbox"]', box);
  const update = () => {
    const done = inputs.filter((i) => i.checked);
    if (inputs.some((i) => i.dataset.pts)) {
      const sum = (list) => list.reduce((s, i) => s + Number(i.dataset.pts || 0), 0);
      out.textContent = `${sum(done)} / ${sum(inputs)} pts`;
    } else {
      out.textContent = `${done.length} / ${inputs.length}`;
    }
  };
  inputs.forEach((i) => i.addEventListener("change", update));
  update();
});

// ---------- 18. Simulateur Git ----------
const files = ["index.html", "style.css", "photo.jpg", "about.html", "contact.html"];
const messages = ["Ajoute mon nom et ma photo", "Stylise le header", "Ajoute la liste des loisirs", "Corrige un lien cassé", "Ajoute le formulaire de contact"];
const git = { work: [], stage: [], local: [], remote: [], edits: 0 };
const hash = () => Math.random().toString(16).slice(2, 9);

function say(cmd, out) {
  const term = $("#gTerm");
  term.textContent = "$ " + cmd + " ";
  const span = document.createElement("span");
  span.textContent = out;
  term.appendChild(span);
}
function renderGit() {
  const fill = (id, items) => {
    const box = document.getElementById(id);
    box.innerHTML = "";
    items.forEach((it) => {
      const div = document.createElement("div");
      div.className = "gitem " + (it.hash ? "commit" : "file");
      if (it.hash) { const em = document.createElement("em"); em.textContent = it.hash; div.append(em, it.msg); }
      else div.textContent = it.name;
      box.appendChild(div);
    });
  };
  fill("gWork", git.work); fill("gStage", git.stage); fill("gLocal", git.local); fill("gRemote", git.remote);
}
$("#gEdit").addEventListener("click", () => {
  const name = files[git.edits % files.length];
  git.edits += 1;
  if (!git.work.some((f) => f.name === name)) git.work.push({ name });
  say("code " + name, "fichier modifié");
  renderGit();
});
$("#gAdd").addEventListener("click", () => {
  if (!git.work.length) return say("git add .", "rien à ajouter : modifie d'abord un fichier");
  git.stage.push(...git.work); git.work = [];
  say("git add .", `${git.stage.length} fichier(s) prêt(s) pour le commit`);
  renderGit();
});
$("#gCommit").addEventListener("click", () => {
  if (!git.stage.length) return say("git commit", "rien à valider : utilise d'abord git add");
  const msg = messages[git.local.length % messages.length];
  const c = { hash: hash(), msg };
  git.local.unshift(c); git.stage = [];
  say(`git commit -m "${msg}"`, `[main ${c.hash}] sauvegardé`);
  renderGit();
});
$("#gPush").addEventListener("click", () => {
  const fresh = git.local.filter((c) => !git.remote.includes(c));
  if (!fresh.length) return say("git push", "Everything up-to-date (rien de nouveau)");
  git.remote = [...git.local];
  say("git push origin main", `${fresh.length} commit(s) envoyé(s) sur github.com ✓`);
  renderGit();
});
$("#gReset").addEventListener("click", () => {
  Object.assign(git, { work: [], stage: [], local: [], remote: [], edits: 0 });
  say("", "modifie un fichier pour commencer");
  renderGit();
});

// ---------- 19. HTTP ou HTTPS ----------
const plain = "POST /connexion HTTP/1.1\nHost: monsite.tn\n\nemail=sami@mail.tn\nmot_de_passe=azerty123";
const cipher = "17 03 03 00 4a  ·  TLS chiffré\n\n9f%Kq!2@vB#7pL$e81zR^c0\nW&4mN*u!xQ8@tY3%hJ6dS#a";
let secure = false;
function renderWire() {
  $("#wire").classList.toggle("secure", secure);
  $("#wirePacket").textContent = secure ? cipher : plain;
  $("#wireProto").textContent = secure ? "HTTPS · chiffré" : "HTTP · en clair";
  $("#httpsToggle").textContent = secure ? "Revenir en HTTP" : "Passer en HTTPS";
}
$("#httpsToggle").addEventListener("click", () => { secure = !secure; renderWire(); });
renderWire();

// ---------- 20. Démo « CSS activé / désactivé » ----------
$("#cssToggle").addEventListener("click", () => {
  const on = $("#cssDemo").classList.toggle("styled");
  $("#cssToggle").textContent = on ? "Désactiver le CSS" : "Activer le CSS";
  $("#cssDemoLabel").textContent = on ? "Le même HTML, avec CSS" : "Le même HTML, sans CSS";
});

// ---------- 21. Mini-Emmet ----------
// Gère les cas courants : ! , tag.classe#id{texte}*n , enfants avec > , $ pour numéroter, loremN.
const LOREM = "lorem ipsum dolor sit amet consectetur adipisicing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam".split(" ");
const VOID = ["img", "br", "hr", "input", "meta", "link"];
const SKELETON = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>

</body>
</html>`;
function lorem(n) {
  const w = Array.from({ length: n }, (_, i) => LOREM[i % LOREM.length]);
  w[0] = w[0][0].toUpperCase() + w[0].slice(1);
  return w.join(" ") + ".";
}
function parseSeg(seg) {
  const m = seg.match(/^([a-z][a-z0-9]*)?((?:[.#][\w-]+)*)(?:\{([^}]*)\})?(?:\*(\d+))?$/i);
  if (!m || (!m[1] && !m[2] && m[3] === undefined)) {
    const l = seg.match(/^lorem(\d*)$/i);
    if (l) return { lorem: Number(l[1] || 30) };
    return null;
  }
  const classes = [], ids = [];
  (m[2].match(/[.#][\w-]+/g) || []).forEach((t) => (t[0] === "." ? classes : ids).push(t.slice(1)));
  return { tag: (m[1] || "div").toLowerCase(), classes, id: ids[0], text: m[3], n: Number(m[4] || 1) };
}
function emmet(abbr) {
  abbr = abbr.trim();
  if (abbr === "!" || abbr === "html:5") return SKELETON;
  const segs = abbr.split(">").map((x) => x.trim()).map(parseSeg);
  if (!segs.length || segs.some((x) => !x)) return null;
  function render(i, pad) {
    const s = segs[i];
    if (s.lorem) return pad + lorem(s.lorem);
    const out = [];
    for (let k = 1; k <= s.n; k++) {
      let attrs = "";
      if (s.id) attrs += ` id="${s.id.replace(/\$/g, k)}"`;
      if (s.classes.length) attrs += ` class="${s.classes.join(" ").replace(/\$/g, k)}"`;
      if (s.tag === "a") attrs += ' href=""';
      if (s.tag === "img") attrs += ' src="" alt=""';
      if (s.tag === "input") attrs += ' type="text"';
      const open = `<${s.tag}${attrs}>`;
      if (VOID.includes(s.tag)) { out.push(pad + open); continue; }
      const text = (s.text || "").replace(/\$/g, k);
      if (i + 1 < segs.length) {
        const child = segs[i + 1];
        if (child.lorem) { out.push(`${pad}${open}${text}${lorem(child.lorem)}</${s.tag}>`); continue; }
        out.push(pad + open + text, render(i + 1, pad + "  "), `${pad}</${s.tag}>`);
      } else {
        out.push(`${pad}${open}${text}</${s.tag}>`);
      }
    }
    return out.join("\n");
  }
  return render(0, "");
}
function showEmmet() {
  const res = emmet($("#emmetIn").value);
  $("#emmetOut").textContent = res === null ? "Abréviation non reconnue par ce simulateur." : res;
}
$("#emmetIn").addEventListener("input", showEmmet);
$("#emmetIn").addEventListener("keydown", (e) => { if (e.key === "Tab") { e.preventDefault(); showEmmet(); } });
$$(".emmet-ex .chip").forEach((c) => c.addEventListener("click", () => { $("#emmetIn").value = c.dataset.abbr; showEmmet(); }));
showEmmet();

// ---------- 22. Spécificité ----------
function renderSpec() {
  const on = $$(".spec-rule input").filter((i) => i.checked);
  const win = on.sort((a, b) => Number(b.dataset.w) - Number(a.dataset.w))[0];
  $("#specText").style.color = win ? win.dataset.color : "#000000";
  $("#specWin").textContent = win ? `Gagnant : ${win.dataset.name}` : "Aucune règle : couleur par défaut (noir)";
  $$(".spec-rule").forEach((l) => l.classList.toggle("winner", !!win && l.contains(win)));
}
$$(".spec-rule input").forEach((i) => i.addEventListener("change", renderSpec));
renderSpec();

// ---------- 23. px vs rem ----------
function renderRem() {
  const root = Number($("#remSlider").value);
  $("#remOut").textContent = root + "px";
  $("#remPx").style.fontSize = "24px";
  $("#remRem").style.fontSize = root * 1.5 + "px";
}
$("#remSlider").addEventListener("input", renderRem);
renderRem();

// ---------- 24. Grid ----------
const grid = { gc: "repeat(3, 1fr)", gg: "16px", gs: "0" };
function renderGrid() {
  const d = $("#gridDemo");
  d.style.gridTemplateColumns = grid.gc;
  d.style.gap = grid.gg;
  d.firstElementChild.style.gridColumn = grid.gs === "1" ? "span 2" : "auto";
  $("#gridCode").innerHTML =
`<span class="t">.galerie</span> {
  <span class="a">display</span>: grid;
  <span class="a">grid-template-columns</span>: ${grid.gc};
  <span class="a">gap</span>: ${grid.gg};
}` + (grid.gs === "1" ? `
<span class="t">.galerie :first-child</span> {
  <span class="a">grid-column</span>: span 2;
}` : "");
}
[["gc", "gc"], ["gg", "gg"], ["gs", "gs"]].forEach(([cls, key]) => {
  $$(`.chip.${cls}`).forEach((chip) => chip.addEventListener("click", () => {
    $$(`.chip.${cls}`).forEach((c) => c.classList.toggle("active", c === chip));
    grid[key] = chip.dataset[key];
    renderGrid();
  }));
});
$('.chip.gs[data-gs="0"]').classList.add("active");
renderGrid();

// ---------- 25. Responsive ----------
function renderResp() {
  const w = Number($("#respSlider").value);
  const cols = w >= 1024 ? 4 : w >= 600 ? 2 : 1;
  $("#respOut").textContent = w + "px";
  $("#respDevice").textContent = w >= 1024 ? "Ordinateur" : w >= 600 ? "Tablette" : "Mobile";
  $("#respScreen").style.width = (w / 1280) * 100 + "%";
  $("#respGal").style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  $$(".resp-code .mq").forEach((b) => b.classList.toggle("on", w >= Number(b.dataset.mq)));
}
$("#respSlider").addEventListener("input", renderResp);
renderResp();

// ---------- 26. Bac à sable JavaScript ----------
const SNIPPETS = {
  variables: `const nom = "Yasmine";   // ne peut pas être réaffectée
let age = 21;            // peut changer
age = age + 1;

console.log(\`\${nom} a \${age} ans\`);
console.log(typeof age, typeof nom, typeof true);`,
  conditions: `const note = 14;

if (note >= 16) {
  console.log("Très bien");
} else if (note >= 10) {
  console.log("Admis");
} else {
  console.log("Rattrapage");
}

console.log(5 === "5", 5 == "5");   // toujours ===
const mention = note >= 10 ? "Admis" : "Rattrapage";
console.log(mention);

// valeur ou référence ?
const t1 = [1, 2];
const t2 = t1;
t2.push(3);
console.log(t1);`,
  pieges: `// Note tes 4 prédictions AVANT d'exécuter !
console.log("5" + 3);
console.log("5" - 3);
console.log(5 === "5");
console.log(typeof null);`,
  tableaux: `const modules = ["HTML", "CSS", "JS"];
modules.push("React");
console.log(modules[0], modules.length);

const etudiant = { nom: "Ahmed", age: 22, filiere: "Informatique" };
etudiant.age = 23;
console.log(etudiant.nom, etudiant.age);
console.log(etudiant);`,
  boucles: `// Mini-exercice : la table de 7
for (let i = 1; i <= 10; i++) {
  console.log(\`7 × \${i} = \${7 * i}\`);
}

const modules = ["HTML", "CSS", "JS"];
for (const m of modules) {
  console.log(m);
}
console.log(modules.map(m => m.toLowerCase()));
console.log(modules.filter(m => m.length <= 3));`,
  fonctions: `function saluer(prenom) {
  return \`Bonjour \${prenom} !\`;
}
const carre = (n) => n * n;        // fonction fléchée
function prix(ht, tva = 0.19) {     // valeur par défaut
  return ht * (1 + tva);
}

console.log(saluer("Sarra"));
console.log(carre(4));
console.log(prix(100));`,
};
let jsFrame = null;
function jsLine(text, cls) {
  const p = document.createElement("p");
  p.className = cls || "";
  p.textContent = text;
  $("#jsOut").appendChild(p);
}
function runJS() {
  $("#jsOut").innerHTML = "";
  jsFrame?.remove();
  jsFrame = document.createElement("iframe");
  jsFrame.setAttribute("sandbox", "allow-scripts");
  jsFrame.hidden = true;
  const code = $("#jsCode").value.replace(/<\/script/gi, "<\\/script");
  jsFrame.srcdoc =
    '<script>const send=(t,a)=>parent.postMessage({__js:1,t,a},"*");' +
    'const fmt=v=>typeof v==="string"?v:(()=>{try{return JSON.stringify(v)}catch(e){return String(v)}})();' +
    'console.log=(...a)=>send("log",a.map(fmt).join(" "));console.error=(...a)=>send("err",a.map(fmt).join(" "));' +
    'window.onerror=(m,s,l)=>{send("err",m+" (ligne "+(l-1)+")")};<\/script>\n<script>\n' + code + "\n<\/script>";
  document.body.appendChild(jsFrame);
}
window.addEventListener("message", (e) => {
  if (!jsFrame || e.source !== jsFrame.contentWindow || !e.data || !e.data.__js) return;
  jsLine(e.data.a, e.data.t === "err" ? "err" : "");
});
function loadSnippet(name) {
  $$(".js-tabs .chip").forEach((c) => c.classList.toggle("active", c.dataset.snippet === name));
  $("#jsCode").value = SNIPPETS[name];
  runJS();
}
$$(".js-tabs .chip").forEach((c) => c.addEventListener("click", () => loadSnippet(c.dataset.snippet)));
$("#jsRun").addEventListener("click", runJS);
$("#jsCode").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runJS(); }
  if (e.key === "Tab") {
    e.preventDefault();
    const t = e.target, a = t.selectionStart;
    t.value = t.value.slice(0, a) + "  " + t.value.slice(t.selectionEnd);
    t.selectionStart = t.selectionEnd = a + 2;
  }
});
$("#jsCode").value = SNIPPETS.variables;
runJS();

// ---------- 27. Laboratoire du DOM ----------
const domTitre = $("#domTitre"), domListe = $("#domListe");
const DOM_ACTS = {
  text: { code: 'titre.textContent = "Nouveau titre";', run: () => { domTitre.textContent = "Nouveau titre"; } },
  toggle: { code: 'titre.classList.toggle("actif");', run: () => domTitre.classList.toggle("actif") },
  style: { code: 'titre.style.color = "red";', run: () => { domTitre.style.color = "#C2411A"; } },
  add: { code: 'const nouveauLi = document.createElement("li");\nnouveauLi.textContent = "JavaScript";\nliste.appendChild(nouveauLi);',
         run: () => { const li = document.createElement("li"); li.textContent = "JavaScript"; domListe.appendChild(li); } },
  remove: { code: "liste.lastElementChild.remove();", run: () => domListe.lastElementChild?.remove() },
  reset: { code: "// page remise à zéro", run: () => {
    domTitre.textContent = "Ma page"; domTitre.className = ""; domTitre.style.color = "";
    domListe.innerHTML = "<li>HTML</li><li>CSS</li>";
  } },
};
$$("[data-act]").forEach((b) => b.addEventListener("click", () => {
  const act = DOM_ACTS[b.dataset.act];
  act.run();
  $("#domLast").textContent = act.code;
}));

// ---------- 28. Événements ----------
function evLog(name, detail) {
  const box = $("#evLog");
  const p = document.createElement("p");
  p.textContent = `${name}${detail ? "  →  " + detail : ""}`;
  box.prepend(p);
  while (box.children.length > 6) box.lastElementChild.remove();
}
let evClicks = 0;
$("#evInput").addEventListener("input", () => {
  const v = $("#evInput").value.trim();
  $("#evTitre").textContent = v ? `Bonjour ${v} !` : "Bonjour !";
  evLog("input", `"${$("#evInput").value}"`);
});
$("#evInput").addEventListener("keydown", (e) => evLog("keydown", e.key));
$("#evBtn").addEventListener("click", () => { evClicks++; evLog("click", `clic n°${evClicks}`); });
$("#evBtn").addEventListener("mouseover", () => evLog("mouseover", "sur le bouton"));

// ---------- 29. Exercices : résultat et correction ----------
function placeholderImg(label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="100%" height="100%" fill="#BED7EB"/><text x="50%" y="50%" font-family="Arial" font-size="22" fill="#2E66A3" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
$$(".ex-viewer").forEach((viewer) => {
  const code = document.getElementById(viewer.dataset.src).textContent.replace(/<\\\//g, "</").trim();
  const screen = viewer.querySelector(".ex-screen");
  viewer.querySelectorAll("[data-view]").forEach((btn) => btn.addEventListener("click", () => {
    viewer.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b === btn));
    screen.innerHTML = "";
    if (btn.dataset.view === "result") {
      const frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-scripts");
      frame.title = "Résultat de la correction";
      frame.srcdoc = code.replace(/src="images\/([\w-]+)\.\w+"/g, (_, n) => `src="${placeholderImg(n)}"`);
      screen.appendChild(frame);
    } else {
      const pre = document.createElement("pre");
      pre.className = "code small ex-code";
      pre.textContent = code;
      screen.appendChild(pre);
    }
  }));
});

// ---------- 30. Conditions : la note choisit la branche ----------
function renderNote() {
  const note = Number($("#noteSlider").value);
  const b = note >= 16 ? "a" : note >= 10 ? "b" : "c";
  $("#noteOut").textContent = note;
  $$(".cond-code .cb").forEach((el) => el.classList.toggle("on", el.dataset.b === b));
  $("#condOut").textContent = { a: "Très bien", b: "Admis", c: "Rattrapage" }[b];
}
$("#noteSlider").addEventListener("input", renderNote);
renderNote();

// ---------- 31. Tableaux : méthodes en direct ----------
const FRUITS0 = ["Pomme", "Banane", "Orange"];
let fruits = [...FRUITS0];
const fmtArr = (a) => "[" + a.map((x) => (typeof x === "string" ? `"${x}"` : x)).join(", ") + "]";
function renderArr(flash) {
  const view = $("#arrView");
  view.innerHTML = "";
  fruits.forEach((f, i) => {
    const cell = document.createElement("span");
    cell.className = "arr-cell" + (flash === i ? " flash" : "");
    const idx = document.createElement("i");
    idx.textContent = i;
    cell.append(idx, f);
    view.appendChild(cell);
  });
  if (!fruits.length) view.textContent = "[ ] tableau vide";
}
$$("[data-arr]").forEach((b) => b.addEventListener("click", () => {
  let out, flash;
  switch (b.dataset.arr) {
    case "push": out = fruits.push("Kiwi"); flash = fruits.length - 1; out = `renvoie ${out} (nouvelle taille)`; break;
    case "pop": out = fruits.length ? `renvoie "${fruits.pop()}"` : "renvoie undefined (tableau vide)"; break;
    case "unshift": out = `renvoie ${fruits.unshift("Fraise")} (nouvelle taille)`; flash = 0; break;
    case "shift": out = fruits.length ? `renvoie "${fruits.shift()}"` : "renvoie undefined (tableau vide)"; break;
    case "indexOf": out = `renvoie ${fruits.indexOf("Pomme")}`; flash = fruits.indexOf("Pomme"); break;
    case "includes": out = `renvoie ${fruits.includes("Kiwi")}`; break;
  }
  $("#arrOut").textContent = `${out} · fruits = ${fmtArr(fruits)}`;
  renderArr(flash);
}));
renderArr();
const NOTES = [12, 8, 15, 6];
$$("[data-hof]").forEach((b) => b.addEventListener("click", () => {
  const r = { filter: fmtArr(NOTES.filter((n) => n >= 10)), map: fmtArr(NOTES.map((n) => n * 2)),
              forEach: "affiche 12, 8, 15, 6 · renvoie undefined" }[b.dataset.hof];
  $("#hofOut").textContent = `${r} · notes reste ${fmtArr(NOTES)}`;
}));

// ---------- 32. Valider un formulaire ----------
$("#valForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const nom = $("#valNom").value.trim();
  const email = $("#valEmail").value.trim();
  const msg = $("#valMsg");
  let text = "", ok = false;
  if (nom === "") text = "Nom obligatoire.";
  else if (!email.includes("@") || !email.includes(".")) text = "Adresse e-mail invalide.";
  else { text = `Merci ${nom}, message envoyé !`; ok = true; e.target.reset(); }
  msg.textContent = text;
  msg.className = "val-msg " + (ok ? "ok" : "err");
});

// ---------- 33. Générer une liste depuis un tableau ----------
const PROJETS0 = ["Site vitrine", "Blog", "Boutique"];
let projets = [...PROJETS0];
function renderGen() {
  $("#genArr").textContent = projets.map((p) => `"${p}"`).join(", ");
  const ul = $("#genList");
  ul.innerHTML = "";
  projets.forEach((p) => { const li = document.createElement("li"); li.textContent = p; ul.appendChild(li); });
}
$("#genForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("#genInput").value.trim();
  if (!v) return;
  projets.push(v);
  $("#genInput").value = "";
  renderGen();
});
$("#genReset").addEventListener("click", () => { projets = [...PROJETS0]; renderGen(); });
renderGen();

// ---------- 34. textContent / innerHTML / outerHTML ----------
$$("[data-read]").forEach((b) => b.addEventListener("click", () => {
  const t = $("#readTitre");
  const outer = '<h1 id="titre"><span>Salut</span> Sami</h1>';
  const out = {
    el: "▸ " + outer + "   (l'élément complet, cliquable dans la vraie console)",
    inner: '"<span>Salut</span> Sami"',
    text: `"${t.textContent}"`,
    outer: `"${outer}"`,
  }[b.dataset.read];
  const box = $("#readOut");
  box.innerHTML = "";
  [b.querySelector("code").textContent, out].forEach((line, i) => {
    const p = document.createElement("p");
    if (i === 0) p.className = "cmd";
    p.textContent = line;
    box.appendChild(p);
  });
}));

// ---------- 35. Démarrage ----------
const startSlug = location.hash.slice(1);
const startIndex = Math.max(0, slides.findIndex((s) => slugOf(s) === startSlug));
slides.forEach((s) => s.classList.remove("active"));
slides[startIndex].classList.add("active");
current = startIndex;
fit();
go(startIndex);
journeyGo(0);
