// Live numbers for the ?perf=1 readout. The camera loop writes plain fields (no React state),
// so keeping them costs nothing when the readout is off.
export const perf = {
  video: "", // camera resolution, e.g. "1280x960"
  sampleMs: 0, // shrinking the frame + lighting stats, last check
  detectMs: 0, // face detection, smoothed
  faceEveryMs: 0, // current gap between face detections (grows on slow devices)
  check: "", // live check values and the resulting prompt, for tuning the limits on site
};
