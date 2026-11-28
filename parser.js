// 3오늘 & 팀 포럼 문맥 정리 파서 (안전한 기본 정리 + AI 전체 문맥 정리)
(() => {
  const MONTHS = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
    may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
    sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };
  const pad = n => String(n).padStart(2, "0");

  function todayLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function extractDate(text) {
    const head = text.slice(0, 260);
    let m = head.match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    m = head.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(20\d{2})\b/i);
    if (m) return `${m[3]}-${pad(MONTHS[m[1].toLowerCase()])}-${pad(m[2])}`;
    m = head.match(/(?:^|\s)(\d{1,2})\s*[월/]\s*(\d{1,2})\s*일?(?:\s|,|$)/);
    if (m) return `${new Date().getFullYear()}-${pad(m[1])}-${pad(m[2])}`;
    return todayLocal();
  }

  function stripDatePrefix(line) {
    return line
      .replace(/^\s*(?:20\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}[,\s]+20\d{2})(?:[,\s]*(?:mon|tue(?:s)?|wed(?:nes)?|thu(?:rs)?|fri|sat|sun)(?:day)?\.?|\s*\([월화수목금토주일]+\))?\s*[-–—:|]?\s*/i, "")
      .trim();
  }

  function cleanSpoken(s) {
    let t = String(s || "").trim();
    t = t.replace(/—[^—]+—/g, " ");
    t = t.replace(/(?:^|\s)(?:이제|막|약간|되게|그냥|좀|사실은|사실|뭐|있잖아(?:요)?|일단(?:은)?|그래가지고|이렇게|그렇게|어떻게\s*잘|이런\s*식으로|그런\s*부분(?:을|에\s*대해서)?|그런\s*것을\s*통해서|그런\s*게)(?=\s|,|$)/g, " ");
    t = t.replace(/^(?:어[,.]?\s*|음[,.]?\s*|저는\s+|제가\s+|근데\s+|그런데\s+|그래서\s+|그리고\s+|그러면서\s+|결국에는\s+|그래도\s+)/g, "");
    t = t.replace(/\s*이상입니다\.?\s*$/g, "");
    t = t.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").replace(/^[,\s]+|[,\s]+$/g, "").trim();
    return t;
  }

  function splitClauses(text) {
    const raw = String(text || "").replace(/\r\n/g, "\n").replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
    if (!raw) return [];
    const sents = raw.split(/(?<=[.?!])\s+|(?<=다|요|습니다|봅니다|겠습니다|옵니다|옵소서|지어다|아멘)\.\s*/);
    const out = [];
    for (const s of sents) {
      const clean = cleanSpoken(s.replace(/[.]+$/, ""));
      if (!clean) continue;
      if (clean.length > 165) {
        const subs = clean.split(/(?<=는데|했고|됐고|이고|보고|으며)\.\s*|(?<=지만|거든요|했고|됐고|았어요|었어요),\s+/);
        for (const sub of subs) {
          const c = cleanSpoken(sub);
          if (c.length >= 24) out.push(c);
        }
      } else {
        out.push(clean);
      }
    }
    return out;
  }

  function polishPoint(s) {
    let t = cleanSpoken(s);
    t = t.replace(/^(?:오늘\s+하루\s+|하루\s+|맨\s*첫\s*번째로\s+|그런데\s+|그래서\s+|그러면서\s+|결국에는\s+|하지만\s+|그래도\s+|오늘도?\s+)/g, "");
    t = t.replace(/^(?:내\s+생각에\s+|생각을\s+해보면\s+|지금\s+와서\s+생각해보면\s+|지금\s+상태를\s+봤을\s+때\s+|요즘\s+들어서\s+)/g, "");
    t = t.replace(/,?\s*이\s*두\s*가지로\s*인도받았는데요$/g, "으로 인도받음");
    t = t.replace(/인도받았는데요$/g, "인도받음");
    t = t.replace(/말씀을\s+하셨거든$/g, "말씀하심");
    t = t.replace(/말씀을\s+하셨어$/g, "말씀하심");
    t = t.replace(/라고\s+보고요?$/g, "이라고 봄");
    t = t.replace(/되는\s+것\s+같고요?$/g, "됨");
    t = t.replace(/하게\s+됩니다$/g, "하게 됨");
    t = t.replace(/고민하게\s+됩니다$/g, "고민하게 됨");
    t = t.replace(/기도가\s+되어집니다$/g, "기도함");
    t = t.replace(/기도가\s+되어지는\s+하루였습니다$/g, "기도한 하루");
    t = t.replace(/기도하며\s+예수\s*그리스도의\s*이름으로\s*기도합니다$/g, "기도함");
    t = t.replace(/되어지는\s+부분인데$/g, "되어야 할 부분임");
    t = t.replace(/누리고\s+있어야\s+된다는\s+것$/g, "누려야 함을 확인함");
    t = t.replace(/되지\s+않을까라는\s*생각(?:을\s*)?(?:했어|함)$/g, "준비되길 기대함");
    t = t.replace(/지\s+않을까\s*생각(?:을\s*)?(?:했어|함)$/g, "기대함");
    t = t.replace(/남겨보면$/g, "남겨보는 것이 중요함");
    t = t.replace(/해야\s+한다$/g, "해야 함");
    t = t.replace(/상태인데$/g, "상태임");
    t = t.replace(/있고요$/g, "있음");
    t = t.replace(/되더라고요$/g, "됨");
    t = t.replace(/하더라고요$/g, "함");
    t = t.replace(/생각이\s+듭니다$/g, "생각이 듦");
    t = t.replace(/생각을\s+했어$/g, "생각함");
    t = t.replace(/알았습니다$/g, "알게 됨");
    t = t.replace(/깨달았고$/g, "깨달음");
    t = t.replace(/바뀌겠다$/g, "바뀔 것을 확신함");
    t = t.replace(/것\s*같아요$/g, "것 같음");
    t = t.replace(/것\s*같고$/g, "것 같음");
    t = t.replace(/보여지려면\s+먼저\s+(.+)\s+세워야\s+함$/g, "보여지려면 먼저 $1 세워야 함을 붙잡음");
    t = t.replace(/거예요$|거든$|잖아$/g, "");
    t = t.replace(/\s{2,}/g, " ").replace(/^[,\s]+|[,\s]+$/g, "").trim();
    if (t.length > 155) {
      const cut = t.slice(0, 152);
      const sep = Math.max(cut.lastIndexOf(", "), cut.lastIndexOf(" "), 100);
      t = cut.slice(0, sep).trim() + "…";
    }
    return t;
  }

  // 기본 모드: 화자별 발화 내용을 '포럼' 포인트로만 정돈 (문맥 확인 없이 성취/응답을 자의적으로 추측하지 않음)
  function summarizeSpeaker(text, maxPoints = 3) {
    const clauses = splitClauses(text);
    if (!clauses.length) return { points: [], bestWord: "" };

    const WORD_KWS = ["말씀", "언약", "기도수첩", "강단", "메시지", "CVDIP", "망대", "절대여정", "신분", "권세", "왕", "선지자", "제사장", "서밋", "달란트", "전문성", "미션", "성취"];
    const STATE_KWS = ["상태", "깨닫", "치유", "각인", "고민", "두려", "의지", "벅차", "집중", "졸", "학업", "미래"];
    const ACTION_KWS = ["기도", "도전", "방향", "결단", "작품", "확인", "아침", "밤", "3오늘", "포럼", "기록", "살릴"];

    const scored = clauses.map((raw, idx) => {
      const p = polishPoint(raw);
      if (p.length < 16 || /(?:주셨는데|있으면|하면서)$/.test(p) || /^(?:이상입니다|감사합니다|아멘)$/.test(p)) return null;
      if (/^(?:그\s*부분에\s*대해서|일단\s*한번|어떻게\s*잘|우리도\s*예전에|한번\s*해볼게|잘\s*올려주면|사무엘은\s*하던|주호는\s*조금|이\s*시기에\s*미래에\s*대한\s*고민이|나도\s*막\s*글씨를)/.test(p)) return null;

      let wScore = 0, sScore = 0, aScore = 0;
      for (const k of WORD_KWS) if (raw.includes(k)) wScore += 3;
      for (const k of STATE_KWS) if (raw.includes(k)) sScore += 3;
      for (const k of ACTION_KWS) if (raw.includes(k)) aScore += 3;

      const total = wScore + sScore + aScore + (p.length >= 25 && p.length <= 140 ? 3 : 0);
      if (total <= 2) return null;
      const axis = wScore >= sScore && wScore >= aScore ? "word" : (sScore >= aScore ? "state" : "action");
      return { idx, p, total, wScore, axis };
    }).filter(Boolean);

    if (!scored.length) {
      const pts = clauses.slice(0, maxPoints).map(polishPoint).filter(Boolean);
      return { points: pts, bestWord: pts[0] || "" };
    }

    const chosen = [];
    const pickBest = pred => {
      const candidates = scored.filter(x => pred(x) && !chosen.includes(x)).sort((a, b) => b.total - a.total || a.idx - b.idx);
      for (const c of candidates) {
        const dup = chosen.some(prev => {
          const wa = new Set(prev.p.split(/\s+/).filter(w => w.length >= 2));
          const wb = c.p.split(/\s+/).filter(w => w.length >= 2);
          return wb.filter(w => wa.has(w)).length >= Math.max(3, Math.floor(wb.length * 0.5));
        });
        if (!dup) { chosen.push(c); return true; }
      }
      return false;
    };

    pickBest(x => x.axis === "word");
    pickBest(x => x.axis === "state");
    pickBest(x => x.axis === "action");
    while (chosen.length < maxPoints) {
      if (!pickBest(() => true)) break;
    }

    chosen.sort((a, b) => a.idx - b.idx);
    const bestWordObj = [...chosen].sort((a, b) => b.wScore - a.wScore || b.total - a.total)[0];
    return {
      points: chosen.map(x => x.p),
      bestWord: bestWordObj?.p || chosen[0]?.p || "",
    };
  }

  function summarizePrayer(text) {
    const raw = String(text || "").replace(/\r\n/g, "\n").replace(/\n+/g, " ").trim();
    if (!raw) return [];
    const sents = raw.split(/(?<=[.?!])\s+|(?<=다|요|습니다|옵소서|지어다|아멘)\.\s*/);
    const out = [];
    for (let s of sents) {
      s = s.replace(/[.]+$/, "").trim();
      s = s.replace(/^하나님\s*아버지\s*(?:오늘도\s*)?/, "").trim();
      if (!s || s.length < 8) continue;
      if (/^(?:감사드리며\s*)?(?:지금도\s*살아계셔.*)?(?:우리\s*주\s*)?예수\s*그리스도\s*(?:이름으로\s*)?기도(?:하였|합)니다/i.test(s)) continue;
      if (/^아멘$/i.test(s)) continue;
      s = s.replace(/^(?:그리하여\s+|또\s+)/, "").trim();
      out.push(s.length > 115 ? polishPoint(s) : s);
    }
    return out.slice(0, 6);
  }

  function organizeEvangelismLines(lines) {
    const out = [];
    const family = [], church = [], field = [];
    for (const raw of lines) {
      const l = raw.trim();
      if (!l) continue;
      if (/^(?:가정\s*\/\s*가문|큰큰아버지|큰아버지|고모|삼촌|부모님)/.test(l) || /\((?:큰아버지|삼촌|외삼촌|이모|고모)\)/.test(l)) {
        family.push(l.replace(/^가정\s*\/\s*가문\s*:\s*/, ""));
      } else if (/^교회\s*\/\s*RUTC\s*:/.test(l)) {
        church.push(l.replace(/^교회\s*\/\s*RUTC\s*:\s*/, ""));
      } else if (/^현장\s*:/.test(l)) {
        field.push(l.replace(/^현장\s*:\s*/, ""));
      } else {
        out.push(l);
      }
    }
    if (family.length) out.push(`가정·가문: ${family.join(" · ")}`);
    if (church.length) out.push(`교회·RUTC: ${church.join(" · ")}`);
    if (field.length) out.push(`현장: ${field.join(" · ")}`);
    return out;
  }

  function parseForum(text, date, headerRest) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    let forumName = "팀 포럼";
    let participants = [];

    if (headerRest) {
      const pm = headerRest.match(/\(([^)]+)\)/);
      if (pm) {
        participants = pm[1].split(/[,·/]/).map(s => s.trim()).filter(Boolean);
      }
      const titlePart = headerRest
        .replace(/\([^)]*\)/g, "")
        .replace(/(?:입니다|이에요|예요|기록)\.?\s*$/g, "")
        .trim();
      if (titlePart) forumName = titlePart;
    }

    const blocks = [];
    let cur = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (i === 0 && (headerRest || /포럼|20\d{2}/.test(line))) continue;
      if (!line) continue;

      const colonMatch = line.match(/^([가-힣A-Za-z0-9_ ]{2,14})\s*:\s*(.*)$/);
      const isBareParticipant = !colonMatch && participants.some(p => line === p || line === p.replace(/(?:RM|쌤)$/i, ""));
      if (colonMatch) {
        if (cur) blocks.push(cur);
        cur = { name: colonMatch[1].trim(), lines: colonMatch[2].trim() ? [colonMatch[2].trim()] : [] };
      } else if (isBareParticipant) {
        if (cur) blocks.push(cur);
        cur = { name: line, lines: [] };
      } else {
        if (!cur) cur = { name: "공통 나눔", lines: [] };
        cur.lines.push(line);
      }
    }
    if (cur) blocks.push(cur);

    const speakers = blocks
      .map(b => {
        const res = summarizeSpeaker(b.lines.join(" "), 3);
        return { name: b.name, ...res };
      })
      .filter(s => s.points.length);

    const leader = speakers[speakers.length - 1] || speakers[0];
    const flatPoints = speakers.flatMap(s => s.points.map(p => `[${s.name}] ${p}`));

    return {
      kind: "forum",
      date,
      word: { ref: "", title: "", pulpit: [], field: [], points: [] },
      witness: { morning: "", day: "", night: "", fulfilled: [], answers: [], evangelism: [] },
      forum: {
        name: participants.length ? `${forumName} (${participants.join(" · ")})` : forumName,
        points: flatPoints,
        speakers: speakers.map(({ name, points }) => ({ name, points })),
        raw: text.trim(),
      },
      covenantHint: leader?.bestWord || leader?.points[0] || "",
      raw: text.trim(),
    };
  }

  function parseThreeToday(text, date, headerRest) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const sections = { preamble: [], evangelism: [], word: [], prayer: [], fulfilled: [], answers: [], evgHist: [], flow: [], forum: [] };
    let mode = "preamble";

    const SEC_RE = /^\s*(?:\d+[.)]\s*|[\[【])?\s*(오늘의\s*전도|오늘의\s*말씀|오늘의\s*기도|오늘의\s*증거|강단\s*말씀|현장\s*말씀|포럼|말씀\s*성취|기도\s*응답|전도\s*역사)\s*[\]】:]?\s*(.*)$/;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].trim();
      if (!rawLine) continue;
      if (i === 0 && (stripDatePrefix(rawLine) !== rawLine || /3오늘(?:입니다)?\.?\s*$/.test(rawLine))) {
        continue;
      }
      const sm = rawLine.match(SEC_RE);
      if (sm) {
        const label = sm[1].replace(/\s+/g, "");
        if (label.includes("전도") && !label.includes("역사")) mode = "evangelism";
        else if (label.includes("말씀") && !label.includes("성취")) mode = "word";
        else if (label.includes("기도") && !label.includes("응답")) mode = "prayer";
        else if (label.includes("포럼")) mode = "forum";
        else if (label === "말씀성취") mode = "fulfilled";
        else if (label === "기도응답") mode = "answers";
        else if (label === "전도역사") mode = "evgHist";
        else mode = "flow";

        if (sm[2].trim()) {
          if (label === "강단말씀") sections.word.push("강단: " + sm[2].trim());
          else if (label === "현장말씀") sections.word.push("현장: " + sm[2].trim());
          else sections[mode].push(sm[2].trim());
        }
        continue;
      }
      if (/^(?:이게\s*3오늘|3오늘\s*끝)/.test(rawLine)) continue;
      sections[mode].push(rawLine);
    }

    const wordLines = sections.word.filter(Boolean);
    let ref = "", wordTitle = "", wordPoints = [], pulpit = [], field = [];
    for (const wl of wordLines) {
      const rm = wl.match(/^(?:본문|성경)\s*[:：]\s*(.+)$/);
      const tm = wl.match(/^(?:제목|말씀\s*제목)\s*[:：]\s*(.+)$/);
      const pm = wl.match(/^(?:강단|강단\s*말씀)\s*[:：]\s*(.+)$/);
      const fm = wl.match(/^(?:현장|현장\s*말씀|기도수첩)\s*[:：]\s*(.+)$/);
      if (rm) ref = rm[1].trim();
      else if (tm) wordTitle = tm[1].trim();
      else if (pm) pulpit.push(pm[1].trim());
      else if (fm) field.push(fm[1].trim());
      else wordPoints.push(wl);
    }
    if (!wordTitle && wordPoints.length === 1 && wordPoints[0].length <= 45) {
      wordTitle = wordPoints[0];
    }

    const prayer = summarizePrayer(sections.prayer.join("\n"));
    const evgRaw = [...sections.preamble, ...sections.evangelism];
    const evangelism = organizeEvangelismLines(evgRaw);

    const selfLine = evgRaw.find(l => /^나\s*[-–:]\s*/.test(l));
    const selfCov = selfLine ? selfLine.replace(/^나\s*[-–:]\s*/, "").replace(/[“”"']/g, "").trim() : "";
    const covenant = [selfCov, wordTitle || wordLines[0] || ""].filter((v, i, a) => v && a.indexOf(v) === i).join(" — ");

    // 명시적 라벨이 있는 경우에만 증거 항목에 분류
    const fulfilled = [...sections.fulfilled], answers = [...sections.answers], evgHist = [...sections.evgHist];
    let morning = "", day = "", night = "";
    for (const wl of sections.flow) {
      if (/^(?:성취|말씀\s*성취)\s*[:：]/.test(wl)) fulfilled.push(wl.replace(/^[^:：]+[:：]\s*/, ""));
      else if (/^(?:응답|기도\s*응답)\s*[:：]/.test(wl)) answers.push(wl.replace(/^[^:：]+[:：]\s*/, ""));
      else if (/^(?:전도\s*역사|전도\s*열매)\s*[:：]/.test(wl)) evgHist.push(wl.replace(/^[^:：]+[:：]\s*/, ""));
      else if (/^(?:아침)\s*[:：]/.test(wl)) morning = wl.replace(/^[^:：]+[:：]\s*/, "");
      else if (/^(?:낮|만남|근본의\s*만남)\s*[:：]/.test(wl)) day = wl.replace(/^[^:：]+[:：]\s*/, "");
      else if (/^(?:밤|작품|최고의\s*작품)\s*[:：]/.test(wl)) night = wl.replace(/^[^:：]+[:：]\s*/, "");
    }

    let author = "";
    if (headerRest) {
      const am = headerRest.match(/^([가-힣A-Za-z]{2,10})\s/);
      if (am) author = am[1];
    }

    return {
      kind: "threeToday",
      date,
      author,
      covenant,
      ref,
      word: { ref, title: wordTitle, pulpit, field, points: wordPoints, raw: text.trim() },
      prayer,
      evangelism,
      witness: { morning, day, night, fulfilled, answers, evangelism: evgHist },
      forum: sections.forum.length ? { name: "포럼", points: sections.forum } : null,
      raw: text.trim(),
    };
  }

  function parseSubmission(rawText) {
    const text = String(rawText || "").replace(/\r\n/g, "\n").trim();
    if (!text) return null;

    const firstLine = text.split("\n").find(l => l.trim()) || "";
    const date = extractDate(text);
    const headerRest = stripDatePrefix(firstLine);

    const forumStartIdx = text.search(/\n\s*(?:20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}[^\n]*포럼|[^\n]*저녁점검포럼|[^\n]*팀\s*포럼[^\n]*\()/);
    const has3Today = /오늘의\s*(?:말씀|기도|전도)/.test(text);
    const speakerColons = (text.match(/^\s*[가-힣A-Za-z0-9_ ]{2,14}\s*:\s*$/gm) || []).length;
    const isForumOnly = !has3Today && (/포럼/.test(firstLine) || speakerColons >= 2);

    if (has3Today && forumStartIdx > 0) {
      const partA = text.slice(0, forumStartIdx).trim();
      const partB = text.slice(forumStartIdx).trim();
      const t = parseThreeToday(partA, date, headerRest);
      const bFirst = partB.split("\n")[0] || "";
      const f = parseForum(partB, extractDate(partB) || date, stripDatePrefix(bFirst));
      t.forum = f.forum;
      t.kind = "both";
      t.raw = text;
      return t;
    }

    if (isForumOnly) {
      return parseForum(text, date, headerRest);
    }

    return parseThreeToday(text, date, headerRest);
  }

  // ── AI 전체 문맥 이해 정밀 정리 ──
  const AI_SYSTEM_PROMPT = `당신은 기독교 '3오늘(오늘의 말씀·기도·전도)'과 팀 점검 포럼을 정리하는 신실하고 세심한 도우미입니다.
사용자가 붙여넣은 글은 음성 녹취나 두서없이 적은 묵상·포럼입니다.
문장을 기계적으로 자르지 말고, **글 전체의 흐름과 영적 맥락을 먼저 깊이 이해한 뒤** 아래 원칙에 따라 정확하고 자연스러운 한국어로 재구성하세요.

핵심 원칙:
1. **지식·사실 왜곡 금지**: 원문에 없는 성경 구절, 사건, 응답을 절대 지어내지 마세요. 두서없는 말투("이제", "막", "약간", 비문, 어색한 연결)만 매끄럽고 바른 문장으로 다듬어 주세요.
2. **증인의 간증(\`witness\`) 엄격 구분 — 억지로 끼워 넣기 금지**:
   - \`fulfilled\`(말씀 성취): 이전에 붙잡은 말씀이 **오늘 실제 삶이나 사건 속에서 성취·확인되었다는 구체적 고백**이 있을 때만 넣으세요. (단순히 "오늘 이런 말씀을 들었다", "앞으로 성취되길 바란다/확인하자"는 다짐·권면은 절대 넣지 마세요!)
   - \`answers\`(기도 응답): **기도하던 제목에 대해 하나님이 실제로 주신 응답·변화·해결**이 있을 때만 넣으세요. (단순한 기도 요청·소원은 \`prayer\`에 넣고 여기는 비워두세요!)
   - \`evangelism\`(전도 역사): **실제로 복음을 전하거나, 만남/대화/열린 문이 일어난 사실**이 있을 때만 넣으세요. (단순 기도 명단이나 "만나길 기도한다"는 계획은 \`evangelism\`(오늘의 전도)에만 넣고 여기는 비워두세요!)
   - 확신이 서지 않으면 반드시 빈 배열 \`[]\` 로 남겨 두세요.
3. **강단 말씀 vs 현장 말씀**:
   - \`word.pulpit\`: 주일/강단/목회자 메시지에서 붙잡은 핵심 (있을 때만)
   - \`word.field\`: 기도수첩·현장·오늘의 말씀에서 붙잡은 핵심 (있을 때만)
4. **팀 포럼 (\`forum\`)**:
   - 참석자별 발언 전체를 이해한 뒤, 각 사람이 ① 붙잡은 말씀/언약, ② 오늘 돌아본 영적 상태·깨달음, ③ 붙잡은 기도/도전을 **완전하고 자연스러운 한국어 2~3문장**으로 깔끔히 정리하세요.
5. **covenant**: 글 전체를 관통하는 오늘의 핵심 언약 한 문장.

반환 JSON 스키마 (반드시 유효한 JSON 객체만 출력):
{
  "kind": "threeToday | forum | both",
  "date": "YYYY-MM-DD",
  "covenant": "핵심 언약 한 문장",
  "ref": "명시된 성경 구절(없으면 빈 문자열)",
  "word": {
    "ref": "본문",
    "title": "말씀 제목",
    "pulpit": ["강단 말씀 요점 (없으면 [])"],
    "field": ["현장/기도수첩 말씀 요점 (없으면 [])"],
    "points": ["말씀 핵심 요약 (1~3줄)"]
  },
  "prayer": ["정돈된 기도 제목 (최대 5줄)"],
  "evangelism": ["오늘의 전도 대상·현장·일정"],
  "witness": {
    "morning": "아침 언약(명확할 때만)",
    "day": "낮 근본의 만남(실제 만남이 있을 때만)",
    "night": "밤 최고의 작품(남긴 작품이 있을 때만)",
    "fulfilled": ["실제 확인된 말씀 성취 (없으면 [])"],
    "answers": ["실제 받은 기도 응답 (없으면 [])"],
    "evangelism": ["실제 일어난 전도 역사 (없으면 [])"]
  },
  "forum": {
    "name": "포럼 이름 (없으면 null)",
    "speakers": [
      { "name": "이름", "points": ["문맥을 살려 다듬은 요약 1", "요약 2"] }
    ]
  }
}`;

  function normalizeAiResult(parsedJson, rawText) {
    const text = String(rawText || "").trim();
    const fallbackDate = extractDate(text);
    const f = parsedJson.forum && (parsedJson.forum.name || parsedJson.forum.speakers?.length)
      ? {
          name: parsedJson.forum.name || "팀 포럼",
          speakers: (parsedJson.forum.speakers || []).filter(s => s?.name && s?.points?.length),
          points: (parsedJson.forum.speakers || []).flatMap(s => (s.points || []).map(p => `[${s.name}] ${p}`)),
          raw: text,
        }
      : null;

    return {
      kind: parsedJson.kind || (f && !parsedJson.prayer?.length ? "forum" : "threeToday"),
      date: /^\d{4}-\d{2}-\d{2}$/.test(parsedJson.date || "") ? parsedJson.date : fallbackDate,
      covenant: parsedJson.covenant || "",
      ref: parsedJson.ref || "",
      word: {
        ref: parsedJson.word?.ref || "",
        title: parsedJson.word?.title || "",
        pulpit: parsedJson.word?.pulpit || [],
        field: parsedJson.word?.field || [],
        points: parsedJson.word?.points || [],
        ...(f ? {} : { raw: text }),
      },
      prayer: parsedJson.prayer || [],
      evangelism: parsedJson.evangelism || [],
      witness: {
        morning: parsedJson.witness?.morning || "",
        day: parsedJson.witness?.day || "",
        night: parsedJson.witness?.night || "",
        fulfilled: parsedJson.witness?.fulfilled || [],
        answers: parsedJson.witness?.answers || [],
        evangelism: parsedJson.witness?.evangelism || [],
      },
      forum: f,
      covenantHint: parsedJson.covenant || "",
      raw: text,
    };
  }

  async function parseWithAI(rawText, aiConfig) {
    const text = String(rawText || "").trim();
    if (!text) return null;
    const provider = aiConfig?.provider || "gemini";
    const apiKey = String(aiConfig?.apiKey || "").trim();
    if (!apiKey) throw new Error("API 키가 설정되지 않았습니다.");

    const userMsg = `오늘 기준 날짜는 ${todayLocal()} 입니다. 날짜가 글에 적혀 있으면 글의 날짜를 사용하세요.\n\n[원문]\n${text}`;
    let parsedJson = null;

    if (provider === "openai") {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: AI_SYSTEM_PROMPT },
            { role: "user", content: userMsg },
          ],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || `OpenAI 오류 (${resp.status})`);
      parsedJson = JSON.parse(data.choices[0].message.content);
    } else {
      const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
      let lastErr = null;
      for (const model of models) {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: AI_SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: userMsg }] }],
            generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
          }),
        });
        const data = await resp.json();
        if (resp.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          parsedJson = JSON.parse(data.candidates[0].content.parts[0].text);
          break;
        }
        lastErr = new Error(data?.error?.message || `Gemini 오류 (${resp.status})`);
        if (resp.status !== 404) throw lastErr;
      }
      if (!parsedJson) throw lastErr || new Error("AI 응답을 받지 못했습니다.");
    }

    return normalizeAiResult(parsedJson, text);
  }

  function formatForumTextarea(forum) {
    if (!forum) return "";
    if (Array.isArray(forum.speakers) && forum.speakers.length) {
      return forum.speakers.map(s => `${s.name}:\n${(s.points || []).map(p => `- ${p}`).join("\n")}`).join("\n\n");
    }
    return (forum.points || []).join("\n");
  }

  function parseForumTextarea(name, text, existingRaw) {
    const lines = String(text || "").split(/\r?\n/);
    const speakers = [];
    let cur = null;
    for (const raw of lines) {
      const l = raw.trim();
      if (!l) continue;
      const hm = l.match(/^([가-힣A-Za-z0-9_ ]{2,14})\s*:\s*(.*)$/);
      if (hm) {
        cur = { name: hm[1].trim(), points: [] };
        if (hm[2].trim()) cur.points.push(hm[2].trim().replace(/^[-•*]\s*/, ""));
        speakers.push(cur);
      } else {
        const pt = l.replace(/^[-•*]\s*/, "");
        if (cur) cur.points.push(pt);
        else {
          if (!speakers.length) speakers.push({ name: "", points: [] });
          speakers[0].points.push(pt);
        }
      }
    }
    const namedSpeakers = speakers.filter(s => s.name && s.points.length);
    if (namedSpeakers.length) {
      return {
        name: name || "팀 포럼",
        speakers: namedSpeakers,
        points: namedSpeakers.flatMap(s => s.points.map(p => `[${s.name}] ${p}`)),
        raw: existingRaw || undefined,
      };
    }
    const pts = lines.map(l => l.trim().replace(/^[-•*]\s*/, "")).filter(Boolean);
    if (!name && !pts.length) return null;
    return { name: name || "포럼", points: pts, raw: existingRaw || undefined };
  }

  window.JournalParser = { parseSubmission, parseWithAI, normalizeAiResult, formatForumTextarea, parseForumTextarea, todayLocal };
})();
