export class FaceAnalysisError extends Error {
  readonly code:
    | 'invalid_image'
    | 'no_face'
    | 'multiple_faces'
    | 'small_face'
    | 'busy'
    | 'unavailable';

  constructor({ message, code }: { message: string; code: FaceAnalysisError['code'] }) {
    super(message);
    this.name = 'FaceAnalysisError';
    this.code = code;
  }
}
