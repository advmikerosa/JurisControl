sanitization.ts  

/**
 * Sanitization utilities for input validation
 * Prevents XSS attacks and malicious code injection
 * LGPD/GDPR compliant: Ensures user data is properly cleaned
 */

import { User } from '../types';

/**
 * Sanitize a single input string
 * Removes HTML tags and malicious scripts
 */
export const sanitizeInput = (input: string | null | undefined): string => {
  if (!input) return '';
  
  // Remove HTML tags and escape special characters
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
};

/**
 * Sanitize profile data from user input
 * Apply sanitization to all text fields
 */
export const sanitizeProfile = (data: Partial<User>): Partial<User> => {
  return {
    ...data,
    name: data.name ? sanitizeInput(data.name) : undefined,
    username: data.username ? sanitizeInput(data.username) : undefined,
    oab: data.oab ? sanitizeInput(data.oab) : undefined,
    phone: data.phone ? sanitizeInput(data.phone) : undefined,
  };
};

/**
 * Sanitize case data
 * Apply sanitization to case-related text fields
 */
export const sanitizeCaseData = (data: any): any => {
  return {
    ...data,
    title: data.title ? sanitizeInput(data.title) : undefined,
    description: data.description ? sanitizeInput(data.description) : undefined,
    notes: data.notes ? sanitizeInput(data.notes) : undefined,
  };
};

/**
 * Sanitize document data
 * Apply sanitization to document-related text fields
 */
export const sanitizeDocumentData = (data: any): any => {
  return {
    ...data,
    name: data.name ? sanitizeInput(data.name) : undefined,
    description: data.description ? sanitizeInput(data.description) : undefined,
  };
};

/**
 * Validate and sanitize email
 * Ensures valid email format
 */
export const sanitizeEmail = (email: string): string => {
  const sanitized = sanitizeInput(email);
  // Basic email validation regex (RFC 5322 simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : '';
};

/**
 * Sanitize phone number
 * Keeps only numbers, spaces, and valid characters
 */
export const sanitizePhone = (phone: string): string => {
  if (!phone) return '';
  return String(phone)
    .replace(/[^0-9\s\-()\+]/g, '')
    .trim();
};

/**
 * Check if input contains potential XSS patterns
 * Returns true if suspicious patterns are detected
 */
export const hasXSSPatterns = (input: string): boolean => {
  if (!input) return false;
  
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /on\w+\s*=/gi,  // Event handlers like onclick=
    /javascript:/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
  ];
  
  return xssPatterns.some(pattern => pattern.test(input));
};
