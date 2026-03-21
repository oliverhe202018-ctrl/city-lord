'use client';

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

// 精简版微信常用表情
export const WECHAT_EMOJIS = [
    "😀", "😁", "😂", "🤣", "😃", "😄", "😅", "😆", "😉", "😊", "😋", "😎", "😍", "😘", "😗", "😙", "😚", "☺", "😇", "😐", "😑", "😶", "😏", "😣", "😥", "😮", "😯", "😪", "😫", "😴", "😌", "😛", "😜", "😝", "🤤", "😒", "😓", "😔", "😕", "🙃", "🤑", "😲", "☹", "🙁", "😖", "😞", "😟", "😤", "😢", "😭", "😦", "😧", "😨", "😩", "😬", "😰", "😱", "😳", "😵", "😡", "😠", "😷", "🤒", "🤕", "🤢", "🤧", "🤠", "🤡", "🤥", "🤓", "😈", "👿", "👹", "👺", "💀", "👻", "👽", "🤖", "💩", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾",
    "👍", "👎", "👌", "✌", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💪", "👀", "👁", "👅", "👄", "💋", "💔", "❤️", "🧡", "💛", "💚", "💙", "紫色", "🖤", "🤍", "🤎", "💥", "💫", "汗", "💢", "💭", "💤", "👋", "🤚", "🖐"
];

interface EmojiPickerProps {
    onEmojiSelect: (emoji: string) => void;
    className?: string;
    iconClassName?: string;
}

export function EmojiPicker({ onEmojiSelect, className, iconClassName }: EmojiPickerProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button 
                    type="button" 
                    className={cn("p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full flex-shrink-0", className)}
                >
                    <Smile className={cn("w-5 h-5", iconClassName)} />
                </button>
            </PopoverTrigger>
            <PopoverContent 
                className="w-64 p-2 bg-zinc-900 border-zinc-800 z-50" 
                align="end" 
                sideOffset={8}
            >
                <div className="grid grid-cols-8 gap-1 h-48 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
                    {WECHAT_EMOJIS.map((emoji, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                onEmojiSelect(emoji);
                            }}
                            className="flex items-center justify-center p-1 text-lg hover:bg-white/10 rounded transition-colors"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
