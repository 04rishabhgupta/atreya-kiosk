// Live numbers for the ?perf=1 readout. The camera loop writes plain fields (no React state),
// so keeping them costs nothing when the readout is off.
export const perf = {
  video: "", // camera mode in use, e.g. "1920x1080 @30fps resize=none · HD Pro Webcam C920"
  sampleMs: 0, // shrinking the frame + lighting stats, last check
  detectMs: 0, // face detection, smoothed
  faceEveryMs: 0, // current gap between face detections (grows on slow devices)
  check: "", // focus / exposure / white balance as actually applied after the camera settles
};
