import { z } from 'zod'
import { sourceUrlSchema } from './mail-schema'

/** How a manually recorded application reached the company. */
export const APPLICATION_CHANNELS = {
  website: '官网直投',
  referral: '内推',
  other: '其他渠道',
} as const
export type ApplicationChannel = keyof typeof APPLICATION_CHANNELS

/**
 * An application the user recorded themselves. Mail deliveries and imported
 * website applications keep their own records; this fills the "applied on the
 * company site" gap without pretending the workbench sent anything.
 */
export type ManualApplication = {
  id: string
  company: string
  role: string
  channel: ApplicationChannel
  appliedAt: number
  sourceUrl: string
  contact: string
  note: string
  createdAt: number
  updatedAt: number
}

const note = z.string().trim().max(5000)
const contact = z.string().trim().max(200)
export const manualApplicationSchema = z.object({
  id: z.uuid(),
  company: z.string().trim().min(1).max(120),
  role: z.string().trim().max(120),
  channel: z.enum(['website', 'referral', 'other']),
  appliedAt: z.number().int().nonnegative(),
  sourceUrl: z.union([sourceUrlSchema, z.literal('')]),
  contact,
  note,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
}).strict()
export const manualApplicationInputSchema = manualApplicationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type ManualApplicationInput = z.infer<typeof manualApplicationInputSchema>

export function toDateInput(value: number) {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Noon local time keeps the chosen calendar day stable across time zones. */
export function fromDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return NaN
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12).getTime()
}
