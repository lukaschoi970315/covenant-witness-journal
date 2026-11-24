(() => {
  const WD = ["주일", "월", "화", "수", "목", "금", "토"];
  const LOCAL_ENTRIES_KEY = "three_today_entries_v1";
  const LOCAL_PROFILE_KEY = "three_today_local_profile_v1";
  const LOCAL_CLOUD_KEY = "three_today_cloud_cfg_v1";
  const LOCAL_AI_KEY = "three_today_ai_cfg_v1";

  function loadAiConfig() {
    try {
      const c = JSON.parse(localStorage.getItem(LOCAL_AI_KEY) || "null");
      return (c && c.apiKey) ? c : null;
    } catch { return null; }
  }

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const arr = v => Array.isArray(v) ? v.map(x => String(x || "").trim()).filter(Boolean) : (v ? [String(v).trim()] : []);
  const linesToArr = s => String(s || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const arrToLines = xs => arr(xs).join("\n");

  function pad(n) { return String(n).padStart(2, "0"); }
  function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function todayKey() { return dateKey(new Date()); }
  function toDate(s) { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); }
  function addDays(s, n) { const d = toDate(s); d.setDate(d.getDate() + n); return dateKey(d); }
  function sundayOf(s) { const d = toDate(s); d.setDate(d.getDate() - d.getDay()); return dateKey(d); }
  function diffDays(a, b) { return Math.round((toDate(b) - toDate(a)) / 86400000); }

  let toastTimer;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  function normalizeEntry(raw, fallbackUserId = "local") {
    const w = raw.word && typeof raw.word === "object" ? raw.word : {};
    const wt = raw.witness && typeof raw.witness === "object" ? raw.witness : {};
    const f = raw.forum && typeof raw.forum === "object" ? raw.forum : null;
    const fName = f ? String(f.name || "").trim() : "";
    const fPts = f ? arr(f.points) : [];
    const fSpeakers = (f && Array.isArray(f.speakers))
      ? f.speakers.map(s => ({ name: String(s.name || "").trim(), points: arr(s.points) })).filter(s => s.name && s.points.length)
      : [];
    const fRaw = f && f.raw ? String(f.raw).trim() : "";
    const hasForum = fName || fPts.length || fSpeakers.length;
    return {
      id: raw.id || null,
      user_id: raw.user_id || fallbackUserId,
      date: raw.entry_date || raw.date,
      covenant: String(raw.covenant || "").trim(),
      ref: String(raw.ref || "").trim(),
      word: {
        ref: String(w.ref || "").trim(),
        title: String(w.title || "").trim(),
        pulpit: arr(w.pulpit),
        field: arr(w.field),
        points: arr(w.points),
      },
      prayer: arr(raw.prayer),
      evangelism: arr(raw.evangelism),
      witness: {
        morning: String(wt.morning || "").trim(),
        day: String(wt.day || "").trim(),
        night: String(wt.night || "").trim(),
        fulfilled: arr(wt.fulfilled),
        answers: arr(wt.answers),
        evangelism: arr(wt.evangelism),
      },
      forum: hasForum ? {
        name: fName,
        points: fPts,
        ...(fSpeakers.length ? { speakers: fSpeakers } : {}),
        ...(fRaw ? { raw: fRaw } : {}),
      } : null,
      share_with_admin: raw.share_with_admin !== false,
    };
  }

  function renderForumBox(f, topMargin = false) {
    if (!f) return "";
    const speakersHtml = (Array.isArray(f.speakers) && f.speakers.length)
      ? `<div class="forum-speakers">${f.speakers.map(s => `
          <div class="speaker-block">
            <div class="speaker-name">${esc(s.name)}</div>
            <ul>${arr(s.points).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
          </div>`).join("")}</div>`
      : `<ul>${arr(f.points).map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
    const rawHtml = f.raw ? `<details class="raw-toggle"><summary>원문 보기</summary><pre>${esc(f.raw)}</pre></details>` : "";
    return `<div class="forum"${topMargin ? ' style="margin-top:10px"' : ""}>${f.name ? `<div class="name">🗣️ ${esc(f.name)}</div>` : ""}${speakersHtml}${rawHtml}</div>`;
  }

  function getCloudConfig() {
    const fileCfg = window.APP_CONFIG || {};
    if (fileCfg.supabaseUrl && fileCfg.supabaseAnonKey) {
      return { url: fileCfg.supabaseUrl.trim(), key: fileCfg.supabaseAnonKey.trim(), source: "file" };
    }
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_CLOUD_KEY) || "null");
      if (saved && saved.url && saved.key) return { url: saved.url.trim(), key: saved.key.trim(), source: "browser" };
    } catch {}
    return null;
  }

  function loadLocalEntries() {
    try {
      const list = JSON.parse(localStorage.getItem(LOCAL_ENTRIES_KEY) || "[]");
      return Array.isArray(list) ? list.map(x => normalizeEntry(x, "local")).filter(x => x.date) : [];
    } catch { return []; }
  }

  function saveLocalEntries(entries) {
    localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(entries));
  }

  function loadLocalProfile() {
    try {
      const p = JSON.parse(localStorage.getItem(LOCAL_PROFILE_KEY) || "null");
      return Object.assign({
        id: "local",
        display_name: "나의 기록",
        group_name: "",
        role: "admin",
        campaign_name: "40일 집중",
        campaign_start: addDays(todayKey(), -39),
      }, p || {});
    } catch {
      return { id: "local", display_name: "나의 기록", group_name: "", role: "admin", campaign_name: "40일 집중", campaign_start: addDays(todayKey(), -39) };
    }
  }

  // ── App State ──
  const state = {
    cloud: null,
    sb: null,
    user: null,
    profile: null,
    authMode: "login",
    authInfo: { has_admin: false, requires_invite: false },
    entries: [],
    homeView: "daily",
    homeMonth: "all",
    witnessFilter: "all",
    page: "home",
    editingDate: null,
    admin: {
      loaded: false,
      profiles: [],
      entries: [],
      settings: { invite_code: "", campaign_name: "40일 집중", campaign_start: addDays(todayKey(), -39) },
      period: "week",
      weekSunday: sundayOf(todayKey()),
      start40: addDays(todayKey(), -39),
      year: new Date().getFullYear(),
      customStart: addDays(todayKey(), -6),
      customEnd: todayKey(),
      groupFilter: "all",
      selectedIds: null, // null = all
      synth: "flow",
    },
  };

  // ── Data Operations ──
  async function init() {
    state.cloud = getCloudConfig();
    if (state.cloud && window.supabase) {
      state.sb = window.supabase.createClient(state.cloud.url, state.cloud.key);
      try {
        const { data } = await state.sb.rpc("auth_info");
        if (data) state.authInfo = data;
      } catch {}
      const { data: { session } } = await state.sb.auth.getSession();
      await onSession(session);
      state.sb.auth.onAuthStateChange(async (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          const pw = prompt("새 비밀번호를 입력해 주세요 (6자 이상):");
          if (pw && pw.length >= 6) {
            const { error } = await state.sb.auth.updateUser({ password: pw });
            toast(error ? error.message : "비밀번호가 변경되었습니다.");
          }
        }
        await onSession(session);
      });
    } else {
      state.profile = loadLocalProfile();
      state.admin.start40 = state.profile.campaign_start || addDays(todayKey(), -39);
      state.admin.settings.campaign_name = state.profile.campaign_name || "40일 집중";
      state.admin.settings.campaign_start = state.admin.start40;
      state.entries = loadLocalEntries().sort((a, b) => b.date.localeCompare(a.date));
      renderAll();
    }
  }

  async function onSession(session) {
    state.user = session?.user || null;
    if (!state.user) {
      state.profile = null;
      state.entries = [];
      state.admin.loaded = false;
      renderAll();
      return;
    }
    const { data: prof } = await state.sb.from("profiles").select("*").eq("id", state.user.id).maybeSingle();
    state.profile = prof || { id: state.user.id, email: state.user.email, display_name: state.user.email.split("@")[0], group_name: "", role: "member" };
    await refreshMyEntries();
    renderAll();
  }

  async function refreshMyEntries() {
    if (!state.sb || !state.user) {
      state.entries = loadLocalEntries().sort((a, b) => b.date.localeCompare(a.date));
      return;
    }
    const { data, error } = await state.sb
      .from("journal_entries")
      .select("*")
      .eq("user_id", state.user.id)
      .order("entry_date", { ascending: false });
    if (error) { toast("기록을 불러오지 못했습니다: " + error.message); return; }
    state.entries = (data || []).map(r => normalizeEntry(r, state.user.id));
  }

  async function upsertEntry(entry) {
    if (!state.sb) {
      const list = loadLocalEntries().filter(x => x.date !== entry.date);
      list.push(normalizeEntry(entry, "local"));
      list.sort((a, b) => b.date.localeCompare(a.date));
      saveLocalEntries(list);
      state.entries = list;
      state.admin.loaded = false;
      return;
    }
    const payload = {
      user_id: state.user.id,
      entry_date: entry.date,
      covenant: entry.covenant,
      ref: entry.ref,
      word: entry.word,
      prayer: entry.prayer,
      evangelism: entry.evangelism,
      witness: entry.witness,
      forum: entry.forum,
      share_with_admin: entry.share_with_admin,
    };
    const { error } = await state.sb
      .from("journal_entries")
      .upsert(payload, { onConflict: "user_id,entry_date" });
    if (error) throw error;
    await refreshMyEntries();
    state.admin.loaded = false;
  }

  async function deleteEntry(date) {
    if (!state.sb) {
      const list = loadLocalEntries().filter(x => x.date !== date);
      saveLocalEntries(list);
      state.entries = list;
      state.admin.loaded = false;
      return;
    }
    const { error } = await state.sb
      .from("journal_entries")
      .delete()
      .eq("user_id", state.user.id)
      .eq("entry_date", date);
    if (error) throw error;
    await refreshMyEntries();
    state.admin.loaded = false;
  }

  async function loadAdminData(force = false) {
    if (!state.sb) {
      state.admin.profiles = [state.profile];
      state.admin.entries = state.entries.filter(e => e.share_with_admin !== false);
      state.admin.loaded = true;
      return;
    }
    if (state.admin.loaded && !force) return;
    const [pRes, eRes, sRes] = await Promise.all([
      state.sb.from("profiles").select("*").order("created_at", { ascending: true }),
      state.sb.from("journal_entries").select("*").eq("share_with_admin", true).order("entry_date", { ascending: false }),
      state.sb.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    if (pRes.error) toast("멤버 목록 오류: " + pRes.error.message);
    if (eRes.error) toast("점검 기록 오류: " + eRes.error.message);
    state.admin.profiles = pRes.data || [];
    state.admin.entries = (eRes.data || []).map(r => normalizeEntry(r, r.user_id));
    if (sRes.data) {
      state.admin.settings = sRes.data;
      if (sRes.data.campaign_start) state.admin.start40 = sRes.data.campaign_start;
    }
    state.admin.loaded = true;
  }

  // ── Render Top-level Routing ──
  function renderAll() {
    const isCloud = !!state.sb;
    const loggedIn = !isCloud || !!state.user;
    const isAdmin = !isCloud || state.profile?.role === "admin";

    $("authView").hidden = loggedIn;
    $("navActions").hidden = !loggedIn;
    $("adminNavBtn").hidden = !isAdmin;

    const badge = $("userBadge");
    if (!isCloud) {
      badge.textContent = state.profile.display_name && state.profile.display_name !== "나의 기록"
        ? `${state.profile.display_name} · 개인 기기` : "개인 기기 모드";
      badge.className = "badge";
    } else if (state.user && state.profile) {
      badge.textContent = state.profile.display_name + (isAdmin ? " · 관리자" : "");
      badge.className = "badge" + (isAdmin ? " admin" : "");
    } else {
      badge.textContent = "클라우드 로그인 필요";
      badge.className = "badge";
    }

    if (!loggedIn) {
      $("homeView").hidden = true;
      $("adminView").hidden = true;
      renderAuth();
      return;
    }

    if (state.page === "admin" && !isAdmin) state.page = "home";
    $("homeView").hidden = state.page !== "home";
    $("adminView").hidden = state.page !== "admin";
    document.querySelectorAll("[data-nav]").forEach(b => {
      b.setAttribute("aria-current", b.dataset.nav === state.page ? "page" : "false");
    });

    if (state.page === "home") renderHome();
    else renderAdmin();
  }

  // ── Auth View ──
  function renderAuth() {
    const isSignup = state.authMode === "signup";
    $("tabLogin").setAttribute("aria-selected", !isSignup);
    $("tabSignup").setAttribute("aria-selected", isSignup);
    $("signupFields").hidden = !isSignup;
    $("authSubmitBtn").textContent = isSignup ? "가입하고 시작하기" : "로그인";
    $("forgotPwBtn").hidden = isSignup;

    const info = state.authInfo || {};
    $("inviteWrap").hidden = !isSignup || !info.has_admin || !info.requires_invite;
    if (isSignup && !info.has_admin) {
      $("authNotice").textContent = "✨ 첫 번째 가입자는 자동으로 관리자(Admin)로 지정됩니다.";
    } else {
      $("authNotice").textContent = "🔒 각자의 3오늘 기록은 본인만 볼 수 있으며 다른 멤버와 공유되지 않습니다.";
    }
  }

  $("tabLogin").onclick = () => { state.authMode = "login"; $("authErr").hidden = true; $("authOk").hidden = true; renderAuth(); };
  $("tabSignup").onclick = () => { state.authMode = "signup"; $("authErr").hidden = true; $("authOk").hidden = true; renderAuth(); };

  $("authForm").onsubmit = async ev => {
    ev.preventDefault();
    const errEl = $("authErr"), okEl = $("authOk");
    errEl.hidden = true; okEl.hidden = true;
    const email = $("authEmail").value.trim();
    const password = $("authPw").value;
    const btn = $("authSubmitBtn");
    btn.disabled = true;
    try {
      if (state.authMode === "login") {
        const { error } = await state.sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const display_name = $("authName").value.trim() || email.split("@")[0];
        const group_name = $("authGroup").value.trim();
        const invite_code = $("authInvite").value.trim();
        const { data, error } = await state.sb.auth.signUp({
          email, password,
          options: { data: { display_name, group_name, invite_code } },
        });
        if (error) throw error;
        if (!data.session) {
          okEl.textContent = "가입 확인 메일을 보냈습니다. 메일함에서 인증 링크를 누른 뒤 로그인해 주세요.";
          okEl.hidden = false;
        }
      }
    } catch (e) {
      let m = e?.message || "오류가 발생했습니다.";
      if (m.includes("초대 코드")) m = "초대 코드가 올바르지 않습니다. 관리자에게 확인해 주세요.";
      else if (m.includes("Invalid login")) m = "이메일 또는 비밀번호가 맞지 않습니다.";
      errEl.textContent = m;
      errEl.hidden = false;
    } finally {
      btn.disabled = false;
    }
  };

  $("forgotPwBtn").onclick = async () => {
    const email = $("authEmail").value.trim();
    if (!email) { $("authErr").textContent = "비밀번호를 찾을 이메일을 먼저 입력해 주세요."; $("authErr").hidden = false; return; }
    const { error } = await state.sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] });
    if (error) { $("authErr").textContent = error.message; $("authErr").hidden = false; }
    else { $("authOk").textContent = "비밀번호 재설정 메일을 보냈습니다."; $("authOk").hidden = false; }
  };

  // ── Home View (My 3오늘 & Witness) ──
  function renderHome() {
    const entries = state.entries;
    const fulCount = entries.reduce((n, e) => n + arr(e.witness.fulfilled).length, 0);
    const ansCount = entries.reduce((n, e) => n + arr(e.witness.answers).length, 0);
    const evgCount = entries.reduce((n, e) => n + arr(e.witness.evangelism).length, 0);
    $("stats").innerHTML = [
      ["기록한 날", entries.length],
      ["✨ 말씀 성취", fulCount],
      ["🙏 기도 응답", ansCount],
      ["🔥 전도 역사", evgCount],
    ].map(([k, v]) => `<div class="stat"><b>${v}</b><small>${k}</small></div>`).join("");

    // 로컬->클라우드 마이그레이션 배너
    const localCount = state.sb ? loadLocalEntries().length : 0;
    $("migrateBanner").hidden = !state.sb || localCount === 0;
    if (localCount > 0 && state.sb) {
      $("migrateText").textContent = `이 기기에 먼저 적어두신 기록 ${localCount}건이 있습니다.`;
    }

    const list = $("list"), wView = $("witnessView"), controls = $("controls");
    if (!entries.length) {
      controls.hidden = true;
      wView.hidden = true;
      list.hidden = false;
      list.innerHTML = `<div class="empty-state"><div class="mark">“</div><h2>첫 기록을 기다리고 있습니다</h2><p>강단에서 받은 오늘의 말씀 · 기도 · 전도를 바로 기록해 보세요.</p><button class="btn-primary" id="emptyWriteBtn" type="button">+ 오늘의 3오늘 기록하기</button></div>`;
      $("emptyWriteBtn").onclick = () => openEditor(todayKey());
      return;
    }

    controls.hidden = false;

    list.innerHTML = entries.map((e, i) => {
      const d = toDate(e.date), w = e.word, wt = e.witness, f = e.forum;
      const wordSub = [w.ref, w.title].filter(Boolean).map(esc).join(" · ");
      const wordPts = arr(w.points).filter(x => !(arr(w.points).length === 1 && !w.ref && x === w.title));
      const pulpitArr = arr(w.pulpit), fieldArr = arr(w.field);
      const srcHtml = (pulpitArr.length || fieldArr.length) ? `<div class="w-src">
        ${pulpitArr.map(x => `<div class="w-src-row"><b>강단</b>${esc(x)}</div>`).join("")}
        ${fieldArr.map(x => `<div class="w-src-row"><b>현장</b>${esc(x)}</div>`).join("")}
      </div>` : "";
      const hasWord = wordSub || wordPts.length || srcHtml;
      const todayHtml = `
        <div class="today">
          <section class="t w"><h3><i>1</i>오늘의 말씀</h3>${wordSub ? `<div class="sub">${wordSub}</div>` : ""}${wordPts.length ? `<ul>${wordPts.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : (!hasWord ? `<div class="empty-txt">아직 기록 없음</div>` : "")}${srcHtml}</section>
          <section class="t p"><h3><i>2</i>오늘의 기도</h3><ul>${arr(e.prayer).length ? arr(e.prayer).map(x => `<li>${esc(x)}</li>`).join("") : `<div class="empty-txt">아직 기록 없음</div>`}</ul></section>
          <section class="t m"><h3><i>3</i>오늘의 전도</h3><ul>${arr(e.evangelism).length ? arr(e.evangelism).map(x => `<li>${esc(x)}</li>`).join("") : `<div class="empty-txt">아직 기록 없음</div>`}</ul></section>
        </div>`;
      const steps = [["🌅 아침 · 언약", wt.morning], ["☀️ 낮 · 근본의 만남", wt.day], ["🌙 밤 · 최고의 작품", wt.night]];
      const hasFlow = steps.some(s => s[1]);
      const notes = [
        ...arr(wt.fulfilled).map(x => ["ful", "말씀 성취", x]),
        ...arr(wt.answers).map(x => ["ans", "기도 응답", x]),
        ...arr(wt.evangelism).map(x => ["evg", "전도 역사", x]),
      ];
      const witnessHtml = (hasFlow || notes.length) ? `
        <div class="block"><h4>오늘의 증거</h4>
          ${hasFlow ? `<div class="flow">${steps.map(([k, v]) => `<div class="step${v ? "" : " empty"}"><div class="k">${k}</div><p>${v ? esc(v) : "—"}</p></div>`).join("")}</div>` : ""}
          ${notes.length ? `<div class="notes" style="margin-top:${hasFlow ? 10 : 0}px">${notes.map(([c, k, v]) => `<div class="note ${c}"><b>${k}</b><span>${esc(v)}</span></div>`).join("")}</div>` : ""}
        </div>` : "";
      const forumHtml = f ? `<div class="block"><h4>포럼</h4>${renderForumBox(f, false)}</div>` : "";
      const privTag = e.share_with_admin === false ? `<span class="priv-tag">🔒 나만 보기</span>` : "";

      return `
        <article class="entry${i === 0 ? " open" : ""}" id="d${e.date}" data-month="${e.date.slice(0, 7)}" style="animation-delay:${Math.min(i, 6) * 45}ms">
          <button class="head" aria-expanded="${i === 0}">
            <div class="date${d.getDay() === 0 ? " sun" : ""}"><span class="d">${d.getDate()}</span><span class="s">${d.getMonth() + 1}월 · ${WD[d.getDay()]}</span></div>
            <div class="cov"><q>${esc(e.covenant || w.title || "오늘의 언약")}</q><div class="cov-meta">${e.ref || w.ref ? `<span class="ref">${esc(e.ref || w.ref)}</span>` : ""}${privTag}</div></div>
            <span class="chev" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg></span>
          </button>
          <div class="body"><div><div class="inner">${todayHtml}${witnessHtml}${forumHtml}
            <div class="card-foot">
              <button class="mini-btn" type="button" data-edit="${e.date}">✏️ 수정 · 이어쓰기</button>
              <button class="mini-btn del" type="button" data-del="${e.date}">삭제</button>
            </div>
          </div></div></div>
        </article>`;
    }).join("");

    // 월별 칩
    const months = [...new Set(entries.map(e => e.date.slice(0, 7)))];
    const nav = $("months");
    if (months.length > 1) {
      if (state.homeMonth !== "all" && !months.includes(state.homeMonth)) state.homeMonth = "all";
      nav.innerHTML = [["all", "전체"], ...months.map(m => [m, `${+m.slice(0, 4)}년 ${+m.slice(5)}월`])]
        .map(([v, t]) => `<button class="chip" data-m="${v}" aria-pressed="${state.homeMonth === v}">${t}</button>`).join("");
      nav.hidden = false;
    } else {
      state.homeMonth = "all";
      nav.innerHTML = "";
      nav.hidden = true;
    }

    applyHomeFilters();
  }

  function applyHomeFilters() {
    $("list").querySelectorAll(".entry").forEach(a => {
      a.hidden = state.homeMonth !== "all" && a.dataset.month !== state.homeMonth;
    });
    $("controls").querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", t.dataset.view === state.homeView));
    $("list").hidden = state.homeView !== "daily";
    $("witnessView").hidden = state.homeView !== "witness";
    if (state.homeView === "witness") renderHomeWitness();
  }

  function renderHomeWitness() {
    const groups = new Map();
    const wf = state.witnessFilter || "all";
    for (const e of state.entries) {
      const ym = e.date.slice(0, 7);
      if (state.homeMonth !== "all" && ym !== state.homeMonth) continue;
      const wt = e.witness;
      const items = [
        ...arr(wt.fulfilled).map(x => ["ful", "말씀 성취", x]),
        ...arr(wt.answers).map(x => ["ans", "기도 응답", x]),
        ...arr(wt.evangelism).map(x => ["evg", "전도 역사", x]),
        ...(wt.night ? [["night", "최고의 작품", wt.night]] : []),
      ].filter(([cls]) => wf === "all" || cls === wf);
      if (!items.length) continue;
      if (!groups.has(ym)) groups.set(ym, []);
      for (const it of items) groups.get(ym).push({ date: e.date, item: it });
    }
    const filterBar = `<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:20px">
      ${[["all", "전체"], ["ful", "✨ 말씀 성취"], ["ans", "🙏 기도 응답"], ["evg", "🔥 전도 역사"], ["night", "🌙 최고의 작품"]]
        .map(([v, t]) => `<button class="chip" data-wf="${v}" aria-pressed="${wf === v}">${t}</button>`).join("")}
    </div>`;
    const wv = $("witnessView");
    if (!groups.size) {
      wv.innerHTML = filterBar + `<p style="text-align:center;color:var(--muted);padding:24px 0">아직 모아진 기록이 없습니다.</p>`;
      return;
    }
    wv.innerHTML = filterBar + [...groups.entries()].map(([ym, rows]) => `
      <div class="w-group">
        <h3>${+ym.slice(0, 4)}년 ${+ym.slice(5)}월</h3>
        <div class="w-items">${rows.map(({ date, item: [cls, label, text] }) => {
          const d = toDate(date);
          return `<div class="w-item"><span class="w-tag ${cls}">${label}</span><button class="w-date" data-jump="${date}">${d.getMonth() + 1}/${d.getDate()} (${WD[d.getDay()]})</button><span>${esc(text)}</span></div>`;
        }).join("")}</div>
      </div>`).join("");
  }

  $("list").addEventListener("click", async ev => {
    const editBtn = ev.target.closest("[data-edit]");
    if (editBtn) { openEditor(editBtn.dataset.edit, "fields"); return; }
    const delBtn = ev.target.closest("[data-del]");
    if (delBtn) {
      const d = delBtn.dataset.del;
      if (!confirm(`${d} 기록을 삭제할까요?`)) return;
      try { await deleteEntry(d); renderAll(); toast("기록이 삭제되었습니다."); }
      catch (e) { toast("삭제 실패: " + e.message); }
      return;
    }
    const h = ev.target.closest(".head");
    if (h) {
      const a = h.parentElement, open = a.classList.toggle("open");
      h.setAttribute("aria-expanded", open);
    }
  });

  $("controls").addEventListener("click", ev => {
    const tab = ev.target.closest(".tab");
    if (tab) { state.homeView = tab.dataset.view; applyHomeFilters(); return; }
    const chip = ev.target.closest(".chip");
    if (chip) {
      state.homeMonth = chip.dataset.m;
      $("months").querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x === chip));
      applyHomeFilters();
    }
  });

  $("witnessView").addEventListener("click", ev => {
    const wf = ev.target.closest("[data-wf]");
    if (wf) { state.witnessFilter = wf.dataset.wf; renderHomeWitness(); return; }
    const b = ev.target.closest("[data-jump]");
    if (!b) return;
    state.homeView = "daily";
    applyHomeFilters();
    const card = document.getElementById("d" + b.dataset.jump);
    if (card) { card.hidden = false; card.classList.add("open"); card.scrollIntoView({ behavior: "smooth", block: "center" }); }
  });

  $("migrateBtn").onclick = async () => {
    const localList = loadLocalEntries();
    if (!localList.length || !state.sb || !state.user) return;
    $("migrateBtn").disabled = true;
    try {
      const rows = localList.map(e => ({
        user_id: state.user.id,
        entry_date: e.date,
        covenant: e.covenant,
        ref: e.ref,
        word: e.word,
        prayer: e.prayer,
        evangelism: e.evangelism,
        witness: e.witness,
        forum: e.forum,
        share_with_admin: e.share_with_admin,
      }));
      const { error } = await state.sb.from("journal_entries").upsert(rows, { onConflict: "user_id,entry_date" });
      if (error) throw error;
      localStorage.removeItem(LOCAL_ENTRIES_KEY);
      await refreshMyEntries();
      renderAll();
      toast(`${rows.length}건의 기록을 내 클라우드 노트로 옮겼습니다.`);
    } catch (e) {
      toast("옮기기 실패: " + e.message);
    } finally {
      $("migrateBtn").disabled = false;
    }
  };

  // ── Editor Modal ──
  let editorForumRaw = "";

  function updateAiPill() {
    const aiCfg = loadAiConfig();
    const pill = $("editorAiPill");
    if (!pill) return;
    pill.textContent = aiCfg?.apiKey ? `✨ AI 문맥 정리 (${aiCfg.provider === "openai" ? "OpenAI" : "Gemini"})` : "⚡ 기본 정리 · AI 연결";
  }

  function setEditorMode(mode) {
    const isPaste = mode === "paste";
    $("pastePane").hidden = !isPaste;
    $("editorForm").hidden = isPaste;
    $("editorModeTabs").querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", t.dataset.edMode === mode));
  }

  function fillFieldsFromEntry(data, date) {
    const existing = state.entries.find(x => x.date === date);
    state.editingDate = existing ? date : null;
    $("editorTitle").textContent = existing ? `${date} 기록 수정 · 이어쓰기` : "오늘의 3오늘 기록";
    $("editorDelBtn").hidden = !existing;
    $("fDate").value = date;
    $("fRef").value = data?.ref || "";
    $("fCovenant").value = data?.covenant || "";
    $("fWordRef").value = data?.word?.ref || "";
    $("fWordTitle").value = data?.word?.title || "";
    $("fWordPulpit").value = arrToLines(data?.word?.pulpit);
    $("fWordField").value = arrToLines(data?.word?.field);
    $("fWordPoints").value = arrToLines(data?.word?.points);
    $("fPrayer").value = arrToLines(data?.prayer);
    $("fEvg").value = arrToLines(data?.evangelism);
    $("fMorning").value = data?.witness?.morning || "";
    $("fDay").value = data?.witness?.day || "";
    $("fNight").value = data?.witness?.night || "";
    $("fFulfilled").value = arrToLines(data?.witness?.fulfilled);
    $("fAnswers").value = arrToLines(data?.witness?.answers);
    $("fWitnessEvg").value = arrToLines(data?.witness?.evangelism);
    $("fForumName").value = data?.forum?.name || "";
    $("fForumPoints").value = window.JournalParser
      ? window.JournalParser.formatForumTextarea(data?.forum)
      : arrToLines(data?.forum?.points);
    editorForumRaw = data?.forum?.raw || "";
    $("fPrivate").checked = data ? data.share_with_admin === false : false;
  }

  function fillEditorForDate(date) {
    fillFieldsFromEntry(state.entries.find(x => x.date === date) || null, date);
  }

  const uniq = xs => [...new Set(arr(xs))];

  function mergeParsedWithExisting(parsed, isPrivate) {
    const existing = state.entries.find(x => x.date === parsed.date);
    const mergedWord = {
      ref: parsed.word?.ref || existing?.word?.ref || "",
      title: parsed.word?.title || existing?.word?.title || "",
      pulpit: uniq([...(existing?.word?.pulpit || []), ...(parsed.word?.pulpit || [])]),
      field: uniq([...(existing?.word?.field || []), ...(parsed.word?.field || [])]),
      points: (parsed.word?.points?.length ? parsed.word.points : existing?.word?.points) || [],
    };
    const mergedWitness = {
      morning: parsed.witness?.morning || existing?.witness?.morning || "",
      day: parsed.witness?.day || existing?.witness?.day || "",
      night: parsed.witness?.night || existing?.witness?.night || "",
      fulfilled: uniq([...(existing?.witness?.fulfilled || []), ...(parsed.witness?.fulfilled || [])]),
      answers: uniq([...(existing?.witness?.answers || []), ...(parsed.witness?.answers || [])]),
      evangelism: uniq([...(existing?.witness?.evangelism || []), ...(parsed.witness?.evangelism || [])]),
    };

    if (parsed.kind === "forum") {
      return {
        date: parsed.date,
        covenant: existing?.covenant || parsed.covenantHint || "",
        ref: existing?.ref || parsed.ref || "",
        word: mergedWord,
        prayer: existing?.prayer || [],
        evangelism: existing?.evangelism || [],
        witness: mergedWitness,
        forum: parsed.forum,
        share_with_admin: existing ? existing.share_with_admin && !isPrivate : !isPrivate,
      };
    }
    return {
      date: parsed.date,
      covenant: parsed.covenant || existing?.covenant || "",
      ref: parsed.ref || existing?.ref || "",
      word: mergedWord,
      prayer: parsed.prayer?.length ? parsed.prayer : (existing?.prayer || []),
      evangelism: parsed.evangelism?.length ? parsed.evangelism : (existing?.evangelism || []),
      witness: mergedWitness,
      forum: parsed.forum || existing?.forum || null,
      share_with_admin: existing ? existing.share_with_admin && !isPrivate : !isPrivate,
    };
  }

  async function runSmartParse(txt) {
    const aiCfg = loadAiConfig();
    if (aiCfg?.apiKey && window.JournalParser?.parseWithAI) {
      try {
        return { parsed: await window.JournalParser.parseWithAI(txt, aiCfg), usedAi: true };
      } catch (e) {
        toast(`AI 연결 오류로 기본 정리로 진행합니다 (${e.message})`);
      }
    }
    return { parsed: window.JournalParser.parseSubmission(txt), usedAi: false };
  }

  function openEditor(date = todayKey(), mode = "paste") {
    $("rawPasteInput").value = "";
    $("pastePrivate").checked = false;
    $("pasteDetectBadge").textContent = "내용을 붙여넣으면 자동으로 인식합니다";
    updateAiPill();
    fillEditorForDate(date);
    setEditorMode(mode);
    $("editorModal").hidden = false;
  }

  $("editorAiPill").onclick = () => { $("editorModal").hidden = true; openSettings(); };

  $("editorModeTabs").addEventListener("click", ev => {
    const t = ev.target.closest(".tab");
    if (t) setEditorMode(t.dataset.edMode);
  });

  $("rawPasteInput").addEventListener("input", () => {
    const txt = $("rawPasteInput").value.trim();
    if (!txt || !window.JournalParser) {
      $("pasteDetectBadge").textContent = "내용을 붙여넣으면 자동으로 인식합니다";
      return;
    }
    const p = window.JournalParser.parseSubmission(txt);
    if (!p) return;
    if (p.kind === "forum") {
      const cnt = p.forum?.speakers?.length || 0;
      $("pasteDetectBadge").textContent = `인식됨: ${p.date} · 팀 포럼 (${cnt}명 요약)`;
    } else if (p.kind === "both") {
      $("pasteDetectBadge").textContent = `인식됨: ${p.date} · 3오늘 + 팀 포럼`;
    } else {
      $("pasteDetectBadge").textContent = `인식됨: ${p.date} · 3오늘${p.author ? ` (${p.author})` : ""}`;
    }
  });

  $("parseToFieldsBtn").onclick = async () => {
    const txt = $("rawPasteInput").value.trim();
    if (!txt) { toast("붙여넣을 내용을 먼저 입력해 주세요."); return; }
    const btn = $("parseToFieldsBtn"), old = btn.textContent;
    btn.disabled = true; btn.textContent = "정리 중…";
    try {
      const { parsed, usedAi } = await runSmartParse(txt);
      const merged = mergeParsedWithExisting(parsed, $("pastePrivate").checked);
      fillFieldsFromEntry(merged, merged.date);
      setEditorMode("fields");
      toast(`${merged.date} 기록을 ${usedAi ? "AI로 " : ""}정리했습니다. 확인 후 저장해 주세요.`);
    } finally {
      btn.disabled = false; btn.textContent = old;
    }
  };

  $("parseAndSaveBtn").onclick = async () => {
    const txt = $("rawPasteInput").value.trim();
    if (!txt) { toast("붙여넣을 내용을 먼저 입력해 주세요."); return; }
    const btn = $("parseAndSaveBtn"), old = btn.textContent;
    btn.disabled = true; btn.textContent = "정리 및 저장 중…";
    try {
      const { parsed } = await runSmartParse(txt);
      const hadExisting = state.entries.some(x => x.date === parsed.date);
      const entry = mergeParsedWithExisting(parsed, $("pastePrivate").checked);
      await upsertEntry(entry);
      $("editorModal").hidden = true;
      state.page = "home";
      state.homeView = "daily";
      renderAll();
      toast(hadExisting ? `${entry.date} 기존 기록에 합쳐 저장했습니다.` : `${entry.date} 기록이 정리되어 저장되었습니다.`);
    } catch (e) {
      toast("저장 실패: " + e.message);
    } finally {
      btn.disabled = false; btn.textContent = old;
    }
  };

  $("fDate").addEventListener("change", () => {
    const d = $("fDate").value;
    if (d && state.entries.some(x => x.date === d)) fillEditorForDate(d);
  });

  $("editorForm").onsubmit = async ev => {
    ev.preventDefault();
    const date = $("fDate").value;
    if (!date) return;
    const fName = $("fForumName").value.trim();
    const forumObj = window.JournalParser
      ? window.JournalParser.parseForumTextarea(fName, $("fForumPoints").value, editorForumRaw)
      : ((fName || linesToArr($("fForumPoints").value).length) ? { name: fName, points: linesToArr($("fForumPoints").value) } : null);
    const entry = {
      date,
      covenant: $("fCovenant").value.trim(),
      ref: $("fRef").value.trim(),
      word: {
        ref: $("fWordRef").value.trim(),
        title: $("fWordTitle").value.trim(),
        pulpit: linesToArr($("fWordPulpit").value),
        field: linesToArr($("fWordField").value),
        points: linesToArr($("fWordPoints").value),
      },
      prayer: linesToArr($("fPrayer").value),
      evangelism: linesToArr($("fEvg").value),
      witness: {
        morning: $("fMorning").value.trim(),
        day: $("fDay").value.trim(),
        night: $("fNight").value.trim(),
        fulfilled: linesToArr($("fFulfilled").value),
        answers: linesToArr($("fAnswers").value),
        evangelism: linesToArr($("fWitnessEvg").value),
      },
      forum: forumObj,
      share_with_admin: !$("fPrivate").checked,
    };
    $("editorSaveBtn").disabled = true;
    try {
      await upsertEntry(entry);
      $("editorModal").hidden = true;
      state.page = "home";
      state.homeView = "daily";
      renderAll();
      toast(`${date} 기록이 저장되었습니다.`);
    } catch (e) {
      toast("저장 실패: " + e.message);
    } finally {
      $("editorSaveBtn").disabled = false;
    }
  };

  $("editorDelBtn").onclick = async () => {
    const d = $("fDate").value;
    if (!d || !confirm(`${d} 기록을 삭제할까요?`)) return;
    try {
      await deleteEntry(d);
      $("editorModal").hidden = true;
      renderAll();
      toast("기록이 삭제되었습니다.");
    } catch (e) {
      toast("삭제 실패: " + e.message);
    }
  };

  // ── Admin Check-in Workbench ──
  function getAdminRange() {
    const a = state.admin;
    if (a.period === "week") return { start: a.weekSunday, end: addDays(a.weekSunday, 6), label: `${a.weekSunday} ~ ${addDays(a.weekSunday, 6)} (한 주)` };
    if (a.period === "40") return { start: a.start40, end: addDays(a.start40, 39), label: `${a.start40} ~ ${addDays(a.start40, 39)} (40일)` };
    if (a.period === "year") return { start: `${a.year}-01-01`, end: `${a.year}-12-31`, label: `${a.year}년 (한 해)` };
    const s = a.customStart <= a.customEnd ? a.customStart : a.customEnd;
    const e = a.customStart <= a.customEnd ? a.customEnd : a.customStart;
    return { start: s, end: e, label: `${s} ~ ${e}` };
  }

  function getFilteredAdminContext() {
    const a = state.admin;
    const range = getAdminRange();
    const profileMap = new Map(a.profiles.map(p => [p.id, p]));
    const visibleProfiles = a.profiles.filter(p => a.groupFilter === "all" || (p.group_name || "") === a.groupFilter);
    const activeIds = a.selectedIds
      ? new Set(visibleProfiles.filter(p => a.selectedIds.has(p.id)).map(p => p.id))
      : new Set(visibleProfiles.map(p => p.id));

    const entries = a.entries
      .filter(e => e.date >= range.start && e.date <= range.end && activeIds.has(e.user_id))
      .sort((x, y) => y.date.localeCompare(x.date));

    return { range, profileMap, visibleProfiles, activeIds, entries };
  }

  async function renderAdmin() {
    await loadAdminData();
    const isCloud = !!state.sb;
    $("adminLocalBanner").hidden = isCloud;
    $("adminManageBtn").hidden = !isCloud;

    const a = state.admin;
    $("periodTabs").querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", t.dataset.period === a.period));
    $("synthTabs").querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", t.dataset.synth === a.synth));

    // Period range controls
    const pr = $("periodRangeControls");
    if (a.period === "week") {
      const sat = addDays(a.weekSunday, 6);
      pr.innerHTML = `
        <button class="btn-secondary" id="prevWeekBtn" type="button">‹ 이전 주</button>
        <strong>${a.weekSunday} (주일) ~ ${sat.slice(5)} (토)</strong>
        <button class="btn-secondary" id="thisWeekBtn" type="button">이번 주</button>
        <button class="btn-secondary" id="nextWeekBtn" type="button">다음 주 ›</button>`;
      $("prevWeekBtn").onclick = () => { a.weekSunday = addDays(a.weekSunday, -7); renderAdmin(); };
      $("thisWeekBtn").onclick = () => { a.weekSunday = sundayOf(todayKey()); renderAdmin(); };
      $("nextWeekBtn").onclick = () => { a.weekSunday = addDays(a.weekSunday, 7); renderAdmin(); };
    } else if (a.period === "40") {
      const end40 = addDays(a.start40, 39);
      const dayNum = diffDays(a.start40, todayKey()) + 1;
      const dayBadge = (dayNum >= 1 && dayNum <= 40) ? `<span class="badge admin">오늘 Day ${dayNum}/40</span>` : "";
      pr.innerHTML = `
        <label style="font-size:13px;color:var(--muted)">시작일</label>
        <input type="date" id="start40Input" value="${a.start40}">
        <span>~ <b>${end40}</b></span>
        ${dayBadge}
        <button class="btn-secondary" id="save40Btn" type="button">기준일 저장</button>`;
      $("start40Input").onchange = ev => { if (ev.target.value) { a.start40 = ev.target.value; renderAdmin(); } };
      $("save40Btn").onclick = async () => {
        if (state.sb) {
          const { error } = await state.sb.from("app_settings").update({ campaign_start: a.start40 }).eq("id", 1);
          if (error) { toast("저장 실패: " + error.message); return; }
        } else {
          const lp = loadLocalProfile(); lp.campaign_start = a.start40;
          localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(lp));
        }
        toast("40일 점검 시작일이 저장되었습니다.");
      };
    } else if (a.period === "year") {
      pr.innerHTML = `
        <button class="btn-secondary" id="prevYearBtn" type="button">‹ ${a.year - 1}</button>
        <strong style="font-size:16px">${a.year}년</strong>
        <button class="btn-secondary" id="nextYearBtn" type="button">${a.year + 1} ›</button>`;
      $("prevYearBtn").onclick = () => { a.year--; renderAdmin(); };
      $("nextYearBtn").onclick = () => { a.year++; renderAdmin(); };
    } else {
      pr.innerHTML = `
        <input type="date" id="customStartIn" value="${a.customStart}">
        <span>~</span>
        <input type="date" id="customEndIn" value="${a.customEnd}">`;
      $("customStartIn").onchange = ev => { if (ev.target.value) { a.customStart = ev.target.value; renderAdmin(); } };
      $("customEndIn").onchange = ev => { if (ev.target.value) { a.customEnd = ev.target.value; renderAdmin(); } };
    }

    // Member filter bar
    const groups = [...new Set(a.profiles.map(p => p.group_name || "").filter(Boolean))];
    const { range, profileMap, visibleProfiles, activeIds, entries } = getFilteredAdminContext();
    const mb = $("memberFilterBar");
    const groupHtml = groups.length ? `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        ${[["all", "전체 팀"], ...groups.map(g => [g, g])].map(([v, t]) =>
          `<button class="chip" data-adm-group="${esc(v)}" aria-pressed="${a.groupFilter === v}">${esc(t)}</button>`
        ).join("")}
      </div>` : "";
    const memberHtml = visibleProfiles.length > 1 ? `
      <div class="member-chips">
        <button class="mchip" data-adm-all="1" aria-pressed="${!a.selectedIds}">전체 선택 (${visibleProfiles.length})</button>
        ${visibleProfiles.map(p => `<button class="mchip" data-adm-member="${p.id}" aria-pressed="${activeIds.has(p.id)}">${esc(p.display_name)}${p.group_name ? ` · ${esc(p.group_name)}` : ""}</button>`).join("")}
      </div>` : "";
    mb.innerHTML = `
      <div class="member-bar-top">
        <span>조합할 멤버 (${activeIds.size}명 선택됨)</span>
      </div>
      ${groupHtml}${memberHtml}`;
    mb.hidden = visibleProfiles.length <= 1 && !groups.length;

    // KPIs
    const activeMembersWithEntries = new Set(entries.map(e => e.user_id)).size;
    const witnessCount = entries.reduce((n, e) => n + arr(e.witness.fulfilled).length + arr(e.witness.answers).length + arr(e.witness.evangelism).length, 0);
    const forumCount = entries.filter(e => e.forum).length;
    $("adminKpis").innerHTML = [
      ["총 기록", entries.length],
      ["기록 참여 인원", `${activeMembersWithEntries}/${activeIds.size}`],
      ["성취 · 응답 · 전도", witnessCount],
      ["포럼 나눔", forumCount],
    ].map(([k, v]) => `<div class="kpi"><b>${v}</b><small>${k}</small></div>`).join("");

    // Matrix
    renderAdminMatrix(range, visibleProfiles.filter(p => activeIds.has(p.id)), entries);

    // Synthesis Report
    renderAdminSynth(range, profileMap, visibleProfiles.filter(p => activeIds.has(p.id)), entries);
  }

  function renderAdminMatrix(range, members, entries) {
    const a = state.admin;
    const byUserDate = new Map();
    for (const e of entries) byUserDate.set(`${e.user_id}|${e.date}`, e);
    const wrap = $("adminMatrix");
    if (!members.length) { wrap.innerHTML = `<p style="color:var(--muted)">선택된 멤버가 없습니다.</p>`; return; }

    if (a.period === "week") {
      $("matrixTitle").textContent = "한 주 참여 현황 (주일 ~ 토)";
      const days = Array.from({ length: 7 }, (_, i) => addDays(range.start, i));
      wrap.innerHTML = `<table class="matrix"><thead><tr><th>멤버</th>${days.map(d => `<th>${d.slice(5).replace("-", "/")}<br>${WD[toDate(d).getDay()]}</th>`).join("")}<th>기록</th><th>증거</th></tr></thead><tbody>
        ${members.map(m => {
          const me = entries.filter(e => e.user_id === m.id);
          const wc = me.reduce((n, e) => n + arr(e.witness.fulfilled).length + arr(e.witness.answers).length + arr(e.witness.evangelism).length, 0);
          return `<tr><td>${esc(m.display_name)}</td>${days.map(d => {
            const hit = byUserDate.get(`${m.id}|${d}`);
            return `<td><span class="dot${hit ? " on" : ""}" title="${hit ? esc(hit.covenant || "기록됨") : "미기록"}"></span></td>`;
          }).join("")}<td><b>${me.length}</b>/7</td><td>${wc}</td></tr>`;
        }).join("")}</tbody></table>`;
    } else if (a.period === "40") {
      $("matrixTitle").textContent = "40일 집중 현황 (Day 1 ~ Day 40)";
      const days = Array.from({ length: 40 }, (_, i) => addDays(range.start, i));
      wrap.innerHTML = `<table class="matrix"><thead><tr><th>멤버</th><th style="text-align:left">40일 기록 흐름</th><th>달성</th><th>성취·응답·전도</th></tr></thead><tbody>
        ${members.map(m => {
          const me = entries.filter(e => e.user_id === m.id);
          const wc = me.reduce((n, e) => n + arr(e.witness.fulfilled).length + arr(e.witness.answers).length + arr(e.witness.evangelism).length, 0);
          const strip = `<div class="strip40">${days.map((d, i) => `<span class="cell40${byUserDate.has(`${m.id}|${d}`) ? " on" : ""}" title="Day ${i + 1} (${d})"></span>`).join("")}</div>`;
          return `<tr><td>${esc(m.display_name)}</td><td>${strip}</td><td><b>${me.length}</b>/40 (${Math.round(me.length / 40 * 100)}%)</td><td>${wc}</td></tr>`;
        }).join("")}</tbody></table>`;
    } else if (a.period === "year") {
      $("matrixTitle").textContent = `${a.year}년 월별 참여 현황`;
      const ms = Array.from({ length: 12 }, (_, i) => `${a.year}-${pad(i + 1)}`);
      wrap.innerHTML = `<table class="matrix"><thead><tr><th>멤버</th>${ms.map((_, i) => `<th>${i + 1}월</th>`).join("")}<th>합계</th><th>증거</th></tr></thead><tbody>
        ${members.map(m => {
          const me = entries.filter(e => e.user_id === m.id);
          const wc = me.reduce((n, e) => n + arr(e.witness.fulfilled).length + arr(e.witness.answers).length + arr(e.witness.evangelism).length, 0);
          return `<tr><td>${esc(m.display_name)}</td>${ms.map(ym => {
            const c = me.filter(e => e.date.startsWith(ym)).length;
            return `<td>${c || "·"}</td>`;
          }).join("")}<td><b>${me.length}</b></td><td>${wc}</td></tr>`;
        }).join("")}</tbody></table>`;
    } else {
      $("matrixTitle").textContent = `기간 참여 현황 (${range.start} ~ ${range.end})`;
      wrap.innerHTML = `<table class="matrix"><thead><tr><th>멤버</th><th>기록 일수</th><th>성취 · 응답 · 전도</th><th>포럼</th></tr></thead><tbody>
        ${members.map(m => {
          const me = entries.filter(e => e.user_id === m.id);
          const wc = me.reduce((n, e) => n + arr(e.witness.fulfilled).length + arr(e.witness.answers).length + arr(e.witness.evangelism).length, 0);
          const fc = me.filter(e => e.forum).length;
          return `<tr><td>${esc(m.display_name)}</td><td><b>${me.length}</b>일</td><td>${wc}</td><td>${fc}</td></tr>`;
        }).join("")}</tbody></table>`;
    }
  }

  function renderAdminSynth(range, profileMap, members, entries) {
    const out = $("adminReport");
    if (!entries.length) {
      out.innerHTML = `<div class="empty-state"><div class="mark">“</div><h2>이 기간에 공유된 기록이 없습니다</h2><p>기간이나 멤버 선택을 바꾸어 확인해 보세요.</p></div>`;
      return;
    }
    const who = uid => {
      const p = profileMap.get(uid);
      return p ? `${esc(p.display_name)}${p.group_name ? ` <small>${esc(p.group_name)}</small>` : ""}` : "멤버";
    };
    const renderEntryCard = e => {
      const wt = e.witness;
      const notes = [
        ...arr(wt.fulfilled).map(x => ["ful", "말씀 성취", x]),
        ...arr(wt.answers).map(x => ["ans", "기도 응답", x]),
        ...arr(wt.evangelism).map(x => ["evg", "전도 역사", x]),
      ];
      const d = toDate(e.date);
      return `<article class="report-card">
        <div class="report-meta">
          <div class="report-who">${who(e.user_id)}</div>
          <span style="font-size:13px;color:var(--muted)">${e.date} (${WD[d.getDay()]})</span>
        </div>
        ${e.covenant ? `<div class="report-cov">“${esc(e.covenant)}” ${e.ref ? `<span style="font-size:13px;color:var(--word);font-family:var(--sans);font-weight:600">${esc(e.ref)}</span>` : ""}</div>` : ""}
        <div class="report-cols">
          <div class="report-col w"><b>오늘의 말씀${e.word.title ? ` · ${esc(e.word.title)}` : ""}</b>${arr(e.word.pulpit).map(x => `<div>⛪ ${esc(x)}</div>`).join("")}${arr(e.word.field).map(x => `<div>🌿 ${esc(x)}</div>`).join("")}${arr(e.word.points).map(x => `<div>• ${esc(x)}</div>`).join("") || (!arr(e.word.pulpit).length && !arr(e.word.field).length ? "<span style='color:var(--muted)'>—</span>" : "")}</div>
          <div class="report-col p"><b>오늘의 기도</b>${arr(e.prayer).map(x => `<div>• ${esc(x)}</div>`).join("") || "<span style='color:var(--muted)'>—</span>"}</div>
          <div class="report-col m"><b>오늘의 전도</b>${arr(e.evangelism).map(x => `<div>• ${esc(x)}</div>`).join("") || "<span style='color:var(--muted)'>—</span>"}</div>
        </div>
        ${(wt.morning || wt.day || wt.night) ? `<div class="flow" style="margin-top:10px">
          <div class="step${wt.morning ? "" : " empty"}"><div class="k">🌅 아침</div><p>${wt.morning ? esc(wt.morning) : "—"}</p></div>
          <div class="step${wt.day ? "" : " empty"}"><div class="k">☀️ 낮 · 만남</div><p>${wt.day ? esc(wt.day) : "—"}</p></div>
          <div class="step${wt.night ? "" : " empty"}"><div class="k">🌙 밤 · 작품</div><p>${wt.night ? esc(wt.night) : "—"}</p></div>
        </div>` : ""}
        ${notes.length ? `<div class="notes" style="margin-top:10px">${notes.map(([c, k, v]) => `<div class="note ${c}"><b>${k}</b><span>${esc(v)}</span></div>`).join("")}</div>` : ""}
        ${renderForumBox(e.forum, true)}
      </article>`;
    };

    const synth = state.admin.synth;
    if (synth === "flow") {
      out.innerHTML = entries.map(renderEntryCard).join("");
    } else if (synth === "witness") {
      const buckets = [
        ["✨ 성취된 말씀", "ful", e => arr(e.witness.fulfilled)],
        ["🙏 기도 응답", "ans", e => arr(e.witness.answers)],
        ["🔥 전도 역사", "evg", e => arr(e.witness.evangelism)],
        ["🌙 최고의 작품", "night", e => e.witness.night ? [e.witness.night] : []],
        ["🤝 낮 · 근본의 만남", "night", e => e.witness.day ? [e.witness.day] : []],
      ];
      const sections = buckets.map(([title, cls, pick]) => {
        const rows = entries.flatMap(e => pick(e).map(text => ({ e, text })));
        if (!rows.length) return "";
        return `<div class="w-group"><h3>${title} (${rows.length})</h3><div class="w-items">
          ${rows.map(({ e, text }) => `<div class="w-item"><span class="w-tag ${cls}">${esc(profileMap.get(e.user_id)?.display_name || "멤버")}</span><span class="w-date">${e.date.slice(5)}</span><span>${esc(text)}</span></div>`).join("")}
        </div></div>`;
      }).filter(Boolean);
      out.innerHTML = sections.length
        ? `<div class="witness-wrap">${sections.join("")}</div>`
        : `<div class="empty-state"><h2>아직 모아진 증거 기록이 없습니다</h2></div>`;
    } else if (synth === "forum") {
      const rows = entries.filter(e => e.covenant || e.forum);
      out.innerHTML = rows.map(e => `<article class="report-card">
        <div class="report-meta"><div class="report-who">${who(e.user_id)}</div><span style="font-size:13px;color:var(--muted)">${e.date}</span></div>
        ${e.covenant ? `<div style="font-family:var(--serif);font-size:17px;margin-bottom:8px">📖 “${esc(e.covenant)}” ${e.ref ? `<small style="color:var(--word);font-family:var(--sans)">(${esc(e.ref)})</small>` : ""}</div>` : ""}
        ${renderForumBox(e.forum, false)}
      </article>`).join("");
    } else {
      out.innerHTML = members.map(m => {
        const me = entries.filter(e => e.user_id === m.id);
        return `<div class="panel">
          <div class="report-meta" style="margin-bottom:14px">
            <div class="report-who" style="font-size:18px">${esc(m.display_name)}${m.group_name ? ` <small>${esc(m.group_name)}</small>` : ""}</div>
            <span class="badge">${me.length}일 기록</span>
          </div>
          ${me.length ? me.map(e => {
            const items = [
              ...arr(e.witness.fulfilled).map(x => `✨ ${x}`),
              ...arr(e.witness.answers).map(x => `🙏 ${x}`),
              ...arr(e.witness.evangelism).map(x => `🔥 ${x}`),
            ];
            return `<div style="padding:10px 0;border-bottom:1px solid var(--line)">
              <div style="font-size:13px;color:var(--muted)">${e.date} (${WD[toDate(e.date).getDay()]})${e.ref ? ` · ${esc(e.ref)}` : ""}</div>
              ${e.covenant ? `<div style="font-family:var(--serif);font-size:16px;margin:2px 0">“${esc(e.covenant)}”</div>` : ""}
              ${items.length ? `<div style="font-size:13.5px;color:var(--ink-2);margin-top:4px">${items.map(esc).join(" / ")}</div>` : ""}
            </div>`;
          }).join("") : `<p style="color:var(--muted);font-size:14px">이 기간 기록이 없습니다.</p>`}
        </div>`;
      }).join("");
    }
  }

  $("periodTabs").addEventListener("click", ev => {
    const t = ev.target.closest(".tab");
    if (t) { state.admin.period = t.dataset.period; renderAdmin(); }
  });
  $("synthTabs").addEventListener("click", ev => {
    const t = ev.target.closest(".tab");
    if (t) { state.admin.synth = t.dataset.synth; renderAdmin(); }
  });
  $("memberFilterBar").addEventListener("click", ev => {
    const g = ev.target.closest("[data-adm-group]");
    if (g) { state.admin.groupFilter = g.dataset.admGroup; state.admin.selectedIds = null; renderAdmin(); return; }
    const all = ev.target.closest("[data-adm-all]");
    if (all) { state.admin.selectedIds = null; renderAdmin(); return; }
    const mb = ev.target.closest("[data-adm-member]");
    if (mb) {
      const { visibleProfiles } = getFilteredAdminContext();
      if (!state.admin.selectedIds) state.admin.selectedIds = new Set(visibleProfiles.map(p => p.id));
      const id = mb.dataset.admMember;
      if (state.admin.selectedIds.has(id)) state.admin.selectedIds.delete(id);
      else state.admin.selectedIds.add(id);
      renderAdmin();
    }
  });

  $("copyReportBtn").onclick = async () => {
    const { range, profileMap, visibleProfiles, activeIds, entries } = getFilteredAdminContext();
    const selMembers = visibleProfiles.filter(p => activeIds.has(p.id));
    const lines = [
      `[3오늘 점검 리포트] ${range.label}`,
      `참여 멤버: ${selMembers.length}명 · 총 기록: ${entries.length}건`,
      "",
      "▶ 멤버별 기록 수",
      ...selMembers.map(m => {
        const me = entries.filter(e => e.user_id === m.id);
        return `- ${m.display_name}${m.group_name ? `(${m.group_name})` : ""}: ${me.length}일`;
      }),
    ];
    const collect = (label, fn) => {
      const rows = entries.flatMap(e => fn(e).map(t => `- [${profileMap.get(e.user_id)?.display_name || "멤버"} · ${e.date.slice(5)}] ${t}`));
      if (rows.length) lines.push("", label, ...rows);
    };
    collect("▶ 말씀 성취", e => arr(e.witness.fulfilled));
    collect("▶ 기도 응답", e => arr(e.witness.answers));
    collect("▶ 전도 역사", e => arr(e.witness.evangelism));
    collect("▶ 최고의 작품", e => e.witness.night ? [e.witness.night] : []);
    collect("▶ 붙잡은 언약", e => e.covenant ? [`${e.covenant}${e.ref ? ` (${e.ref})` : ""}`] : []);
    collect("▶ 포럼 나눔", e => e.forum ? arr(e.forum.points) : []);

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast("점검 요약을 클립보드에 복사했습니다.");
    } catch {
      prompt("아래 내용을 복사하세요:", lines.join("\n"));
    }
  };
  $("printReportBtn").onclick = () => window.print();
  $("openCloudFromAdminBtn").onclick = () => openSettings();

  // ── Admin: Member & Invite Management Modal ──
  $("adminManageBtn").onclick = async () => {
    await loadAdminData(true);
    renderAdminManage();
    $("adminManageModal").hidden = false;
  };

  function renderAdminManage() {
    const a = state.admin;
    const s = a.settings || {};
    $("adminManageBody").innerHTML = `
      <div class="sec-box w">
        <h4>공동체 · 초대 코드 설정</h4>
        <div class="grid-2">
          <div class="field"><label for="admInviteIn">초대 코드 (비워두면 자유 가입)</label><input id="admInviteIn" value="${esc(s.invite_code || "")}" placeholder="예: 3today2026"></div>
          <div class="field"><label for="admCampStartIn">40일 집중 시작일</label><input id="admCampStartIn" type="date" value="${esc(s.campaign_start || a.start40 || "")}"></div>
        </div>
        <button class="btn-primary" id="saveAdmSettingsBtn" type="button">설정 저장</button>
      </div>
      <h4 style="font-size:14px;margin:16px 0 10px">가입 멤버 목록 (${a.profiles.length}명)</h4>
      <div class="matrix-wrap">
        <table class="matrix">
          <thead><tr><th>이름</th><th>이메일</th><th>팀/목장</th><th>권한</th><th></th></tr></thead>
          <tbody>${a.profiles.map(p => `<tr>
            <td>${esc(p.display_name)}</td>
            <td style="font-size:12px;color:var(--muted)">${esc(p.email || "")}</td>
            <td><input data-grp-id="${p.id}" value="${esc(p.group_name || "")}" style="border:1px solid var(--line);border-radius:8px;padding:4px 8px;width:110px"></td>
            <td><select data-role-id="${p.id}" style="border:1px solid var(--line);border-radius:8px;padding:4px 6px">
              <option value="member"${p.role === "member" ? " selected" : ""}>일반 멤버</option>
              <option value="admin"${p.role === "admin" ? " selected" : ""}>관리자</option>
            </select></td>
            <td><button class="mini-btn" data-save-prof="${p.id}" type="button">저장</button></td>
          </tr>`).join("")}</tbody>
        </table>
      </div>`;

    $("saveAdmSettingsBtn").onclick = async () => {
      const invite_code = $("admInviteIn").value.trim();
      const campaign_start = $("admCampStartIn").value || null;
      const { error } = await state.sb.from("app_settings").update({ invite_code, campaign_start }).eq("id", 1);
      if (error) { toast("저장 실패: " + error.message); return; }
      a.settings.invite_code = invite_code;
      a.settings.campaign_start = campaign_start;
      if (campaign_start) a.start40 = campaign_start;
      toast("초대 코드와 설정이 저장되었습니다.");
    };

    $("adminManageBody").querySelectorAll("[data-save-prof]").forEach(btn => {
      btn.onclick = async () => {
        const pid = btn.dataset.saveProf;
        const group_name = $("adminManageBody").querySelector(`[data-grp-id="${pid}"]`).value.trim();
        const role = $("adminManageBody").querySelector(`[data-role-id="${pid}"]`).value;
        const adminCount = a.profiles.filter(x => x.role === "admin").length;
        if (pid === state.user.id && role !== "admin" && adminCount <= 1) {
          toast("마지막 관리자는 일반 멤버로 바꿀 수 없습니다.");
          return;
        }
        const { error } = await state.sb.from("profiles").update({ group_name, role }).eq("id", pid);
        if (error) { toast("변경 실패: " + error.message); return; }
        await loadAdminData(true);
        renderAdmin();
        renderAdminManage();
        toast("멤버 정보가 저장되었습니다.");
      };
    });
  }

  // ── Settings / Backup / AI / Cloud Setup Modal ──
  function openSettings() {
    const isCloud = !!state.sb;
    const p = state.profile || loadLocalProfile();
    const cfg = state.cloud || {};
    const aiCfg = loadAiConfig();
    $("settingsBody").innerHTML = `
      <div class="sec-box n">
        <h4>내 프로필</h4>
        <div class="grid-2">
          <div class="field"><label for="setName">이름 (닉네임)</label><input id="setName" value="${esc(p.display_name || "")}"></div>
          <div class="field"><label for="setGroup">팀 / 목장</label><input id="setGroup" value="${esc(p.group_name || "")}" placeholder="예: 1팀"></div>
        </div>
        <button class="btn-primary" id="saveProfBtn" type="button">이름 저장</button>
      </div>

      <div class="sec-box w">
        <h4>✨ AI 문맥 다듬기 연결 (선택)</h4>
        <p style="font-size:13px;color:var(--ink-2);margin-bottom:10px">
          두서없는 구어체 녹취나 메모를 문맥에 맞게 유려하게 다듬고, <b>강단·현장 말씀</b>과 <b>성취·응답·전도 역사</b>를 정확히 뽑아 줍니다. (키는 이 브라우저에만 보관됩니다)
        </p>
        <div class="grid-2">
          <div class="field"><label for="aiProviderSel">AI 종류</label>
            <select id="aiProviderSel">
              <option value="gemini"${aiCfg?.provider !== "openai" ? " selected" : ""}>Google Gemini (무료 API 추천)</option>
              <option value="openai"${aiCfg?.provider === "openai" ? " selected" : ""}>OpenAI (GPT-4o mini)</option>
            </select>
          </div>
          <div class="field"><label for="aiKeyIn">API 키</label><input id="aiKeyIn" type="password" value="${esc(aiCfg?.apiKey || "")}" placeholder="키를 입력하면 AI 정리 사용"></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button class="btn-primary" id="saveAiBtn" type="button">저장 · 연결</button>
          ${aiCfg?.apiKey ? `<button class="btn-secondary" id="clearAiBtn" type="button">연결 해제</button>` : ""}
          <span style="font-size:12px;color:var(--muted)">미설정 시 내장 자동 정리기로 동작합니다</span>
        </div>
      </div>

      <div class="sec-box n">
        <h4>데이터 백업 (JSON)</h4>
        <p style="font-size:13px;color:var(--muted);margin-bottom:10px">내 기록을 파일로 안전하게 보관하거나 다시 불러올 수 있습니다.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-secondary" id="exportJsonBtn" type="button">📥 백업 저장</button>
          <label class="btn-secondary" style="cursor:pointer">📤 백업 불러오기<input type="file" id="importJsonIn" accept=".json,application/json" hidden></label>
        </div>
      </div>

      <div class="sec-box n">
        <h4>20명 배포용 클라우드 DB (Supabase)</h4>
        <p style="font-size:13px;color:var(--ink-2);margin-bottom:10px">
          상태: <b>${isCloud ? `연결됨 (${cfg.source === "file" ? "전체 배포용 config.js" : "이 브라우저 테스트 연결"})` : "미연결 — 개인 기기 모드"}</b>
        </p>
        ${cfg.source !== "file" ? `
          <div class="field"><label for="cfgUrl">Project URL</label><input id="cfgUrl" value="${esc(cfg.url || "")}" placeholder="https://xxxx.supabase.co"></div>
          <div class="field"><label for="cfgKey">Anon Public Key</label><input id="cfgKey" value="${esc(cfg.key || "")}" placeholder="eyJhbGciOi..."></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn-primary" id="saveCloudBtn" type="button">연결 테스트 · 적용</button>
            ${cfg.source === "browser" ? `<button class="btn-secondary" id="clearCloudBtn" type="button">연결 해제</button>` : ""}
          </div>
          <p style="font-size:12px;color:var(--muted);margin-top:8px">20명에게 URL만 나눠주어 바로 쓰게 하려면, 위 두 값을 채팅에 보내주시거나 <code>config.js</code> 에 넣으세요.</p>
        ` : `<p style="font-size:13px;color:var(--ink-2)">20명 배포용으로 정상 연결되어 있습니다.</p>`}
      </div>

      ${isCloud && state.user ? `<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn-danger" id="logoutBtn" type="button">로그아웃</button></div>` : ""}
    `;

    $("saveProfBtn").onclick = async () => {
      const display_name = $("setName").value.trim() || "전도자";
      const group_name = $("setGroup").value.trim();
      if (state.sb && state.user) {
        const { error } = await state.sb.from("profiles").update({ display_name, group_name }).eq("id", state.user.id);
        if (error) { toast("저장 실패: " + error.message); return; }
        state.profile.display_name = display_name;
        state.profile.group_name = group_name;
      } else {
        const lp = loadLocalProfile();
        lp.display_name = display_name; lp.group_name = group_name;
        localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(lp));
        state.profile = lp;
      }
      renderAll();
      toast("프로필이 저장되었습니다.");
    };

    $("saveAiBtn").onclick = () => {
      const provider = $("aiProviderSel").value;
      const apiKey = $("aiKeyIn").value.trim();
      if (!apiKey) { toast("API 키를 입력해 주세요."); return; }
      localStorage.setItem(LOCAL_AI_KEY, JSON.stringify({ provider, apiKey }));
      updateAiPill();
      openSettings();
      toast("AI 문맥 다듬기가 연결되었습니다.");
    };
    const clearAiBtn = $("clearAiBtn");
    if (clearAiBtn) {
      clearAiBtn.onclick = () => {
        localStorage.removeItem(LOCAL_AI_KEY);
        updateAiPill();
        openSettings();
        toast("기본 자동 정리 모드로 전환했습니다.");
      };
    }

    $("exportJsonBtn").onclick = () => {
      const blob = new Blob([JSON.stringify(state.entries, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `3오늘-백업-${todayKey()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    };

    $("importJsonIn").onchange = async ev => {
      const file = ev.target.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (!Array.isArray(parsed)) throw new Error("올바른 백업 파일이 아닙니다.");
        const valid = parsed.map(x => normalizeEntry(x, state.user?.id || "local")).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.date));
        if (!valid.length) throw new Error("불러올 기록이 없습니다.");
        for (const item of valid) await upsertEntry(item);
        $("settingsModal").hidden = true;
        renderAll();
        toast(`${valid.length}건의 기록을 불러왔습니다.`);
      } catch (e) {
        toast("불러오기 실패: " + e.message);
      }
    };

    const saveCloudBtn = $("saveCloudBtn");
    if (saveCloudBtn) {
      saveCloudBtn.onclick = () => {
        const url = $("cfgUrl").value.trim(), key = $("cfgKey").value.trim();
        if (!url.startsWith("https://") || !key) { toast("Project URL과 Anon Key를 정확히 입력해 주세요."); return; }
        localStorage.setItem(LOCAL_CLOUD_KEY, JSON.stringify({ url, key }));
        location.reload();
      };
    }
    const clearCloudBtn = $("clearCloudBtn");
    if (clearCloudBtn) {
      clearCloudBtn.onclick = () => { localStorage.removeItem(LOCAL_CLOUD_KEY); location.reload(); };
    }
    const logoutBtn = $("logoutBtn");
    if (logoutBtn) {
      logoutBtn.onclick = async () => { await state.sb.auth.signOut(); $("settingsModal").hidden = true; };
    }

    $("settingsModal").hidden = false;
  }

  // ── Global Wiring ──
  $("goHomeBtn").onclick = () => { state.page = "home"; renderAll(); };
  document.querySelectorAll("[data-nav]").forEach(b => {
    b.onclick = () => { state.page = b.dataset.nav; renderAll(); };
  });
  $("newEntryBtn").onclick = () => openEditor(todayKey());
  $("settingsBtn").onclick = () => openSettings();

  document.addEventListener("click", ev => {
    const closeId = ev.target.closest("[data-close]")?.dataset.close;
    if (closeId) { $(closeId).hidden = true; return; }
    if (ev.target.classList.contains("backdrop")) ev.target.hidden = true;
  });
  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape") document.querySelectorAll(".backdrop").forEach(b => b.hidden = true);
  });

  init();
})();
