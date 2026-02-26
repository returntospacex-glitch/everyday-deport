import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Sidebar } from "@/components/Sidebar";
import { ClientLayout } from "@/components/ClientLayout";
import { TopRightControls } from "@/components/TopRightControls";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "EveryDay | 프리미엄 루틴 매니저",
    description: "당신의 하루를 더 특별하게 만드는 루틴 관리 서비스",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko">
            <body className={inter.className}>
                <AuthProvider>
                    <ClientLayout>
                        <Sidebar />
                        <TopRightControls />
                        <main className="pl-72 min-h-screen">
                            <div className="p-8 max-w-[1600px] mx-auto">
                                {children}
                            </div>
                        </main>
                    </ClientLayout>
                </AuthProvider>
            </body>
        </html>
    );
}
