# Performance progress log

## 2026-08-17 — Landing page load optimization

- Converted the 1.6 MB PNG hero source into responsive WebP variants:
  - `banking-hero-768.webp` (~17 KB)
  - `banking-hero-1280.webp` (~31 KB)
- Added a responsive `<picture>` source so phones download the smaller image.
- Added intrinsic image dimensions to reduce layout shift.
- Marked the above-the-fold hero image as high priority with asynchronous decoding.
- Added an image preload with responsive `imagesrcset` and `imagesizes` hints.
- Limited backdrop blur to browsers that support it, reducing work on constrained devices.

This reduces the hero transfer from approximately 1.6 MB to tens of kilobytes for modern browsers.
