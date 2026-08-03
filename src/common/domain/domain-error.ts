export type DomainErrorDetails = Record<string, unknown> | unknown[];

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: DomainErrorDetails,
  ) {
    super(message);
  }
}

export const domainError = {
  notFound: (resource: string) =>
    new DomainError(`${resource.toUpperCase()}_NOT_FOUND`, `${resource} was not found.`, 404),
  conflict: (code: string, message: string, details?: DomainErrorDetails) =>
    new DomainError(code, message, 409, details),
  unprocessable: (code: string, message: string, details?: DomainErrorDetails) =>
    new DomainError(code, message, 422, details),
};
