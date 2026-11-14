import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({
  clientName: z.string().min(2),
  clientPhone: z.string().min(5),
  problemText: z.string().min(5),
  lawyerId: z.string().uuid().optional().nullable(),
  cityId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  serviceId: z.string().uuid().optional().nullable(),
  sourceUrl: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const lead = await prisma.lead.create({
      data: {
        clientName: body.clientName,
        clientPhone: body.clientPhone,
        problemText: body.problemText,
        lawyerId: body.lawyerId || null,
        cityId: body.cityId || null,
        categoryId: body.categoryId || null,
        serviceId: body.serviceId || null,
        sourceUrl: body.sourceUrl || null,
        status: "NEW",
      },
    });
    return NextResponse.json({ id: lead.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
