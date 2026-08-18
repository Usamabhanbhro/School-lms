import { z } from "zod";

/**
 * Shared Zod validators for format-enforced fields.
 * Used across teacher, academics, and student routes to keep
 * validation rules DRY and consistent.
 */

/** CNIC format: xxxxx-xxxxxxx-x (5 digits, dash, 7 digits, dash, 1 digit) */
export const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
export const cnicMessage = "Must be in format xxxxx-xxxxxxx-x";

/** Phone format: 03xx-xxxxxxx (03, 2 digits, dash, 7 digits) */
export const phoneRegex = /^03\d{2}-\d{7}$/;
export const phoneMessage = "Must be in format 03xx-xxxxxxx";

/** Reusable Zod string schemas with format validation */
export const cnicField = z.string().regex(cnicRegex, cnicMessage);
export const phoneField = z.string().regex(phoneRegex, phoneMessage);
