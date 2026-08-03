import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { DomainError } from '../domain/domain-error';

function flatten(errors: ValidationError[]): ValidationError[] {
  return errors.flatMap((error) => [error, ...flatten(error.children ?? [])]);
}

export function validationExceptionFactory(errors: ValidationError[]): Error {
  const all = flatten(errors);
  if (all.some((error) => error.property === 'serialNumber')) {
    return new DomainError(
      'INVALID_SERIAL_FORMAT',
      'Serial number must match SKY-XXXX-XXXX using ASCII letters and numbers.',
      400,
    );
  }
  return new BadRequestException({
    message: all.flatMap((error) => Object.values(error.constraints ?? {})),
  });
}
