"use client";

import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";
import { BackgroundMusic } from "./BackgroundMusic";
import { usePathname } from "next/navigation";

export function TopRightControls() {
    const { user, logout } = useAuth();
    const pathname = usePathname();

    if (!user || pathname === "/login") return null;

    return (
        <div className="fixed top-6 right-8 z-50 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <BackgroundMusic />
            <button
                onClick={() => logout()}
                className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-white/50 transition-all group shadow-lg"
                title="로그아웃"
            >
                <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
        </div>
    );
}
