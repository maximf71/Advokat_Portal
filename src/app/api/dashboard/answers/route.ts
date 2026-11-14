import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { recalculateLawyerRating } from "@/lib/rating/calculator";

const schema = z.object({
  questionId: z.string().uuid(),
  body: z.string().min(10),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.lawyerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = schema.parse(await req.json());

  await prisma.answer.create({
    data: {
      questionId: body.questionId,
      lawyerId: session.user.lawyerId,
      body: body.body,
    },
  });
  await prisma.lawyer.update({
    where: { id: session.user.lawyerId },
    data: { answersCount: { increment: 1 } },
  });
  await recalculateLawyerRating(session.user.lawyerId);
  return NextResponse.json({ ok: true }, { status: 201 });
}
