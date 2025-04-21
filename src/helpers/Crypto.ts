export function getCrypto<T = any>(): T {
    return global.DWA_BROWSER ? (global.window.crypto as T) : require("./crypto/node").getCrypto();
}
