"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";
import { collection, query, where, getDocs, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { startOfDay } from "date-fns";

export default function CleanupPage() {
    const { user } = useAuth();
    const [status, setStatus] = useState<string>("");
    const [isProcessing, setIsProcessing] = useState(false);

    const purgeOldRecords = async () => {
        if (!user) {
            setStatus("로그인이 필요합니다.");
            return;
        }

        if (!confirm("정말로 오늘(2026-02-26) 이전의 모든 기록을 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다)")) {
            return;
        }

        setIsProcessing(true);
        setStatus("삭제 작업 시작 중...");

        const db = getFirebaseDb();
        const collectionsToClean = ["sleep", "exercises", "meals", "readingSessions", "dailyRecords", "bodyMetrics", "books"];
        const today = startOfDay(new Date(2026, 1, 26)); // Feb 26, 2026

        try {
            let totalDeleted = 0;

            for (const colName of collectionsToClean) {
                setStatus(`${colName} 컬렉션 처리 중...`);
                const colRef = collection(db, "users", user.uid, colName);
                const snapshot = await getDocs(colRef);

                for (const document of snapshot.docs) {
                    const data = document.data();
                    let recordDate: Date | null = null;

                    // Try to extract date from various possible fields
                    const dateVal = data.date || data.startDate || data.createdAt;

                    if (dateVal) {
                        recordDate = dateVal instanceof Timestamp ? dateVal.toDate() : new Date(dateVal);
                    }

                    // If date is before today, delete it
                    if (recordDate && recordDate < today) {
                        await deleteDoc(doc(db, "users", user.uid, colName, document.id));
                        totalDeleted++;
                    }
                }
            }

            setStatus(`삭제 완료! 총 ${totalDeleted}개의 레거시 레코드가 성공적으로 제거되었습니다.`);
        } catch (error) {
            console.error(error);
            setStatus(`오류 발생: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white p-20 flex flex-col items-center justify-center">
            <div className="max-w-md w-full bg-[#0b1121] border border-white/10 p-10 rounded-3xl shadow-2xl">
                <h1 className="text-3xl font-black mb-6 text-center">데이터 클린업</h1>
                <p className="text-white/60 mb-8 text-center leading-relaxed">
                    오늘(**2026년 2월 26일**) 이전의 모든 임의 데이터를 Firestore에서 영구적으로 삭제합니다.
                </p>

                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-8">
                    <p className="text-red-400 text-sm font-bold text-center">
                        ⚠️ 주의: 삭제된 데이터는 복구할 수 없습니다.
                    </p>
                </div>

                <button
                    onClick={purgeOldRecords}
                    disabled={isProcessing}
                    className={`w-full py-4 rounded-xl font-black text-lg transition-all ${isProcessing
                            ? "bg-white/10 text-white/40 cursor-not-allowed"
                            : "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 active:scale-95"
                        }`}
                >
                    {isProcessing ? "처리 중..." : "이전 기록 모두 삭제하기"}
                </button>

                {status && (
                    <div className="mt-8 p-4 bg-white/5 border border-white/10 rounded-xl">
                        <p className="text-sm text-center font-mono text-accent">{status}</p>
                    </div>
                )}
            </div>

            <p className="mt-10 text-white/20 text-xs">
                작업이 완료되면 이 페이지(`/admin/cleanup`)를 삭제해 주세요.
            </p>
        </div>
    );
}
