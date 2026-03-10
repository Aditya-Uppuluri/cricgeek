"use client";

interface WriterDNAChartProps {
  analyst: number;
  storyteller: number;
  critic: number;
  reporter: number;
  debater: number;
  size?: number;
}

export default function WriterDNAChart({
  analyst,
  storyteller,
  critic,
  reporter,
  debater,
  size = 280,
}: WriterDNAChartProps) {
  const center = size / 2;
  const radius = size * 0.38;
  const dimensions = [
    { label: "Analyst", value: analyst, angle: -90, icon: "📊" },
    { label: "Storyteller", value: storyteller, angle: -18, icon: "📖" },
    { label: "Debater", value: debater, angle: 54, icon: "⚔️" },
    { label: "Reporter", value: reporter, angle: 126, icon: "📰" },
    { label: "Critic", value: critic, angle: 198, icon: "🔍" },
  ];

  const getPoint = (angle: number, value: number, maxRadius: number) => {
    const rad = (angle * Math.PI) / 180;
    const r = (value / 100) * maxRadius;
    return { x: center + r * Math.cos(rad), y: center + r * Math.sin(rad) };
  };

  // Grid rings
  const rings = [20, 40, 60, 80, 100];

  // Data polygon points
  const dataPoints = dimensions.map((d) =>
    getPoint(d.angle, d.value, radius)
  );
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
        {/* Grid rings */}
        {rings.map((ring) => {
          const ringPoints = dimensions.map((d) =>
            getPoint(d.angle, ring, radius)
          );
          const ringPolygon = ringPoints
            .map((p) => `${p.x},${p.y}`)
            .join(" ");
          return (
            <polygon
              key={ring}
              points={ringPolygon}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
          );
        })}

        {/* Axis lines */}
        {dimensions.map((d) => {
          const end = getPoint(d.angle, 100, radius);
          return (
            <line
              key={d.label}
              x1={center}
              y1={center}
              x2={end.x}
              y2={end.y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
          );
        })}

        {/* Data fill */}
        <polygon
          points={dataPolygon}
          fill="rgba(34,197,94,0.15)"
          stroke="#22C55E"
          strokeWidth="2"
          className="radar-pulse"
        />

        {/* Data points */}
        {dataPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="#22C55E"
            stroke="#0A0A0A"
            strokeWidth="2"
          />
        ))}
      </svg>

      {/* Labels */}
      {dimensions.map((d) => {
        const labelPoint = getPoint(d.angle, 125, radius);
        return (
          <div
            key={d.label}
            className="absolute flex flex-col items-center"
            style={{
              left: labelPoint.x,
              top: labelPoint.y,
              transform: "translate(-50%, -50%)",
            }}
          >
            <span className="text-lg">{d.icon}</span>
            <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
              {d.label}
            </span>
            <span className="text-xs font-bold text-cg-green">{d.value}</span>
          </div>
        );
      })}
    </div>
  );
}
