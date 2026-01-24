
import React from 'react';
import { LakiMood, LakiShape, ThemeMode } from '../types';

interface LakiAvatarProps {
  mood: LakiMood;
  shape?: LakiShape;
  theme?: ThemeMode;
}

const LakiAvatar: React.FC<LakiAvatarProps> = ({ mood, shape = LakiShape.CLOUD, theme = ThemeMode.MORNING }) => {
  
  // Dynamic color based on Theme
  const getBodyColor = () => {
    switch (theme) {
      case ThemeMode.MORNING: return "fill-white/90 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]";
      case ThemeMode.NOON: return "fill-white/95 drop-shadow-[0_0_20px_rgba(255,255,255,1)]";
      case ThemeMode.SUNSET: return "fill-rose-50/90 drop-shadow-[0_0_15px_rgba(255,180,180,0.6)]"; // Pinkish
      case ThemeMode.NIGHT: return "fill-indigo-50/80 drop-shadow-[0_0_10px_rgba(200,200,255,0.3)]"; // Cool white
      case ThemeMode.ANXIETY_RELIEF: return "fill-blue-50/90 drop-shadow-[0_0_20px_rgba(100,200,255,0.5)]"; // Calming Blue
      case ThemeMode.HIGH_ENERGY: return "fill-orange-50/90 drop-shadow-[0_0_20px_rgba(255,200,100,0.6)]"; // Energetic
      default: return "fill-white/80";
    }
  };

  const renderBody = () => {
    const className = `${getBodyColor()} transition-all duration-[2000ms] ease-in-out`;
    
    switch (shape) {
      case LakiShape.RABBIT:
        return <path d="M 60 90 Q 50 60 60 40 Q 70 20 85 50 Q 115 50 115 50 Q 130 20 140 40 Q 150 60 140 90 Q 170 100 170 130 Q 170 160 140 170 Q 100 180 60 170 Q 30 160 30 130 Q 30 100 60 90 Z" className={className} />;
      case LakiShape.CAT:
        return <path d="M 50 100 Q 40 70 60 60 L 50 30 L 80 50 Q 120 50 120 50 L 150 30 L 140 60 Q 160 70 150 100 Q 170 130 150 160 Q 100 175 50 160 Q 30 130 50 100 Z" className={className} />;
      case LakiShape.DOG:
        return <path d="M 60 80 Q 40 90 30 120 Q 40 150 60 140 Q 60 170 100 170 Q 140 170 140 140 Q 160 150 170 120 Q 160 90 140 80 Q 130 50 100 50 Q 70 50 60 80 Z" className={className} />;
      case LakiShape.WHALE:
        return <path d="M 40 120 Q 40 80 100 80 Q 160 80 180 120 Q 190 110 200 100 Q 200 130 180 140 Q 160 170 100 170 Q 40 170 40 120 Z" className={className} />;
      case LakiShape.BIRD:
        return <path d="M 60 100 Q 40 70 70 60 Q 90 60 110 80 Q 150 40 170 60 Q 150 90 130 100 Q 150 130 120 140 Q 90 145 60 130 Q 30 120 60 100 Z" className={className} />;
      case LakiShape.FLOWER:
        return <path d="M 100 60 Q 120 40 140 60 Q 160 80 140 100 Q 160 120 140 140 Q 120 160 100 140 Q 80 160 60 140 Q 40 120 60 100 Q 40 80 60 60 Q 80 40 100 60 Z" className={className} />;
      case LakiShape.CLOUD:
      default:
        return <path d="M 50 100 Q 15 100 15 75 Q 15 45 45 45 Q 55 15 85 20 Q 110 0 135 25 Q 175 15 175 60 Q 195 95 155 110 Q 175 150 125 150 Q 85 160 55 145 Q 15 140 50 100 Z" className={className} />;
    }
  };

  const renderShading = () => (
     <path d="M 60 80 Q 50 60 70 50" fill="none" stroke="white" strokeWidth="3" strokeOpacity="0.4" className="mix-blend-overlay" />
  );

  const renderGlasses = () => {
      if (mood === LakiMood.STUDY) {
          return (
              <g className="transition-all duration-500 animate-pulse-soft">
                  <circle cx="85" cy="105" r="14" fill="rgba(255,255,255,0.3)" stroke="#5e5050" strokeWidth="2.5" />
                  <circle cx="125" cy="105" r="14" fill="rgba(255,255,255,0.3)" stroke="#5e5050" strokeWidth="2.5" />
                  <path d="M 99 105 Q 105 100 111 105" stroke="#5e5050" strokeWidth="2.5" fill="none" />
              </g>
          )
      }
      return null;
  };

  const renderDumbbell = () => {
      if (mood === LakiMood.COACH) {
          return (
              <g className="animate-[bounce_1s_infinite]">
                 {/* Floating dumbbell on the right side */}
                 <rect x="155" y="80" width="10" height="40" rx="3" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
                 <rect x="148" y="75" width="24" height="12" rx="4" fill="#64748b" stroke="#334155" strokeWidth="1" />
                 <rect x="148" y="113" width="24" height="12" rx="4" fill="#64748b" stroke="#334155" strokeWidth="1" />
                 
                 {/* Sweat drops */}
                 <path d="M 130 70 Q 135 60 130 50" stroke="#bae6fd" strokeWidth="3" strokeLinecap="round" className="animate-pulse" />
                 <path d="M 140 65 Q 145 55 140 45" stroke="#bae6fd" strokeWidth="3" strokeLinecap="round" className="animate-pulse delay-100" />
              </g>
          )
      }
      return null;
  };

  const renderEyes = () => {
    const eyeColor = theme === ThemeMode.NIGHT ? '#6366f1' : '#8e7f7f'; // Indigo eyes at night
    switch (mood) {
      case LakiMood.HAPPY:
        return <g className="transition-all duration-500"><path d="M75 100 Q85 90 95 100" stroke={eyeColor} strokeWidth="4" fill="none" strokeLinecap="round" /><path d="M115 100 Q125 90 135 100" stroke={eyeColor} strokeWidth="4" fill="none" strokeLinecap="round" /></g>;
      case LakiMood.SHY:
        return <g className="transition-all duration-500"><circle cx="85" cy="105" r="4" fill={eyeColor} /><circle cx="125" cy="105" r="4" fill={eyeColor} /><ellipse cx="70" cy="115" rx="8" ry="5" fill="#fca5a5" opacity="0.6" /><ellipse cx="140" cy="115" rx="8" ry="5" fill="#fca5a5" opacity="0.6" /></g>;
      case LakiMood.COACH: // Energetic eyes
        return <g className="transition-all duration-500"><path d="M 75 110 L 85 100 L 95 110" stroke={eyeColor} strokeWidth="4" fill="none" strokeLinecap="round" /><path d="M 115 110 L 125 100 L 135 110" stroke={eyeColor} strokeWidth="4" fill="none" strokeLinecap="round" /></g>;
      default:
        return <g className="transition-all duration-500"><circle cx="85" cy="105" r="5" fill={eyeColor} /><circle cx="125" cy="105" r="5" fill={eyeColor} /></g>;
    }
  };

  const renderMouth = () => {
    const mouthColor = theme === ThemeMode.NIGHT ? '#6366f1' : '#8e7f7f';
    return <path d="M97 117 Q105 123 113 117" stroke={mouthColor} strokeWidth="3" fill="none" strokeLinecap="round" />;
  };

  return (
    <div className="relative w-72 h-72 flex items-center justify-center animate-float">
      <div className="relative w-full h-full animate-breathe transition-transform duration-700 filter drop-shadow-[0_10px_20px_rgba(255,255,255,0.2)]">
        <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
          {renderBody()}
          {renderShading()}
          {renderEyes()}
          {renderGlasses()}
          {renderDumbbell()}
          {renderMouth()}
          <circle cx="65" cy="115" r="8" fill="#fca5a5" opacity="0.4" className="blur-sm" />
          <circle cx="145" cy="115" r="8" fill="#fca5a5" opacity="0.4" className="blur-sm" />
        </svg>
      </div>
      {theme === ThemeMode.NIGHT && <div className="absolute -top-10 right-0 text-yellow-100 text-lg animate-pulse">✨</div>}
      {shape === LakiShape.BIRD && <div className="absolute -top-4 left-10 text-sky-200 text-lg animate-bounce">♪</div>}
    </div>
  );
};

export default LakiAvatar;
