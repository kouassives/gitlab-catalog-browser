/**
 * Shared API response and error types for GitLab API interactions.
 */

// ──────────────────────────────────────────────
// Pagination
// ──────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  perPage?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  perPage: number;
  total?: number;
  totalPages?: number;
}

// ──────────────────────────────────────────────
// API Error classes
// ──────────────────────────────────────────────

export class GitLabApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'GitLabApiError';
  }
}

export class AuthenticationError extends GitLabApiError {
  constructor(message = 'Authentication failed — token may be expired or invalid') {
    super(message, 401, 'AUTHENTICATION_FAILED');
    this.name = 'AuthenticationError';
  }
}

export class PermissionError extends GitLabApiError {
  constructor(message = 'Insufficient permissions for this resource') {
    super(message, 403, 'PERMISSION_DENIED');
    this.name = 'PermissionError';
  }
}

export class NotFoundError extends GitLabApiError {
  constructor(resource: string) {
    super(`Resource not found: ${resource}`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends GitLabApiError {
  constructor(
    message: string,
    public readonly retryAfterSeconds?: number
  ) {
    super(message, 429, 'RATE_LIMITED');
    this.name = 'RateLimitError';
  }
}

export class ServerError extends GitLabApiError {
  constructor(statusCode: number, statusText: string) {
    super(`GitLab server error: ${statusCode} ${statusText}`, statusCode, 'SERVER_ERROR');
    this.name = 'ServerError';
  }
}

export class NetworkError extends GitLabApiError {
  constructor(url: string, cause: string) {
    super(`Unable to reach GitLab instance at ${url}: ${cause}`, 0, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

export class ConfigurationError extends GitLabApiError {
  constructor(message: string) {
    super(message, 0, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
  }
}

// ──────────────────────────────────────────────
// Result type
// ──────────────────────────────────────────────

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: GitLabApiError };

// ──────────────────────────────────────────────
// Raw API response shapes
// ──────────────────────────────────────────────

export interface GitLabApiErrorResponse {
  message: string | Record<string, string[]>;
  error?: string;
  status?: number;
}

export interface GitLabVersion {
  version: string;
  revision: string;
}

export interface GitLabUser {
  id: number;
  name: string;
  username: string;
  state: string;
  avatar_url: string;
  web_url: string;
}
