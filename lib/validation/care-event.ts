import { z } from "zod";

export const CARE_EVENT_TYPES = ["watered", "fertilized", "moved", "repotted", "other"] as const;

/** How far back a care event may be logged, and how much clock skew is tolerated. */
const MAX_PAST_DAYS = 30;
const MAX_FUTURE_MINUTES = 5;

export const careEventInputSchema = z
  .object({
    plantId: z.uuid(),
    eventType: z.enum(CARE_EVENT_TYPES),
    occurredAt: z.iso.datetime({ offset: true }).optional(),
    amountMl: z.number().int().min(1).max(20_000).nullable().optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.occurredAt) return;
    const t = Date.parse(value.occurredAt);
    const now = Date.now();
    if (t > now + MAX_FUTURE_MINUTES * 60_000) {
      ctx.addIssue({ code: "custom", path: ["occurredAt"], message: "Care can't be logged in the future" });
    }
    if (t < now - MAX_PAST_DAYS * 86_400_000) {
      ctx.addIssue({ code: "custom", path: ["occurredAt"], message: `Care can be logged up to ${MAX_PAST_DAYS} days back` });
    }
  });

export type CareEventInput = z.infer<typeof careEventInputSchema>;
