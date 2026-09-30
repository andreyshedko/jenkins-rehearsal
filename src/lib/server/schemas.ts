import { z } from "zod";
import { VERSION_SYNTAX } from "../jenkins/version";
export const scanSchema = z
  .object({
    currentJenkinsVersion: z.string().regex(VERSION_SYNTAX),
    javaVersion: z.union([
      z.literal(8),
      z.literal(11),
      z.literal(17),
      z.literal(21),
      z.literal(25),
      z.null(),
    ]),
    inventory: z.string().max(131072),
  })
  .strict();
export const sessionSchema = z.object({
  scanId: z.uuid(),
  token: z.string().max(200),
});
export const eventSchema = sessionSchema
  .extend({
    name: z.enum([
      "report_viewed",
      "paid_rehearsal_cta_viewed",
      "paid_rehearsal_cta_clicked",
    ]),
  })
  .strict();
export const leadSchema = sessionSchema
  .extend({
    email: z.email().max(254),
    company: z.string().max(200).optional(),
    controllerCount: z.number().int().min(1).max(100000),
    jobCountRange: z.enum(["unknown", "1-50", "51-200", "201-1000", "1000+"]),
    pluginCountRange: z.enum(["unknown", "1-19", "20-49", "50-99", "100+"]),
    message: z.string().max(2000).optional(),
    statedPaidInterest: z.literal(true),
  })
  .strict();
