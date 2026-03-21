import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import CommentaryListClient from "./CommentaryListClient";

export const metadata = {
  title: "Live Commentary | CricGeek",
  description: "Real-time ball-by-ball voice commentary from CricGeek moderators on live cricket matches.",
};

export default async function CommentaryPage() {
  const session = await auth();
  const user = session?.user as { id: string; role: string; name: string } | undefined;
  const isModerator = user && ["moderator", "admin"].includes(user.role);

  const sessions = await prisma.liveCommentarySession.findMany({
    include: {
      moderator: { select: { id: true, name: true, avatar: true } },
      _count: { select: { entries: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <CommentaryListClient
      sessions={JSON.parse(JSON.stringify(sessions))}
      isModerator={!!isModerator}
      userId={user?.id}
    />
  );
}
