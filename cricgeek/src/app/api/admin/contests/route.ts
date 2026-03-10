import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET all contests
export async function GET() {
  try {
    const contests = await prisma.contest.findMany({
      orderBy: { startDate: "desc" },
    });
    return NextResponse.json({ contests });
  } catch (error) {
    console.error("Contest fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch contests" },
      { status: 500 }
    );
  }
}

// POST new contest
export async function POST(req: NextRequest) {
  try {
    const { title, description, rules, startDate, endDate, prize } =
      await req.json();

    if (!title || !description || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Title, description, startDate, and endDate are required" },
        { status: 400 }
      );
    }

    const contest = await prisma.contest.create({
      data: {
        title,
        description,
        rules: rules || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        prize: prize || null,
      },
    });

    return NextResponse.json(
      { message: "Contest created", contest },
      { status: 201 }
    );
  } catch (error) {
    console.error("Contest creation error:", error);
    return NextResponse.json(
      { error: "Failed to create contest" },
      { status: 500 }
    );
  }
}
