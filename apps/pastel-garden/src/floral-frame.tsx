const PETAL_COUNT = 5;
const PETAL_ROTATION = 72;
const blossoms = [
  { x: 40, y: 68, scale: 1.15, color: '#c4d9ed' },
  { x: 70, y: 38, scale: 0.8, color: '#eacfd5' },
  { x: 104, y: 26, scale: 0.55, color: '#c4d9ed' },
  { x: 25, y: 112, scale: 0.9, color: '#eacfd5' },
  { x: 17, y: 151, scale: 0.6, color: '#c4d9ed' },
  { x: 129, y: 17, scale: 0.45, color: '#eacfd5' },
];

export function FloralFrame() {
  return (
    <div className="floral-frame" aria-hidden="true">
      {['top', 'bottom'].map((position) => (
        <svg
          key={position}
          className={`floral-spray floral-spray-${position}`}
          viewBox="0 0 180 210"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M10 198C12 103 30 25 151 12M17 157Q60 95 40 68M29 99Q98 74 104 26M43 54Q57 17 70 38"
            stroke="#91a28d"
            strokeWidth="1.5"
          />
          <g fill="#aab9a0" opacity=".75">
            <ellipse cx="20" cy="174" rx="6" ry="17" transform="rotate(25 20 174)" />
            <ellipse cx="36" cy="126" rx="6" ry="18" transform="rotate(48 36 126)" />
            <ellipse cx="22" cy="92" rx="6" ry="17" transform="rotate(-24 22 92)" />
            <ellipse cx="76" cy="53" rx="5" ry="16" transform="rotate(58 76 53)" />
            <ellipse cx="115" cy="29" rx="5" ry="13" transform="rotate(62 115 29)" />
          </g>
          {blossoms.map(({ x, y, scale, color }) => (
            <g key={x} transform={`translate(${x} ${y}) scale(${scale})`}>
              {[...Array.from({ length: PETAL_COUNT }).keys()].map((petal) => (
                <ellipse
                  key={petal}
                  cy="-9"
                  rx="7"
                  ry="11"
                  transform={`rotate(${petal * PETAL_ROTATION})`}
                  fill={color}
                  stroke="#fffaf7"
                  strokeWidth=".8"
                />
              ))}
              <circle r="3" fill="#d7bc87" />
              <circle r="1.2" fill="#fff5d9" />
            </g>
          ))}
        </svg>
      ))}
    </div>
  );
}
