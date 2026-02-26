"use client";

import { BarChart3, TrendingUp, Target, Award } from "lucide-react";
import { motion } from "framer-motion";

export default function StatisticsPage() {
    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            <header>
                <h1 className="text-4xl font-bold mb-2">통계 분석</h1>
                <p className="text-white/40">당신의 성장을 수치로 확인하세요</p>
            </header>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: '이번 주 달성률', value: '84%', icon: Target, color: 'text-blue-400' },
                    { label: '연속 달성일', value: '12일', icon: TrendingUp, color: 'text-emerald-400' },
                    { label: '획득한 뱃지', value: '8개', icon: Award, color: 'text-amber-400' },
                ].map((item, i) => (
                    <div key={i} className="glass p-6 flex flex-col gap-4">
                        <div className={`w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center ${item.color}`}>
                            <item.icon className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white/40 mb-1">{item.label}</p>
                            <p className="text-2xl font-bold">{item.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Charts Placeholder */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="glass p-8 min-h-[400px] flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-bold flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-accent" /> 주간 트렌드
                        </h3>
                        <span className="text-xs text-white/20">최근 7일 기준</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center text-white/10 text-center">
                        Recharts 라이브러리를 통해<br />동적인 데이터 시각화가 렌더링될 영역입니다.
                    </div>
                </div>

                <div className="glass p-8 min-h-[400px] flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-bold flex items-center gap-2">
                            <Award className="w-5 h-5 text-amber-400" /> 카테고리별 집중도
                        </h3>
                    </div>
                    <div className="flex-1 flex items-center justify-center text-white/10 text-center">
                        가장 많이 완료된 카테고리를<br />파이 차트로 시각화합니다.
                    </div>
                </div>
            </div>
        </div>
    );
}
