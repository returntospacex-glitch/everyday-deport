"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading && !user && pathname !== "/login") {
            router.push("/login");
        }
    }, [user, loading, pathname, router]);

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-[#0a0a0c]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
            </div>
        );
    }

    return <>{children}</>;
}
