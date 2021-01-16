import { englishWords } from "./words.js"

function getRandomIndex(max) {
    let array32 = new Uint32Array(1);
    window.crypto.getRandomValues(array32);
    if (array32[0] >= (Math.floor(4294967296 / max) * max)) {
        return getRandomIndex(max);
    }
    return array32[0] % max;
}

function generateWords(numWords) {
    let arrOut = [];
    for (var i=0; i<numWords; i++) {
        arrOut.push(englishWords[getRandomIndex(englishWords.length)]);
    }
    return arrOut;
}

export function generatePassword(numWords) {
    return generateWords(numWords).join('-');
}

export function generateKey(keyLen) {
    let keyArr = new Uint8Array(keyLen);
    window.crypto.getRandomValues(keyArr);
    return keyArr;
}
