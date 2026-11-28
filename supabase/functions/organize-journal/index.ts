// Supabase Edge Function: 20명 전체 회원이 API 키 없이도 AI 문맥 정리를 사용할 수 있도록 지원
// 배포 후 Supabase Secrets 에 GEMINI_API_KEY 를 설정하면 모든 회원이 자동으로 사용합니다.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT = `당신은 기독교 '3오늘(오늘의 말씀·기도·전도)'과 팀 점검 포럼을 정리하는 신실하고 세심한 도우미입니다.
사용자가 입력한 글(음성 녹취, 두서없이 적은 묵상, 구어체 포럼 등)을 단순히 문장 단위로 기계적으로 자르지 말고, 먼저 글 전체의 흐름과 영적 문맥을 깊이 파악한 뒤 아래 기준에 맞춰 내용을 재구성해 자연스러운 한국어로 정리하세요.

핵심 원칙:
1. 원문에 없는 성경 구절, 사건, 응답을 절대 지어내지 마세요. 두서없는 말투("이제", "막", "약간", 비문 등)만 문맥에 맞게 매끄럽고 바른 문장으로 다듬어 주세요.
2. 억지 끼워 넣기 및 단순 문장 절단 절대 금지:
   - 문장을 기계적으로 쪼개서 아무 칸에나 끼워 넣지 마세요.
   - 아래 '증인의 간증(witness)' 세 항목은 원문에 해당 내용이 명확히 드러난 경우에만 문맥을 살려 자연스러운 한두 문장으로 정리해 넣으세요.
   - 원문에 해당 내용이 명확하지 않거나 단순 소원·다짐·일반 말씀 요약뿐이라면 절대 억지로 넣지 말고 반드시 빈 배열 [] 로 두세요.

3. 증인의 간증(witness) 엄격 분류 기준:
   - 말씀 성취 (wordFulfillment -> JSON 키: witness.fulfilled):
     붙잡은 강단·현장 말씀이나 언약이 실제 삶, 생각, 사건 속에서 어떻게 확인되고 이루어졌는지에 대한 내용.
     (주의: 단순히 "오늘 이런 말씀을 들었다", "앞으로 성취되길 바란다"는 내용이나 다짐·권면은 여기에 넣지 말고 word 항목에만 정리하세요.)
   - 기도 응답 (prayerAnswer -> JSON 키: witness.answers):
     기도 제목을 놓고 기도한 결과로 받은 평안, 생각의 변화, 환경의 열림, 응답받은 증거에 대한 내용.
     (주의: 아직 이루어지지 않은 단순 기도 요청·간구는 prayer 항목에만 넣고 여기는 비워두세요.)
   - 전도 역사 (evangelismHistory -> JSON 키: witness.evangelism):
     현장 만남, 복음 제시, 영접, 다락방/양육 연결, 대상자를 향한 하나님의 역사에 대한 내용.
     (주의: 단순 기도 대상자 명단이나 "만나길 기도한다"는 계획은 상단 evangelism(오늘의 전도) 항목에만 넣고 여기는 비워두세요.)

4. 강단·현장 말씀, 기도, 전도 및 팀 포럼 정리:
   - 강단 말씀(word.pulpit)과 현장·기도수첩 말씀(word.field)을 구분하고, word.points에 전체 말씀 흐름을 1~3문장으로 요약하세요.
   - 기도 제목(prayer)과 오늘의 전도 대상·계획(evangelism)을 문맥에 맞게 깔끔히 정돈하세요.
   - 팀 포럼(forum.speakers)은 참석자별로 붙잡은 말씀/언약, 오늘 돌아본 영적 상태·깨달음, 기도/도전을 문맥이 이어지는 완전하고 자연스러운 2~3문장으로 요약하세요.
   - covenant에는 글 전체를 관통하는 오늘의 핵심 언약 한 문장을 담으세요.

반드시 유효한 JSON 객체만 출력하세요:
{
  "kind": "threeToday | forum | both",
  "date": "YYYY-MM-DD",
  "covenant": "핵심 언약 한 문장",
  "ref": "명시된 성경 구절(없으면 빈 문자열)",
  "word": { "ref": "", "title": "", "pulpit": [], "field": [], "points": [] },
  "prayer": [],
  "evangelism": [],
  "witness": {
    "morning": "",
    "day": "",
    "night": "",
    "fulfilled": ["명확한 말씀 성취 한두 문장 (없으면 [])"],
    "answers": ["명확한 기도 응답 한두 문장 (없으면 [])"],
    "evangelism": ["명확한 전도 역사 한두 문장 (없으면 [])"]
  },
  "forum": { "name": "", "speakers": [{ "name": "", "points": [] }] }
}`;

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), { status: 501, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { text, today } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text is required" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const userMsg = `오늘 기준 날짜는 ${today || new Date().toISOString().slice(0, 10)} 입니다.\n\n[원문]\n${text.slice(0, 16000)}`;
    const models = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-2.5-flash"];
    let rawOut = "";
    let lastErrMsg = "AI call failed";

    for (const model of models) {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userMsg }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });

      const data = await resp.json();
      const parts = Array.isArray(data?.candidates?.[0]?.content?.parts) ? data.candidates[0].content.parts : [];
      const textPart = parts
        .filter((p: Record<string, unknown>) => p && !p.thought && typeof p.text === "string")
        .map((p: Record<string, unknown>) => String(p.text))
        .join("\n")
        || String(parts.find((p: Record<string, unknown>) => typeof p?.text === "string")?.text ?? "");

      if (resp.ok && textPart) {
        rawOut = textPart;
        break;
      }
      lastErrMsg = data?.error?.message || `Gemini error (${resp.status})`;
      if (resp.status !== 404 && !/no longer available|not found|deprecated/i.test(lastErrMsg)) {
        return new Response(JSON.stringify({ error: lastErrMsg }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
      }
    }

    if (!rawOut) {
      return new Response(JSON.stringify({ error: lastErrMsg }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const cleaned = String(rawOut).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let parsedOut: Record<string, unknown>;
    try {
      parsedOut = JSON.parse(cleaned);
    } catch {
      return new Response(rawOut, { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const w = (parsedOut.witness && typeof parsedOut.witness === "object")
      ? (parsedOut.witness as Record<string, unknown>)
      : {};

    parsedOut.witness = {
      morning: String(w.morning ?? "").trim(),
      day: String(w.day ?? "").trim(),
      night: String(w.night ?? "").trim(),
      fulfilled: toStringList(w.fulfilled ?? w.wordFulfillment ?? parsedOut.wordFulfillment),
      answers: toStringList(w.answers ?? w.prayerAnswer ?? parsedOut.prayerAnswer),
      evangelism: toStringList(w.evangelism ?? w.evangelismHistory ?? parsedOut.evangelismHistory),
    };

    return new Response(JSON.stringify(parsedOut), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
