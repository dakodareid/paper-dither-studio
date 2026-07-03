declare module 'webm-writer' {
  type WebMWriterOptions = {
    quality?: number
    frameDuration?: number | null
    frameRate?: number | null
    transparent?: boolean
    alphaQuality?: number
  }

  export default class WebMWriter {
    constructor(options: WebMWriterOptions)
    addFrame(frame: HTMLCanvasElement | string, alphaOrDuration?: HTMLCanvasElement | string | number): void
    complete(): Promise<Blob>
  }
}
