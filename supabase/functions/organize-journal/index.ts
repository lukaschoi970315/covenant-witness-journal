// Supabase Edge Function: 20명 전체 회원이 API 키 없이도 AI 문맥 정리를 사용할 수 있도록 지원
// 배포 후 Supabase Secrets 에 GEMINI_API_KEY 를 설정하면 모든 회원이 자동으로 사용합니다.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT = `당신은 기독교 '3오늘(오늘의 말씀·기도·전도)'과 팀 점검 포럼을 정리하는 도우미입니다.
문장을 기계적으로 자르지 말고 글 전체의 흐름과 영적 맥락을 먼저 이해한 뒤 자연스러운 한국어로 정리하세요.

핵심 원칙:
1. 원문에 없는 성경 구절, 사건, 응답을 절대 지어내지 마세요. 두서없는 말투만 매끄럽고 바른 문장으로 다듬어 주세요.
2. 증인의 간증(witness)은 억지로 채우지 마세요:
   - fulfilled(말씀 성취): 붙잡은 말씀이 오늘 실제 삶/사건에서 성취·확인되었다는 구체적 고백이 있을 때만 작성 (단순 메시지 인용이나 다짐·권면 금지)
   - answers(기도 응답): 기도하던 제목에 대해 실제 주신 응답·변화가 있을 때만 작성 (앞으로의 기도 요청 금지)
   - evangelism(전도 역사): 실제로 복음을 전하거나 만남/열린 문이 일어난 사실이 있을 때만 작성 (단순 기도 명단 금지)
   - 없으면 반드시 빈 배열 [] 로 두세요.
3. 강단 말씀(word.pulpit)과 현장·기도수첩 말씀(word.field)을 구분하세요.
4. 팀 포럼(forum.speakers)은 참석자별로 말씀·상태·기도를 완전하고 자연스러운 2~3문장으로 요약하세요.

반드시 유효한 JSON 객체만 출력하세요:
{
  "kind": "threeToday | forum | both",
  "date": "YYYY-MM-DD",
  "covenant": "핵심 언약 한 문장",
  "ref": "명시된 성경 구절(없으면 빈 문자열)",
  "word": { "ref": "", "title": "", "pulpit": [], "field": [], "points": [] },
  "prayer": [],
  "evangelism": [],
  "witness": { "morning": "", "day": "", "night": "", "fulfilled": [], "answers": [], "evangelism": [] },
  "forum": { "name": "", "speakers": [{ "name": "", "points": [] }] }
}`;

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
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userMsg }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    });

    const data = await resp.json();
    const rawOut = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resp.ok || !rawOut) {
      return new Response(JSON.stringify({ error: data?.error?.message || "AI call failed" }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return new Response(rawOut, { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
