"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

export async function analyzeMeals(meals: any[], customInstructions?: string) {
    if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY is not defined in environment variables");
        return { success: false, error: "서버 설정 오류: API Key가 없습니다. Vercel 환경 변수를 확인해주세요." };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    try {
        // Fully verified working identifiers for this specific API environment
        const modelsToTry = [
            "gemini-2.5-flash",
            "gemini-flash-latest",
            "gemini-pro-latest",
            "gemini-2.0-flash"
        ];
        let lastError: any = null;
        let finalResponse = null;

        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.8,
                        topK: 40,
                    }
                });
                const mealDataStr = meals.map(m => `- ${m.type}: ${m.menu} (${m.calories || '정보 없음'} kcal)`).join("\n");

                const prompt = `
당신은 현장 감각이 뛰어난 임상 영양사 및 식단 분석 전문가입니다. 사용자가 기록한 최근 5가지 식단 데이터를 바탕으로 **'교과서적인 잔소리'를 배제하고 실질적인 피드백**을 제공해주세요.

[식단 데이터]
${mealDataStr}

[사용자 배경 및 커스텀 지시사항]
${customInstructions || "특별한 추가 지시사항 없음."}

[분석 및 리포트 작성 지침]
1. **분석 태도:** "건강에 나쁘다", "심혈관 질환 위험" 같은 원론적인 경고나 상식 나열은 생략하세요. 데이터 사이언스를 전공하는 사용자에게 맞게 **데이터 기반의 대사적 영향**을 직관적으로 짚어주세요.
2. **식사 흐름 분석:** 끼니별 나열이 아니라, 전체적인 영양 불균형(예: 탄수화물 과잉, 나트륨 편중 등)의 핵심 원인을 한 문장으로 요약하세요.
3. **현실적인 실전 팁:** 사용자는 '슈퍼푸드'가 아닌 **'건강한 일반식'**을 원합니다. 기존 메뉴(칼국수, 규동 등)의 틀을 깨지 않으면서도, 식사 순서 조절이나 사이드 메뉴 추가 등을 통해 바로 실천 가능한 '한 끗 차이' 대안을 제시하세요.
4. **체감 가능한 피드백:** 장기적인 질환보다는 "오후의 피로도", "포만감 지속", "혈당 스파이크로 인한 가짜 허기" 등 사용자가 일상에서 바로 느낄 수 있는 변화를 예측하세요.

[응답 형식]
- Markdown 형식을 사용하세요.
- 섹션 구성: [종합 영양 분석 & 요약], [체감 대사 영향 예측], [민혁님을 위한 맞춤형 '일반식' 최적화 팁].
- 불필요한 이모지나 가벼운 수식어는 배제하고 전문적이면서도 실용적인 톤을 유지하세요.
- 언어: 한국어.
`;

                const result = await model.generateContent(prompt);
                const response = await result.response;
                finalResponse = response.text();
                if (finalResponse) break;
            } catch (err: any) {
                lastError = err;
                console.warn(`Failed to analyze with model ${modelName}:`, err.message);
                if (err.message?.includes("404") || err.message?.includes("not found")) {
                    continue;
                }
                // Don't throw here, just continue to try other models or handle at the end
            }
        }

        if (!finalResponse) {
            return { success: false, error: lastError?.message || "사용 가능한 AI 모델을 찾을 수 없거나 분석에 실패했습니다." };
        }

        return { success: true, data: finalResponse };
    } catch (error: any) {
        console.error("Gemini API Detailed Error:", error);
        const errorMsg = error.message?.includes("API key not valid")
            ? "유효하지 않은 API Key입니다."
            : `AI 분석 실패: ${error.message || "알 수 없는 오류"}`;
        return { success: false, error: errorMsg };
    }
}
