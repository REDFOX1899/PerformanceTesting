import { DEBUGGER_PONG_V2 } from '../messages';

export function pingv2Handler() {
    const manifest = chrome.runtime.getManifest();
    chrome.runtime.sendMessage({ type: 'get_status' }).then((x) => {
        const response = { type: DEBUGGER_PONG_V2, status: x.op, extensionVersion: manifest.version };
        window.postMessage(response, location.origin);
    }).catch(() => {});
}
