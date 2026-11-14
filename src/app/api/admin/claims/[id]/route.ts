import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { recalculateLawyerRating } from "@/lib/rating/calculator";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  moderatorComment: z.string().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "MODERATOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = schema.parse(await req.json());
  const claim = await prisma.claimRequest.findUnique({
    where: { id },
    include: { lawyer: true },
  });
  if (!claim || claim.status !== "PENDING") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.action === "reject") {
    await prisma.claimRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        moderatorComment: body.moderatorComment,
        processedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  }

  // Approve: ensure user exists, link lawyer
  let user = claim.userId
    ? await prisma.user.findUnique({ where: { id: claim.userId } })
    : await prisma.user.findUnique({ where: { email: claim.workEmail } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: claim.workEmail,
        phone: claim.workPhone,
        passwordHash: await bcrypt.hash("lawyer123", 10),
        role: "LAWYER",
      },
    });
  }

  await prisma.$transaction([
    prisma.claimRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        userId: user.id,
        moderatorComment: body.moderatorComment,
        processedAt: new Date(),
      },
    }),
    prisma.lawyer.update({
      where: { id: claim.lawyerId },
      data: {
        isClaimed: true,
        isVerifiedDocuments: true,
        claimedAt: new Date(),
        userId: user.id,
        publicPhone: claim.workPhone,
      },
    }),
  ]);

  await recalculateLawyerRating(claim.lawyerId);
  return NextResponse.json({ ok: true, userId: user.id });
}
