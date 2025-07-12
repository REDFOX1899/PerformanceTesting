interface Rect {
    left: number;
    top: number;
    width: number;
    height: number;
}

export function takeScreenshot(rect: DOMRect | ClientRect, margin: number, recordId: string) {
    const dpr = window.devicePixelRatio || 1;

    const cropRect: Rect = {
        left: (rect.left - margin) * dpr,
        top: (rect.top - margin) * dpr,
        width: (rect.width + margin * 2) * dpr,
        height: (rect.height + margin * 2) * dpr,
    };

    chrome.runtime.sendMessage({
        op: 'takeScreenshot',
        recordId,
        cropRect,
    }).catch(() => {});
}
