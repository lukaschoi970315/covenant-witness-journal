// 3오늘 & 팀 포럼 자동 정리 파서
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
    t = t.replace(/(?:^|\s)(?:이제|막|약간|되게|그냥|좀|사실은|사실|뭐|있잖아(?:요)?|일단(?:은)?|그래가지고|이렇게)(?=\s|,|$)/g, " ");
    t = t.replace(/^(?:어[,.]?\s*|음[,.]?\s*|저는\s+|제가\s+|근데\s+|그런데\s+|그래서\s+|그리고\s+|그러면서\s+|결국에는\s+)/g, "");
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
      if (clean.length > 105) {
        const subs = clean.split(/(?<=는데|지만|거든|거든요|했고|됐고|이고|보고|으며|고서|보면|으면|면서),?\s+/);
        for (const sub of subs) {
          const c = cleanSpoken(sub);
          if (c.length >= 14) out.push(c);
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
    t = t.replace(/^(?:내\s+생각에\s+|생각을\s+해보면\s+|지금\s+와서\s+생각해보면\s+|지금\s+상태를\s+봤을\s+때\s+|그런\s+부분을\s+)/g, "");
    t = t.replace(/인도받았는데요$/g, "인도받음");
    t = t.replace(/말씀을\s+하셨거든$/g, "말씀하심");
    t = t.replace(/말씀을\s+하셨어$/g, "말씀하심");
    t = t.replace(/라고\s+보고요?$/g, "라고 봄");
    t = t.replace(/되는\s+것\s+같고요?$/g, "됨");
    t = t.replace(/하게\s+됩니다$/g, "하게 됨");
    t = t.replace(/고민하게\s+됩니다$/g, "고민하게 됨");
    t = t.replace(/기도가\s+되어집니다$/g, "기도함");
    t = t.replace(/기도가\s+되어지는\s+하루였습니다$/g, "기도한 하루");
    t = t.replace(/기도하며\s+예수\s*그리스도의\s*이름으로\s*기도합니다$/g, "기도함");
    t = t.replace(/되어지는\s+부분인데$/g, "되어야 할 부분");
    t = t.replace(/누리고\s+있어야\s+된다는\s+것$/g, "누려야 함을 확인함");
    t = t.replace(/되지\s+않을까라는\s*생각함$/g, "준비되길 기대함");
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
    t = t.replace(/남겨보면$/g, "남겨보는 것이 중요함");
    t = t.replace(/거예요$|거든$|잖아$/g, "");
    t = t.replace(/\s{2,}/g, " ").replace(/^[,\s]+|[,\s]+$/g, "").trim();
    if (t.length > 135) {
      const words = t.slice(0, 132).split(/\s+/);
      words.pop();
      t = words.join(" ") + "…";
    }
    return t;
  }

  function summarizeSpeaker(text, maxPoints = 3) {
    const clauses = splitClauses(text);
    if (!clauses.length) return { points: [], bestWord: "" };

    const WORD_KWS = ["말씀", "언약", "기도수첩", "강단", "메시지", "CVDIP", "망대", "절대여정", "신분", "권세", "왕", "선지자", "제사장", "서밋", "달란트", "전문성", "미션", "성취"];
    const STATE_KWS = ["상태", "깨닫", "치유", "각인", "고민", "두려", "의지", "벅차", "집중", "졸", "학업", "미래"];
    const ACTION_KWS = ["기도", "도전", "방향", "결단", "작품", "확인", "아침", "밤", "3오늘", "포럼", "기록", "살릴"];

    const scored = clauses.map((raw, idx) => {
      const p = polishPoint(raw);
      if (p.length < 10 || /^(?:이상입니다|감사합니다|아멘)$/.test(p)) return null;
      if (/^(?:그\s*부분에\s*대해서|일단\s*한번|어떻게\s*잘|우리도\s*예전에|한번\s*해볼게|잘\s*올려주면|사무엘은\s*하던|주호는\s*조금|이\s*시기에\s*미래에\s*대한\s*고민이)/.test(p)) return null;

      let wScore = 0, sScore = 0, aScore = 0;
      for (const k of WORD_KWS) if (raw.includes(k)) wScore += 3;
      for (const k of STATE_KWS) if (raw.includes(k)) sScore += 3;
      for (const k of ACTION_KWS) if (raw.includes(k)) aScore += 3;

      const total = wScore + sScore + aScore + (p.length >= 18 && p.length <= 110 ? 3 : 0);
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
        return { name: b.name, points: res.points, bestWord: res.bestWord, raw: b.lines.join("\n") };
      })
      .filter(s => s.points.length);

    const leader = speakers[speakers.length - 1] || speakers[0];
    const flatPoints = speakers.flatMap(s => s.points.map(p => `[${s.name}] ${p}`));

    return {
      kind: "forum",
      date,
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
    const sections = { preamble: [], evangelism: [], word: [], prayer: [], witness: [], forum: [] };
    let mode = "preamble";

    const SEC_RE = /^\s*(?:\d+[.)]\s*|[\[【])?\s*(오늘의\s*전도|오늘의\s*말씀|오늘의\s*기도|오늘의\s*증거|포럼|말씀\s*성취|기도\s*응답|전도\s*역사)\s*[\]】:]?\s*(.*)$/;

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
        else mode = "witness";
        if (sm[2].trim()) sections[mode].push(sm[2].trim());
        continue;
      }
      if (/^(?:이게\s*3오늘|3오늘\s*끝)/.test(rawLine)) continue;
      sections[mode].push(rawLine);
    }

    const wordLines = sections.word.filter(Boolean);
    let ref = "", wordTitle = "", wordPoints = [];
    for (const wl of wordLines) {
      const rm = wl.match(/^(?:본문|성경)\s*[:：]\s*(.+)$/);
      const tm = wl.match(/^(?:제목|말씀\s*제목)\s*[:：]\s*(.+)$/);
      if (rm) ref = rm[1].trim();
      else if (tm) wordTitle = tm[1].trim();
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
      word: { ref, title: wordTitle, points: wordPoints },
      prayer,
      evangelism,
      witness: { morning: "", day: "", night: "", fulfilled: [], answers: [], evangelism: [] },
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

  window.JournalParser = { parseSubmission, formatForumTextarea, parseForumTextarea };
})();
