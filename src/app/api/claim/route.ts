import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";

const schema = z.object({
  lawyerId: z.string().uuid(),
  applicantName: z.string().min(3),
  workEmail: z.string().email(),
  workPhone: z.string().min(5),
  idCardScanUrl: z.string().min(3),
  comment: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const lawyer = await prisma.lawyer.findUnique({ where: { id: body.lawyerId } });
    if (!lawyer) {
      return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
    }
    if (lawyer.isClaimed) {
      return NextResponse.json({ error: "Профиль уже подтверждён" }, { status: 400 });
    }

    const session = await auth();
    const claim = await prisma.claimRequest.create({
      data: {
        lawyerId: body.lawyerId,
        userId: session?.user?.id ?? null,
        applicantName: body.applicantName,
        workEmail: body.workEmail,
        workPhone: body.workPhone,
        idCardScanUrl: body.idCardScanUrl,
        comment: body.comment || null,
        status: "PENDING",
      },
    });

    return NextResponse.json({ id: claim.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
