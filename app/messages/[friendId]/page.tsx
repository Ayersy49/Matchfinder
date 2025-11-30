'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMe } from '@/lib/useMe';
import { authHeader } from '@/lib/auth';
import { ArrowLeft, Send } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Message = {
    id: string;
    text: string;
    senderId: string;
    createdAt: string;
};

export default function ChatPage() {
    const router = useRouter();
    const params = useParams();
    const friendId = params.friendId as string;
    const { me, loading: meLoading } = useMe();

    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [friendName, setFriendName] = useState('Sohbet');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch messages
    useEffect(() => {
        if (meLoading || !me) return;

        const loadMessages = () => {
            fetch(`${API_URL}/direct-messages/${friendId}`, {
                headers: { ...authHeader() },
            })
                .then((res) => {
                    if (res.status === 403) {
                        alert("Bu kişiyle mesajlaşmak için arkadaş olmalısınız.");
                        router.push('/messages');
                        return [];
                    }
                    return res.json();
                })
                .then((data) => {
                    if (Array.isArray(data)) {
                        setMessages(data);
                    }
                })
                .catch(console.error);
        };

        // Fetch friend details (optional, can be optimized)
        fetch(`${API_URL}/users/${friendId}`, { headers: { ...authHeader() } })
            .then(r => r.json())
            .then(u => setFriendName(u.name || u.username || 'Arkadaş'))
            .catch(() => { });

        loadMessages();
        const interval = setInterval(loadMessages, 5000); // Polling for new messages
        return () => clearInterval(interval);
    }, [me, meLoading, friendId, router]);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim() || sending) return;

        setSending(true);
        try {
            const res = await fetch(`${API_URL}/direct-messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeader(),
                },
                body: JSON.stringify({ receiverId: friendId, text }),
            });

            if (res.ok) {
                const newMsg = await res.json();
                setMessages((prev) => [...prev, newMsg]);
                setText('');
            } else {
                alert('Mesaj gönderilemedi.');
            }
        } catch (error) {
            console.error(error);
            alert('Hata oluştu.');
        } finally {
            setSending(false);
        }
    };

    if (meLoading) return <div className="min-h-screen bg-neutral-950 text-white p-4">Yükleniyor...</div>;

    return (
        <div className="flex h-screen flex-col bg-neutral-950 text-white">
            {/* Header */}
            <header className="flex items-center gap-3 border-b border-white/10 bg-neutral-950/80 p-4 backdrop-blur">
                <button onClick={() => router.back()} className="rounded-full p-2 hover:bg-white/10">
                    <ArrowLeft className="size-5" />
                </button>
                <h1 className="text-lg font-semibold">{friendName}</h1>
            </header>

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => {
                    const isMe = msg.senderId === me?.id;
                    return (
                        <div
                            key={msg.id}
                            className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMe
                                        ? 'bg-emerald-600 text-white rounded-tr-none'
                                        : 'bg-neutral-800 text-neutral-200 rounded-tl-none'
                                    }`}
                            >
                                {msg.text}
                                <div className={`text-[10px] mt-1 opacity-70 ${isMe ? 'text-emerald-200' : 'text-neutral-400'}`}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Input Area */}
            <form onSubmit={sendMessage} className="border-t border-white/10 bg-neutral-900 p-4">
                <div className="flex gap-2">
                    <input
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Mesaj yaz..."
                        className="flex-1 rounded-full bg-neutral-800 px-4 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-emerald-500"
                    />
                    <button
                        type="submit"
                        disabled={!text.trim() || sending}
                        className="flex items-center justify-center rounded-full bg-emerald-600 p-2 text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                        <Send className="size-5" />
                    </button>
                </div>
            </form>
        </div>
    );
}
