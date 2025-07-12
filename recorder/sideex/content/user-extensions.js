/**
 * Get the path, that consists only with Custom Elements.
 *
 * Check whether element is custom element or builtin is done by checking
 * availability of dash in the name
 *
 * Original taken from https://stackoverflow.com/a/16742828/1105235
 *
 * @param el - Element for which path is built
 * @returns {string[]} - Path
 */
function getShadowPath(el) {
    const stack = [];
    while ( el.parentNode != null ) {
        let sibCount = 0;
        let sibIndex = 0;
        if (!el.nodeName.includes('-')) {
            el = el.parentNode;
            continue;
        }
        for (let i = 0; i < el.parentNode.childNodes.length; i++ ) {
            const sib = el.parentNode.childNodes[i];
            if ( sib.nodeName === el.nodeName ) {
                if ( sib === el ) {
                    sibIndex = sibCount;
                }
                sibCount++;
            }
        }
        if ( el.hasAttribute('id') && el.id !== '' ) {
            stack.unshift(el.nodeName.toLowerCase() + '#' + el.id);
        } else if ( sibCount > 1 ) {
            stack.unshift(el.nodeName.toLowerCase() + ':eq(' + sibIndex + ')');
        } else {
            stack.unshift(el.nodeName.toLowerCase());
        }
        el = el.parentNode;
    }

    return stack;
}

/**
 * Find element by shadow locator.
 *
 * Shadow locator is a special type of locator that represents the path to the target component.
 * Path is defined as a CSS locators, separated by comma. When going through this path, locator
 * should find the element, get its shadowRoot and continue with the next locators from this point.
 *
 * Function contains additional check, which is required for the Lightning Components.
 *
 * @example
 * If locator is defined as "x-comp1, x-comp2, .btn", then the resulting code for element
 * matching will be
 * document.querySelector('x-comp1').shadowRoot.querySelector('x-comp2').shadowRoot.querySelector('.btn')
 *
 * @param path {string} - CSS locators to go through, separated by comma
 * @param document {HTMLDocument}
 */
MozillaBrowserBot.prototype.locateElementByShadow = function(path, document) {
    const parts = path.split(',');
    const last = parts.pop();
    let el = document;
    parts.forEach((x, i) => {
        // We find all elements and put them to array
        // const all = [...el.querySelectorAll(x)];
        // TODO(rp): This is quick and dirty switch to the simple webcomponents
        const all = el.querySelectorAll(x);

        if (all.length > 1) {
            throw Error('Ambiguous selector');
        }

        el = all[0];
        // And then we get only items that are on the same level as out path traversal
        // el = all.filter(k => getShadowPath(k).length === i + 1)[0];
        if (!el) {
            const failedPath = parts.slice(0, i+1).join(', ');
            throw new SeleniumError(`Element not found: ${failedPath}`);
        }

        if (el.shadowRoot) {
            el = el.shadowRoot;
        }
    });
    return el.querySelector(last);
};

MozillaBrowserBot.prototype.locateElementByShadow.prefix = 'shadow';
