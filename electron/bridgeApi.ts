/** The entire renderer-to-main surface. No filesystem, shell, login or generic
 * invoke API. Main owns the bridge process and the renderer only reads its URL. */
export interface DesktopBridgeApi {
  getBridgeUrl(): Promise<string>;
}

declare global {
  interface Window { openMathTutor?: DesktopBridgeApi }
}
