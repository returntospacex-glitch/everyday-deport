"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, ArrowRight } from "lucide-react";

export default function LoginPage() {
    const { user, login } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (user) {
            router.push("/");
        }
    }, [user, router]);

    const handleLogin = async () => {
        try {
            await login();
            router.push("/");
        } catch (error) {
            console.error("Login failed:", error);
        }
    };

    return (
        <div className="h-[80vh] flex flex-col items-center justify-center text-center px-4">
            <div className="w-20 h-20 bg-accent rounded-3xl flex items-center justify-center shadow-2xl shadow-accent/40 mb-8 animate-pulse">
                <Sparkles className="text-white w-10 h-10" />
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                EveryDay
            </h1>

            <p className="text-white/40 text-lg mb-12 max-w-sm mx-auto leading-relaxed">
                당신의 하루를 더 특별하게 만드는<br />
                프리미엄 루틴 매니저 서비스입니다.
            </p>

            <button
                onClick={handleLogin}
                className="group relative px-8 py-4 bg-white text-black font-bold rounded-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all duration-200"
            >
                구글 계정으로 시작하기
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="mt-16 grid grid-cols-3 gap-8 w-full max-w-2xl opacity-40">
                <div className="text-center">
                    <div className="text-2xl font-bold mb-1">Simple</div>
                    <div className="text-sm">간편한 관리</div>
                </div>
                <div className="text-center border-x border-white/10 px-8">
                    <div className="text-2xl font-bold mb-1">Clean</div>
                    <div className="text-sm">직관적인 UX</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold mb-1">Impact</div>
                    <div className="text-sm">성장하는 하루</div>
                </div>
            </div>
        </div>
    );
}
