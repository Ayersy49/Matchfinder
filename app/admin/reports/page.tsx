'use client';

import React, { useEffect, useState } from 'react';
import { useMe } from '@/lib/useMe';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { ShieldBan, User, ArrowLeft } from 'lucide-react';
import BanUserModal from '@/components/admin/BanUserModal';

type Report = {
    id: string;
    reason: string;
    description?: string;
    createdAt: string;
    reporter: { id: string; name?: string; username?: string };
    reported: { id: string; name?: string; username?: string };
};

export default function AdminReportsPage() {
    const { me, loading: meLoading } = useMe();
    const router = useRouter();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [banModalOpen, setBanModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);

    useEffect(() => {
        if (!meLoading) {
            if (me?.role !== 'ADMIN') {
                router.push('/');
                return;
            }
            fetchReports();
        }
    }, [me, meLoading, router]);

    const fetchReports = async () => {
        try {
            const data = await api('/admin/reports');
            setReports(data);
        } catch (err) {
            console.error(err);
            alert('Raporlar yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const handleBanClick = (user: { id: string; name?: string; username?: string }) => {
        setSelectedUser({
            id: user.id,
            name: user.name || user.username || 'Kullanıcı',
        });
        setBanModalOpen(true);
    };

    if (meLoading || loading) {
        return <div className="p-8 text-center text-white">Yükleniyor...</div>;
    }

    if (me?.role !== 'ADMIN') return null;

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 pb-24">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => router.back()} className="p-2 bg-white/10 rounded-full">
                    <ArrowLeft className="size-6" />
                </button>
                <h1 className="text-2xl font-bold">Raporlar (Admin)</h1>
            </div>

            <div className="space-y-4">
                {reports.length === 0 ? (
                    <div className="text-center text-white/50 py-12">Henüz rapor yok.</div>
                ) : (
                    reports.map((report) => (
                        <div key={report.id} className="bg-slate-900 p-4 rounded-lg border border-white/10">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-sm font-bold">
                                        {report.reason}
                                    </span>
                                    <span className="text-xs text-white/40">
                                        {new Date(report.createdAt).toLocaleString('tr-TR')}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleBanClick(report.reported)}
                                    className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                                >
                                    <ShieldBan className="size-4" />
                                    Banla
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                                <div>
                                    <div className="text-white/40 mb-1">Raporlanan:</div>
                                    <div className="flex items-center gap-2 font-medium text-red-200">
                                        <User className="size-4" />
                                        {report.reported.name || report.reported.username || 'Gizli'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-white/40 mb-1">Raporlayan:</div>
                                    <div className="flex items-center gap-2 font-medium text-blue-200">
                                        <User className="size-4" />
                                        {report.reporter.name || report.reporter.username || 'Gizli'}
                                    </div>
                                </div>
                            </div>

                            {report.description && (
                                <div className="bg-black/30 p-3 rounded text-sm text-white/80 italic">
                                    "{report.description}"
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {selectedUser && (
                <BanUserModal
                    open={banModalOpen}
                    onClose={() => setBanModalOpen(false)}
                    userId={selectedUser.id}
                    userName={selectedUser.name}
                />
            )}
        </div>
    );
}
