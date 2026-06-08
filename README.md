# Paper Dither Studio

A persistent image dithering studio for Superdraft marketing images.

The app wraps Paper's `ImageDithering` shader from `@paper-design/shaders-react` and adds the parts that make it useful as a repeatable tool:

- browser-local image upload
- persistent current settings in `localStorage`
- saved custom presets
- original Paper presets plus a Superdraft palette
- all exposed image dithering, sizing, and frame controls
- fixed-size PNG export

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

The production URL is:

```text
https://superdraft.github.io/paper-dither-studio/
```

## Attribution

Shader rendering uses Paper Shaders:

```text
https://github.com/paper-design/shaders
https://shaders.paper.design/image-dithering
```
