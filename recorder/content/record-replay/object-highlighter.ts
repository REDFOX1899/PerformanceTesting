export class ObjectHighlighter {
    private win: Window;
    private div: HTMLDivElement;
    private e: null;
    private r: null;
    private browserBot: any = null;

    constructor() {
        // @ts-ignore
        this.browserBot = BrowserBot.createForWindow(window);

        chrome.runtime.onMessage.addListener((request: any) => {
            if (request.command === 'highlightObject' && request.arguments.highlight) {
                request.arguments.object.locators.forEach((selector: any) => {
                    if (selector.name && selector.value) {
                        let element = null;
                        const name = selector.name === 'LinkText' ? 'linkText' : selector.name.toLowerCase();
                        try {
                            element = this.browserBot.findElement(`${name}=${selector.value}`);
                            this.highlightElement(element);
                            return;
                        } catch (e) {
                            return;
                        }
                    }
                });
            } else if (request.command === 'highlightObject' && !request.arguments.highlight) {
                this.removeHighlighting();
                this.cleanup();
            }
        });
        this.cleanup();
    }

    private cleanup() {
        this.win = window;
        const doc = this.win.document;
        // const div = doc.createElement('div');
        // div.setAttribute('style', 'display: none;');
        // doc.body.insertBefore(div, doc.body.firstChild);
        // this.div = div;
        this.e = null;
        this.r = null;
    }

    private removeHighlighting() {
        try {
            if (this.div) {
                if (this.div.parentNode) {
                    this.div.parentNode.removeChild(this.div);
                }
                this.div = null;
            }
        } catch (e) {
            if (e !== 'TypeError: can\'t access dead object') {
                throw e;
            }
        }
        this.win = null;
    }

    private highlight(doc: any, x: any, y: any) {
        if (doc) {
            const e = doc.elementFromPoint(x, y);
            if (e && e !== this.e) {
                this.highlightElement(e);
            }
        }
    }

    private highlightElement(element: any) {
        if (element && element !== this.e) {
            this.e = element;
        } else {
            return;
        }
        const r = element.getBoundingClientRect();
        const or = this.r;

        if (r.left >= 0 && r.top >= 0 && r.width > 0 && r.height > 0) {
            // @ts-ignore
            if (or && r.top === or.top && r.left === or.left && r.width === or.width && r.height === or.height) {
                return;
            }
            this.r = r;
            const style = 'pointer-events: none; position: absolute; box-shadow: 0 0 0 1px black; outline: 1px dashed white; outline-offset: -1px; background-color: rgba(250,250,128,0.4); z-index: 100;';
            const pos = 'top:' + (r.top + this.win.scrollY) + 'px; left:' + (r.left + this.win.scrollX) +
                'px; width:' + r.width + 'px; height:' + r.height + 'px;';
            this.div.setAttribute('style', style + pos);
        } else if (or) {
            this.div.setAttribute('style', 'display: none;');
        }
    }
}
