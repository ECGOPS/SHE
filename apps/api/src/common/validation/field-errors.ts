import { BadRequestException, ValidationError } from '@nestjs/common';

export interface FieldError {
  field: string;
  message: string;
}

/** Turn class-validator's tree into a flat list. Values are not copied into the message. */
export function flattenErrors(errors: ValidationError[], parent = ''): FieldError[] {
  const out: FieldError[] = [];
  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const messages = error.constraints ? Object.values(error.constraints) : [];
    if (messages.length) out.push({ field, message: messages[0] });
    if (error.children?.length) out.push(...flattenErrors(error.children, field));
  }
  return out;
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Some fields are not valid.',
    errors: flattenErrors(errors),
  });
}
