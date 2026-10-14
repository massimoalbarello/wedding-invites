import { ForbiddenError } from '#backend/lib/errors.ts';

export class FaceMismatchError extends ForbiddenError {
  constructor() {
    super('We could not match your face. Please try another selfie.');
    this.name = 'FaceMismatchError';
  }
}
