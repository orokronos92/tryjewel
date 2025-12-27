import { z } from 'zod';

/**
 * Schema for tracking request validation using Zod
 */

// Image data schema
export const ImageDataSchema = z.object({
  image_data: z.string().min(1, "Image data is required"),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]).optional().default("image/jpeg")
});

export type ImageData = z.infer<typeof ImageDataSchema>;

// Tracking request schema
export const TrackingRequestSchema = z.object({
  request_id: z.string().uuid().optional(),
  image: ImageDataSchema,
  jewelry_type: z.enum(["ring", "bracelet", "earring", "necklace"]),
  finger: z.enum(["thumb", "index", "middle", "ring", "pinky"]).optional().default("index"),
  hand: z.enum(["left", "right"]).optional().default("right"),
  client_timestamp: z.number().optional()
});

export type TrackingRequest = z.infer<typeof TrackingRequestSchema>;

// Position schema (3D coordinates)
export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

export type Position = z.infer<typeof PositionSchema>;

// Rotation schema (Euler angles)
export const RotationSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

export type Rotation = z.infer<typeof RotationSchema>;

// Jewelry position schema
export const JewelryPositionSchema = z.object({
  position: PositionSchema,
  rotation: RotationSchema,
  scale: z.number().min(0.1).max(5.0),
  confidence: z.number().min(0).max(1)
});

export type JewelryPosition = z.infer<typeof JewelryPositionSchema>;

// Hand landmark schema
export const HandLandmarkSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  visibility: z.number().min(0).max(1).optional(),
  presence: z.number().min(0).max(1).optional()
});

export type HandLandmark = z.infer<typeof HandLandmarkSchema>;

// Hand result schema
export const HandResultSchema = z.object({
  handedness: z.enum(["Left", "Right"]),
  handedness_score: z.number().min(0).max(1),
  landmarks: z.array(HandLandmarkSchema),
  world_landmarks: z.array(HandLandmarkSchema).optional()
});

export type HandResult = z.infer<typeof HandResultSchema>;

// Tracking result schema (API response)
export const TrackingResultSchema = z.object({
  success: z.boolean(),
  request_id: z.string().uuid().optional(),
  jewelry_type: z.enum(["ring", "bracelet", "earring", "necklace"]).optional(),
  jewelry_position: JewelryPositionSchema.optional(),
  hand_result: HandResultSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  processing_time_ms: z.number().optional(),
  error: z.string().optional(),
  cached: z.boolean().optional().default(false)
});

export type TrackingResult = z.infer<typeof TrackingResultSchema>;

// Finger mapping configuration schema
export const FingerConfigSchema = z.object({
  tip: z.number().int(),
  dip: z.number().int(),
  pip: z.number().int(),
  mcp: z.number().int()
});

export type FingerConfig = z.infer<typeof FingerConfigSchema>;

// Gallery item schema (for screenshots)
export const GalleryItemSchema = z.object({
  id: z.string(),
  screenshot_data: z.string(),
  jewelry_type: z.string(),
  timestamp: z.number(),
  metadata: z.record(z.string(), z.any()).optional()
});

export type GalleryItem = z.infer<typeof GalleryItemSchema>;
