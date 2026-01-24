
import React from 'react';
import { Message, Role } from '../types';
import { User, Cloud } from 'lucide-react';

interface ChatBubbleProps {
  message: Message;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === Role.USER;

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
        
        {/* Avatar Icon */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${isUser ? 'bg-macaron-pink-dark text-white' : 'bg-white text-sky-400'}`}>
          {isUser ? <User size={16} /> : <Cloud size={16} />}
        </div>

        {/* Bubble */}
        <div className={`
          p-3 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed break-words
          ${isUser 
            ? 'bg-macaron-pink text-soft-brown rounded-br-none' 
            : 'bg-white text-soft-brown rounded-bl-none border border-gray-100'
          }
        `}>
          {message.image && (
            <img 
              src={message.image} 
              alt="Uploaded content" 
              className="max-w-full h-auto rounded-lg mb-2 border border-white/50" 
            />
          )}
          
          {message.audio && (
             <div className="flex items-center gap-2 text-xs opacity-70 mb-1 italic">
                <span>🎤 Audio Message</span>
             </div>
          )}

          {/* Added whitespace-pre-wrap to preserve newlines and list formatting */}
          <p className="whitespace-pre-wrap font-medium">{message.text}</p>
          
          <div className="text-[10px] opacity-50 mt-1 text-right">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;
