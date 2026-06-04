/**
 * Logo vectorial de The Box Burger.
 * Estructura: fila superior T·H·E (cols 0-2), fila inferior B·O·X (cols 1-3).
 * Usa solo SVG, sin imágenes externas.
 */
export default function LogoTheBox({ height = 40, showText = true, color = '#ffffff' }) {
  const BOX   = 100;           // tamaño de cada celda
  const SW    = 4;             // stroke width
  const FS    = 64;            // font size letras
  const TOTAL_W = 4 * BOX;    // 4 columnas en total
  const TEXT_H  = showText ? 40 : 0;
  const TOTAL_H = 2 * BOX + TEXT_H;

  const aspect = TOTAL_W / TOTAL_H;
  const width  = height * aspect;

  const letters = [
    { ch: 'T', col: 0, row: 0 },
    { ch: 'H', col: 1, row: 0 },
    { ch: 'E', col: 2, row: 0 },
    { ch: 'B', col: 1, row: 1 },
    { ch: 'O', col: 2, row: 1 },
    { ch: 'X', col: 3, row: 1 },
  ];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {letters.map(({ ch, col, row }) => {
        const x = col * BOX;
        const y = row * BOX;
        return (
          <g key={ch}>
            <rect
              x={x + SW / 2}
              y={y + SW / 2}
              width={BOX - SW}
              height={BOX - SW}
              fill="transparent"
              stroke={color}
              strokeWidth={SW}
            />
            <text
              x={x + BOX / 2}
              y={y + BOX / 2 + FS * 0.36}
              textAnchor="middle"
              fill={color}
              fontSize={FS}
              fontWeight="900"
              fontFamily="'Arial Black', Arial, Impact, sans-serif"
              style={{ userSelect: 'none' }}
            >
              {ch}
            </text>
          </g>
        );
      })}

      {showText && (
        <text
          x={TOTAL_W / 2}
          y={2 * BOX + 28}
          textAnchor="middle"
          fill={color}
          fontSize="19"
          fontWeight="700"
          fontFamily="Arial, sans-serif"
          letterSpacing="5"
          style={{ userSelect: 'none' }}
        >
          BURGER CULTURE
        </text>
      )}
    </svg>
  );
}
