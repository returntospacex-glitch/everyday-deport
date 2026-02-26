"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

export async function analyzeMeals(meals: any[], customInstructions?: string) {
    if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY is not defined in environment variables");
        throw new Error("서버 설정 오류: API Key가 없습니다.");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    try {
        // Efficient and widely available models
        const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-2.0-flash", "gemini-pro"];
        let lastError: any = null;
        let finalResponse = null;

        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const mealDataStr = meals.map(m => `- ${m.type}: ${m.menu} (${m.calories || '정보 없음'} kcal)`).join("\n");

                const prompt = `
당신은 전문 임상 영양사 및 식단 분석 전문가입니다. 사용자가 최근에 기록한 다음 5가지 식단 데이터를 바탕으로 전문적이고 객관적인 영양 분석 리포트를 작성해주세요.

[식단 데이터]
${mealDataStr}

[분석 지침]
1. 분석 태도: 장난스러운 톤이나 감성적인 응원보다는 데이터에 기반한 전문적이고 진지한 피드백을 제공하세요.
2. 영양적 평가: 각 식사군(탄단지)의 균형 상태를 객관적으로 평가하고, 특히 칼로리 정보가 없는 경우에도 식단 명칭을 통해 유추 가능한 영양적 특징을 분석하세요.
3. 구체적인 일반식 추천: 사용자는 채소를 과하게 먹기보다는 '건강한 일반식'을 선호합니다. 현재 식단 흐름을 유지하되, 바로 실천 가능한 구체적인 일반식 메뉴나 조리법을 1~2개 추천하세요. (예: 백미 대신 잡곡밥, 튀김류 대신 찜/구이류 제안 등)
4. 대사적 영향: 이 식단 구성이 혈당 조절이나 장기적인 에너지 수준에 미칠 영향에 대해 과학적인 관점에서 언급하세요.

[사용자 커스텀 지시사항]
${customInstructions || "특별한 추가 지시사항 없음."}

[응답 형식]
- Markdown 형식을 사용하세요.
- 섹션 구성: [종합 영양 평가], [대사 및 신체적 영향 예측], [임상적 개선 제안 및 추천 식단].
- 불필요한 이모지나 가벼운 수식어는 배제하고 전문적인 용어를 적절히 사용하세요.
- 언어: 한국어.
`;

                const result = await model.generateContent(prompt);
                const response = await result.response;
                finalResponse = response.text();
                if (finalResponse) break; // Success!
            } catch (err: any) {
                lastError = err;
                console.warn(`Failed to analyze with model ${modelName}:`, err.message);
                if (err.message?.includes("404") || err.message?.includes("not found")) {
                    continue; // Try next model
                }
                throw err; // Stop for other types of errors (e.g., auth, quota)
            }
        }

        if (!finalResponse) {
            throw lastError || new Error("사용 가능한 AI 모델이 없습니다.");
        }

        return finalResponse;
    } catch (error: any) {
        console.error("Gemini API Detailed Error:", error);
        if (error.message?.includes("API key not valid")) {
            throw new Error("유효하지 않은 API Key입니다.");
        }
        throw new Error(`AI 분석 실패: ${error.message || "알 수 없는 오류"}`);
    }
}
