// One shared import() call site so the prefetch and next/dynamic resolve to the same chunk.
export const loadCaptureScreen = () => import("./screens/CaptureScreen");
