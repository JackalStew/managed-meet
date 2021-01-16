import { bytesToBase64, base64ToBytes } from "./base64.js"

export function hangupAndDispose(jitsiAPI) {
    try { jitsiAPI.executeCommand('hangup'); } catch {};
    try { jitsiAPI.dispose(); } catch {};
}

export function hashToConfig(hashString) {
    return JSON.parse(atob(hashString));
}

export function configToHash(tempConfig) {
    return btoa(JSON.stringify(tempConfig));
}

export async function encryptAndHandleMsg(msgObj, keyBytes, handleCallback) {
    const enc = new TextEncoder("utf8");
    const ptBytes = enc.encode(JSON.stringify(msgObj));
    const ivBytes = new Uint8Array(12);
    window.crypto.getRandomValues(ivBytes);

    const keyObj = await window.crypto.subtle.importKey(
        "raw",
        keyBytes,
        "AES-GCM",
        false,
        ["encrypt", "decrypt"]
    )

    const ctBytes = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: ivBytes
        },
        keyObj,
        ptBytes
    )
    
    const toSend = {
        iv: bytesToBase64(ivBytes),
        ct: bytesToBase64(new Uint8Array(ctBytes))
    }

    // message is encrypted, handle it as appropriate
    handleCallback(toSend);
}

export async function decryptAndHandleMsg(msgObj, keyBytes, handleCallback) {
    const dec = new TextDecoder("utf8");

    const keyObj = await window.crypto.subtle.importKey(
        "raw",
        keyBytes,
        "AES-GCM",
        false,
        ["encrypt", "decrypt"]
    )

    const ptBytes = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: base64ToBytes(msgObj.iv)
        },
        keyObj,
        base64ToBytes(msgObj.ct)
    )

    let decMsg = JSON.parse(dec.decode(ptBytes))
    handleCallback(decMsg);
}
