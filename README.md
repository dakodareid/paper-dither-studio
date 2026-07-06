# Paper Dither Studio

A persistent image dithering studio for Superdraft marketing images.

The app wraps Paper's `ImageDithering` shader from `@paper-design/shaders-react` and adds the parts that make it useful as a repeatable tool:

- browser-local image upload
- persistent current settings in `localStorage`
- saved custom presets
- original Paper presets plus a Superdraft palette
- image adjustment controls for brightness, contrast, saturation, exposure, gamma, and temperature
- all exposed image dithering, sizing, and frame controls
- fixed-size PNG export
- browser-local video upload, dithered playback, and silent video export
- video motion controls for start/end shader parameter ramps with easing

## Video export

Video export is assembled frame-by-frame in the browser as `.webm`, with timestamps based on the selected FPS. This avoids realtime canvas-recording drift where slow rendering can make the output play back too slowly.

The Motion panel can animate selected numeric parameters across a clip. Set a timeline window, choose an easing curve, then enable start/end values for parameters such as dither `size`, `colorSteps`, `scale`, `rotation`, offsets, origins, world size, and image adjustments.

For MP4 delivery, convert the exported file locally:

```bash
ffmpeg -i dither-video.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart dither-video.mp4
```

The browser export is silent. If you need original audio merged back in, use the original uploaded video as a second ffmpeg input.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy

The repo deploys to GitHub Pages from `main` through `.github/workflows/deploy.yml`.

The current live URL is:

```text
https://dakodareid.github.io/paper-dither-studio/
```

The app can be transferred to `superdraft/paper-dither-studio` without changing the route base because the Vite base path is `/paper-dither-studio/`.

## Attribution

Shader rendering uses Paper Shaders:

```text
https://github.com/paper-design/shaders
https://shaders.paper.design/image-dithering
```
