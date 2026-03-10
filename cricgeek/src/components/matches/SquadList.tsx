import type { Squad } from "@/types/cricket";
import { User } from "lucide-react";

interface SquadListProps {
  squads: Squad[];
}

export default function SquadList({ squads }: SquadListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {squads.map((squad) => (
        <div
          key={squad.teamName}
          className="bg-cg-dark-2 border border-gray-800 rounded-xl overflow-hidden"
        >
          <div className="px-4 py-3 bg-cg-dark border-b border-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-cg-green/20 rounded-full flex items-center justify-center text-xs font-bold text-cg-green">
                {squad.shortname}
              </div>
              <h3 className="text-white font-semibold">{squad.teamName}</h3>
              <span className="text-gray-400 text-xs ml-auto">
                {squad.players.length} players
              </span>
            </div>
          </div>
          <div className="divide-y divide-gray-800/50">
            {squad.players.map((player) => (
              <div
                key={player.id}
                className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-800/20"
              >
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                  <User size={14} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {player.name}
                  </p>
                  {player.role && (
                    <p className="text-gray-500 text-xs">{player.role}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
