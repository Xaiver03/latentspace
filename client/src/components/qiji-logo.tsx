interface QijiLogoProps {
  className?: string;
  size?: number;
}

export default function QijiLogo({ className = "", size = 32 }: QijiLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 奇绩logo设计 - 蓝色版本 */}
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
      </defs>
      
      {/* 外围圆环 */}
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke="url(#gradient)"
        strokeWidth="3"
      />
      
      {/* 内部几何图形 - 代表"奇" */}
      <path
        d="M25 35 L45 20 L65 35 L55 50 L75 65 L45 80 L25 65 L35 50 Z"
        fill="url(#gradient)"
        opacity="0.8"
      />
      
      {/* 中心点 - 代表"绩" */}
      <circle
        cx="50"
        cy="50"
        r="8"
        fill="#FFFFFF"
        stroke="url(#gradient)"
        strokeWidth="2"
      />
      
      {/* 连接线条 */}
      <line x1="25" y1="35" x2="50" y2="50" stroke="url(#gradient)" strokeWidth="2" opacity="0.6" />
      <line x1="75" y1="65" x2="50" y2="50" stroke="url(#gradient)" strokeWidth="2" opacity="0.6" />
      <line x1="65" y1="35" x2="50" y2="50" stroke="url(#gradient)" strokeWidth="2" opacity="0.6" />
      <line x1="25" y1="65" x2="50" y2="50" stroke="url(#gradient)" strokeWidth="2" opacity="0.6" />
    </svg>
  );
}