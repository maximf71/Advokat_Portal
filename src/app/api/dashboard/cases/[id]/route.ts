import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { recalculateLawyerRating } from "@/lib/rating/calculator";

const schema = z.object({
  summary: z.string().optional(),
  isHiddenByLawyer: z.boolean().optional(),
  isVerifiedByLawyer: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.lawyerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = schema.parse(await req.json());

  const courtCase = await prisma.courtCase.findFirst({
    where: { id, lawyerId: session.user.lawyerId },
  });
  if (!courtCase) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.courtCase.update({
    where: { id },
    data: body,
  });
  await recalculateLawyerRating(session.user.lawyerId);
  return NextResponse.json({ ok: true });
}
