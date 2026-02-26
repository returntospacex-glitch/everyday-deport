"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Moon,
    Dumbbell,
    BarChart3,
    Calendar,
    Sparkles,
    LogOut,
    Utensils,
    BookOpen
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BackgroundMusic } from './BackgroundMusic';

const menuItems = [
    { name: '대시보드', href: '/', icon: LayoutDashboard },
    { name: '수면 기록', href: '/sleep', icon: Moon },
    { name: '운동 기록', href: '/exercise', icon: Dumbbell },
    { name: '독서 기록', href: '/reading', icon: BookOpen },
    { name: '식사 기록', href: '/meal', icon: Utensils },
    { name: '하루 기록', href: '/daily', icon: Sparkles },
    { name: '캘린더', href: '/calendar', icon: Calendar },
    { name: '통계', href: '/statistics', icon: BarChart3 },
];

export function Sidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    return (
        <div className="w-72 h-screen glass border-r border-white/10 flex flex-col p-8 fixed left-0 top-0">
            <div className="flex items-center gap-3 mb-12">
                <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/20">
                    <Sparkles className="text-white w-6 h-6" />
                </div>
                <h1 className="text-[2.7rem] font-black tracking-tighter bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
                    EveryDay
                </h1>
            </div>

            <nav className="flex-1 space-y-3 mt-4">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={twMerge(
                                "flex items-center gap-4 px-5 py-4 rounded-[20px] transition-all duration-300 group",
                                isActive
                                    ? "bg-accent/10 text-accent shadow-lg shadow-accent/5"
                                    : "text-white/40 hover:bg-white/5 hover:text-white"
                            )}
                        >
                            <item.icon className={clsx("w-7 h-7 transition-transform group-hover:scale-110", isActive ? "text-accent" : "group-hover:text-white")} />
                            <span className="text-[1.2rem] font-black tracking-tight">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            {user && (
                <div className="pt-6 border-t border-white/5 flex items-center justify-between gap-4">
                    <button
                        onClick={() => logout()}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-white/30 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group"
                    >
                        <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-black tracking-tight">로그아웃</span>
                    </button>
                    <div className="flex-1 flex justify-end">
                        <BackgroundMusic />
                    </div>
                </div>
            )}
        </div>
    );
}
