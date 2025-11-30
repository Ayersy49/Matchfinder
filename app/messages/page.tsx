'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@/lib/useMe';
import { authHeader } from '@/lib/auth';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Conversation = {
    friend: {
        id: string;
        name: string | null;
        username: string | null;
        phone: string | null;
    };
    lastMessage: {
        id: string;
        text: string;
        createdAt: string;
        senderId: string;
    };
};

export default function MessagesPage() {
    const router = useRouter();
    const { me, loading: meLoading } = useMe();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (meLoading) return;
        if (!me) {
            router.replace('/');
            return;
        }

        fetch(`${API_URL}/direct-messages/conversations`, {
            headers: { ...authHeader() },
        })
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setConversations(data);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [me, meLoading, router]);

    if (meLoading || loading) {
        return <div className="min-h-screen bg-neutral-950 text-white p-4">Yükleniyor...</div>;
    }

    return (
        <div className="min-h-screen bg-neutral-950 text-white">
            <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-neutral-950/80 p-4 backdrop-blur">
                <button onClick={() => router.back()} className="rounded-full p-2 hover:bg-white/10">
                    <ArrowLeft className="size-5" />
                </button>
                <h1 className="text-lg font-semibold">Mesajlar</h1>
            </header>

            <main className="p-4">
                {conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
                        <MessageCircle className="mb-4 size-12 opacity-50" />
                        <p>Henüz mesajın yok.</p>
                        <Link href="/friends" className="mt-4 text-emerald-400 hover:underline">
                            Arkadaşlarına mesaj gönder
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {conversations.map((conv) => (
                            <Link
                                key={conv.friend.id}
                                href={`/messages/${conv.friend.id}`}
                                className="block rounded-xl bg-neutral-900 p-4 hover:bg-neutral-800 transition"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-semibold">
                                            {conv.friend.name || conv.friend.username || 'İsimsiz Kullanıcı'}
                                        </div>
                                        <div className="text-sm text-neutral-400 line-clamp-1">
                                            {conv.lastMessage.senderId === me?.id && 'Sen: '}
                                            {conv.lastMessage.text}
                                        </div>
                                    </div>
                                    <div className="text-xs text-neutral-500 whitespace-nowrap ml-2">
                                        {new Date(conv.lastMessage.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>

            {/* Floating Action Button to start new chat from friends list */}
            <Link
                href="/friends"
                className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-500"
            >
                <MessageCircle className="size-6" />
            </Link>
        </div>
    );
}
