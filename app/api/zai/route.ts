/**
 * Zai (Zero) chat API — Single Source of Truth: buildUserImpact
 * Uses @google/generative-ai (Gemini) for AI responses.
 * Brand voice: lowercase, grounded, witty, never lecturing.
 * Local Living: when postcode/council is present, agent can mention council-specific grants (e.g. Boiler Upgrade Scheme £7,500).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getLocalData } from "@/lib/local/getLocalData";

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey?.trim()) {
  console.error('GEMINI_API_KEY is not set')
}

export async function POST(req: Request) {
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { answer: "i'm not configured yet. try again later." },
      { status: 503 }
    )
  }
  const genAI = new GoogleGenerativeAI(apiKey)
  try {
    const { question, contextData } = await req.json();

    // Sanitize: only numeric values in prompt to prevent prompt injection from contextData
    const totalMoney = typeof contextData?.totals?.totalMoney === 'number'
      ? contextData.totals.totalMoney
      : Number(contextData?.totals?.totalMoney) || 0
    const totalCarbon = typeof contextData?.totals?.totalCarbon === 'number'
      ? contextData.totals.totalCarbon
      : Number(contextData?.totals?.totalCarbon) || 0

    let council: string | null = null
    const postcode = typeof contextData?.postcode === 'string' ? contextData.postcode.replace(/\s+/g, '').trim() : null
    if (postcode && postcode.length >= 4) {
      const local = await getLocalData(postcode)
      council = local?.council ?? null
    }
    if (typeof contextData?.council === 'string' && contextData.council.length <= 80) {
      council = contextData.council
    }

    const locationLine = council
      ? ` user is in ${council}: when relevant mention they're eligible for local grants (e.g. Warm Homes, Boiler Upgrade Scheme £7,500).`
      : ''

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: `you are zero, an authentic sustainability peer.
      brand voice: strictly lowercase, grounded, witty, never lecturing.
      user data: they are currently saving £${totalMoney} and cutting ${totalCarbon}kg of carbon annually.${locationLine}
      context: focus on uk-specific advice (defra, wrap uk, energy saving trust).
      keep responses under 3 sentences.`
    });

    const result = await model.generateContent(question);
    const response = await result.response;
    const text = response.text().toLowerCase(); // Ensure lowercase brand voice

    return NextResponse.json({ answer: text });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ answer: "i'm having a moment. try asking again in a sec." }, { status: 500 });
  }
}
