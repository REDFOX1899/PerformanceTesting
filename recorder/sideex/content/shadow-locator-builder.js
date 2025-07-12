class ShadowLocatorBuilder {
    constructor(window) {
        this.window = window;
    }

    /**
     * Build the shadow locator
     * @param {EventTarget[]} path
     */
    build(path) {
        const isCustomElement = e => e.nodeName && e.nodeName.includes('-');
        const hasCustomElements = p => p.some(isCustomElement);

        if (!hasCustomElements(path)) {
            return null;
        }

        const customElements = path
            .filter(x => isCustomElement(x) && x.nodeName !== '#document-fragment')
            .reverse();

        if (!isCustomElement(path[0])) {
            customElements.push(path[0]);
        }

        const resultPath = customElements.map(x => x.nodeName.toLowerCase());

        let anchorNode = document;
        for (let i = 0; i < resultPath.length; ++i) {
            let part = resultPath[i];
            const sibs = anchorNode.querySelectorAll(part);

            if (sibs.length === 0) {
                // TODO: There might be a situation when you will not find the element, because hierarchy is different than the path received.
                // At the moment just stop the loop so that locator will be not full and it will not find the element.
                // This failure to find an element will cause fallback strategy to normal recording.
                break;
            }

            if (sibs.length > 1) {
                // Here we found several siblings. It means that we need more specific CSS selector.

                let current = customElements[i];
                part = this.getCSSSubPath(current);
                while (anchorNode.querySelectorAll(part).length > 1 && current !== anchorNode) {
                    part = this.getCSSSubPath(current.parentNode) + ' > ' + part;
                    current = current.parentNode;
                }

                resultPath[i] = part;

                anchorNode = customElements[i];
                if (anchorNode.shadowRoot) {
                    anchorNode = anchorNode.shadowRoot;
                }
            } else {
                anchorNode = sibs[0];
                if (anchorNode.shadowRoot) {
                    anchorNode = anchorNode.shadowRoot;
                }
            }
        }

        const locator = 'shadow=' + resultPath.join(', ');

        if (!this.findElement(locator)) {
            return null;
        }

        return [[locator, 'shadow']];
    }

    pageBot() {
        let pageBot = this.window._locator_pageBot;
        if (!pageBot) {
            pageBot = new MozillaBrowserBot(this.window);
            pageBot.getCurrentWindow = () => this.window;
            this.window._locator_pageBot = pageBot;
        }

        return pageBot;
    }


    findElement(locator) {
        try {
            return this.pageBot().findElement(locator);
        } catch {
            return null;
        }
    }

    getCSSSubPath(e) {
        const css_attributes = ['name', 'type', 'alt', 'title', 'data-value', 'value'];
        for (const attr of css_attributes) {
            const value = e.getAttribute(attr);
            if (value) {
                return e.nodeName.toLowerCase() + `[${attr}="${value}"]`;
            }
        }

        if (this.getNodeNbr(e) >= 0) {
            return e.nodeName.toLowerCase() + `:nth-of-type(${this.getNodeNbr(e) + 1})`;
        } else {
            return e.nodeName.toLowerCase();
        }
    }

    getNodeNbr(current) {
        const childNodes = current.parentNode.childNodes;
        let total = 0;
        let index = -1;
        for (let i = 0; i < childNodes.length; i++) {
            const child = childNodes[i];
            if (child.nodeName === current.nodeName) {
                if (child === current) {
                    index = total;
                }
                total++;
            }
        }
        return index;
    }
}
