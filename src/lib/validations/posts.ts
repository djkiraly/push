import { z } from "zod";

export const ContentTypeEnum = z.enum(["IMAGE", "CAROUSEL", "SHORT_VIDEO"]);
export const PostStatusEnum = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "ARCHIVED",
]);
export const PlatformPostStatusEnum = z.enum([
  "DRAFT",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
  "CANCELLED",
]);

export const VariantInputSchema = z.object({
  accountId: z.string().min(1),
  caption: z.string().min(1),
  hashtags: z.string().optional().nullable(),
  scheduledFor: z
    .string()
    .datetime({ offset: true })
    .optional()
    .nullable(),
  status: PlatformPostStatusEnum.optional(),
});

export const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  baseCaption: z.string().min(1),
  contentType: ContentTypeEnum,
  notes: z.string().optional().nullable(),
  status: PostStatusEnum.optional(),
  mediaIds: z.array(z.string().min(1)).min(1).max(20),
  variants: z.array(VariantInputSchema).min(1),
});
export type CreatePostInput = z.infer<typeof CreatePostSchema>;

export const UpdatePostSchema = CreatePostSchema.partial().extend({
  // When variants are provided we replace the whole set; omit to keep existing.
  variants: z.array(VariantInputSchema).optional(),
});
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>;

export const GenerateRequestSchema = z.object({
  // Optional override — by default the post's own baseCaption is used.
  baseCaption: z.string().optional(),
  platforms: z
    .array(z.enum(["FACEBOOK", "INSTAGRAM", "TIKTOK", "YOUTUBE"]))
    .optional(),
});
