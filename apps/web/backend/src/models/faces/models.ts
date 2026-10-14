const OPENCV_ZOO_REVISION = '47534e27c9851bb1128ccc0102f1145e27f23f98';
const MODEL_ROOT = `https://media.githubusercontent.com/media/opencv/opencv_zoo/${OPENCV_ZOO_REVISION}/models`;

export const FACE_MODEL_VERSION = 'yunet-2023mar-sface-int8-aligned32-v1';
export const FACE_DIMENSIONS = 128;
export const FACE_DESCRIPTOR_BYTES = 32;
export const MAX_FACE_IMAGE_FEATURES = 150;
export const FACE_FINGERPRINT_EDGE = 32;
export const FACE_MODEL_FILES = [
  {
    name: 'yunet.onnx',
    url: `${MODEL_ROOT}/face_detection_yunet/face_detection_yunet_2023mar.onnx`,
    sha256: '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4',
    maximumBytes: 300_000,
  },
  {
    name: 'sface-int8.onnx',
    url: `${MODEL_ROOT}/face_recognition_sface/face_recognition_sface_2021dec_int8.onnx`,
    sha256: '2b0e941e6f16cc048c20aee0c8e31f569118f65d702914540f7bfdc14048d78a',
    maximumBytes: 10_000_000,
  },
] as const;
