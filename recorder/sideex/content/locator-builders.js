/*
 * Copyright 2005 Shinya Kasatani
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

function LocatorBuilders(window) {
    this.window = window;
    //this.log = new Log("LocatorBuilders");
}

LocatorBuilders.prototype.detach = function() {
    if (this.window._locator_pageBot) {
        this.window._locator_pageBot = undefined;
        // Firefox 3 (beta 5) throws "Security Manager vetoed action" when we use delete operator like this:
        // delete this.window._locator_pageBot;
    }
};

LocatorBuilders.prototype.pageBot = function() {
    let pageBot = this.window._locator_pageBot;
    if (pageBot == null) {
        pageBot = new MozillaBrowserBot(this.window);
        const self = this;
        pageBot.getCurrentWindow = function() {
            return self.window;
        };
        this.window._locator_pageBot = pageBot;
    }
    return pageBot;
};

LocatorBuilders.prototype.buildWith = function(name, e, opt_contextNode) {
    return LocatorBuilders.builderMap[name].call(this, e, opt_contextNode);
};

LocatorBuilders.prototype.elementEquals = function(name, e, locator) {
    const fe = this.findElement(locator);
    //TODO: add match function to the ui locator builder, note the inverted parameters
    return (e == fe) || (LocatorBuilders.builderMap[name] && LocatorBuilders.builderMap[name].match && LocatorBuilders.builderMap[name].match(e, fe));
};

LocatorBuilders.prototype.build = function(e) {
    const locators = this.buildAll(e);
    if (locators.length > 0) {
        return locators[0][0];
    } else {
        return "LOCATOR_DETECTION_FAILED";
    }
};

LocatorBuilders.prototype.buildAll = function(el) {
    const e = core.firefox.unwrap(el); //Samit: Fix: Do the magic to get it to work in Firefox 4
    const xpathLevel = 0;
    const maxLevel = 10;
    const locators = [];
    const coreLocatorStrategies = this.pageBot().locationStrategies;
    for (let i = 0; i < LocatorBuilders.order.length; i++) {
        let finderName = LocatorBuilders.order[i];
        try {
            let locator = this.buildWith(finderName, e);
            if (locator) {
                locator = String(locator);

                //Samit: The following is a quickfix for above commented code to stop exceptions on almost every locator builder
                //TODO: the builderName should NOT be used as a strategy name, create a feature to allow locatorBuilders to specify this kind of behaviour
                //TODO: Useful if a builder wants to capture a different element like a parent. Use the this.elementEquals
                if (finderName != 'tac') {
                    var fe = this.findElement(locator);
                    const locatorName = finderName.split(':')[0];
                    if ((e == fe) || (coreLocatorStrategies[locatorName] && coreLocatorStrategies[locatorName].is_fuzzy_match && coreLocatorStrategies[locatorName].is_fuzzy_match(fe, e))) {
                        locators.push([locator, finderName]);
                    }
                } else {
                    locators.splice(0, 0, [locator, finderName]);
                }
            }
        } catch (e) {
            // TODO ignore the buggy locator builder for now
            //this.log.debug("locator exception: " + e);
        }
    }

    return this.postProcess(locators);
};


/**
 * Post-processing of the locators.
 *
 * Make adjustments to the order of the locators. Pushes down locators that start from the digit.
 * Most of the time such ids are auto-generated, which means that during replay id will be
 * regenerated and locator is no longer valid.
 *
 * @param locators
 */
LocatorBuilders.prototype.postProcess = function(locators) {
    const startsWithDigitRe = /^\d.+/i;
    const hasGuid = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

    const result = [];
    let index = 0;
    for (const [loc, type] of locators) {
        index++;

        if (hasGuid.test(loc)) {
            result.push({order: index * 100, value: [loc, type]});
        } else if (type === 'id') {
            const value = loc.slice(3);
            const multiplier = startsWithDigitRe.test(value) ? 100 : 1;
            result.push({order: index * multiplier, value: [loc, type]})
        } else if (loc.startsWith('//')) {
            const xpathIdRe = /@id='(.+)'/i;
            const match = loc.match(xpathIdRe);
            const multiplier = (match && startsWithDigitRe.test(match[1])) ? 100 : 1;
            result.push({order: index * multiplier, value: [loc, type]})
        } else {
            result.push({order: index, value: [loc, type]});
        }
    }

    return result.sort((a, b) => a.order - b.order).map(x => x.value);
};

LocatorBuilders.prototype.findElement = function(locator) {
    try {
        const loc = parse_locator(locator);
        return findElement({ [loc.type]: loc.string }, this.window.document);
    } catch (error) {
        //this.log.debug("findElement failed: " + error + ", locator=" + locator);
        return null;
    }
};

/*
 * Class methods
 */

LocatorBuilders.order = [];
LocatorBuilders.builderMap = {};
LocatorBuilders._preferredOrder = [];
// NOTE: for some reasons we does not use this part
// classObservable(LocatorBuilders);

LocatorBuilders.add = function(name, finder) {
    this.order.push(name);
    this.builderMap[name] = finder;
    this._orderChanged();
};

/**
 * Call when the order or preferred order changes
 */
LocatorBuilders._orderChanged = function() {
    var changed = this._ensureAllPresent(this.order, this._preferredOrder);
    this._sortByRefOrder(this.order, this._preferredOrder);
    if (changed) {
        // NOTE: for some reasons we does not use this part 
        // this.notify('preferredOrderChanged', this._preferredOrder);
    }
};

/**
 * Set the preferred order of the locator builders
 *
 * @param preferredOrder can be an array or a comma separated string of names
 */
LocatorBuilders.setPreferredOrder = function(preferredOrder) {
    if (typeof preferredOrder === 'string') {
        this._preferredOrder = preferredOrder.split(',');
    } else {
        this._preferredOrder = preferredOrder;
    }
    this._orderChanged();
};

/**
 * Returns the locator builders preferred order as an array
 */
LocatorBuilders.getPreferredOrder = function() {
    return this._preferredOrder;
};

/**
 * Sorts arrayToSort in the order of elements in sortOrderReference
 * @param arrayToSort
 * @param sortOrderReference
 */
LocatorBuilders._sortByRefOrder = function(arrayToSort, sortOrderReference) {
    var raLen = sortOrderReference.length;
    arrayToSort.sort(function(a, b) {
        var ai = sortOrderReference.indexOf(a);
        var bi = sortOrderReference.indexOf(b);
        return (ai > -1 ? ai : raLen) - (bi > -1 ? bi : raLen);
    });
};

/**
 * Function to add to the bottom of destArray elements from source array that do not exist in destArray
 * @param sourceArray
 * @param destArray
 */
LocatorBuilders._ensureAllPresent = function(sourceArray, destArray) {
    var changed = false;
    sourceArray.forEach(function(e) {
        if (destArray.indexOf(e) == -1) {
            destArray.push(e);
            changed = true;
        }
    });
    return changed;
};

/*
 * Utility function: Encode XPath attribute value.
 */
LocatorBuilders.prototype.attributeValue = function(value) {
    if (value.indexOf("'") < 0) {
        return "'" + value + "'";
    } else if (value.indexOf('"') < 0) {
        return '"' + value + '"';
    } else {
        var result = 'concat(';
        var part = "";
        while (true) {
            var apos = value.indexOf("'");
            var quot = value.indexOf('"');
            if (apos < 0) {
                result += "'" + value + "'";
                break;
            } else if (quot < 0) {
                result += '"' + value + '"';
                break;
            } else if (quot < apos) {
                part = value.substring(0, apos);
                result += "'" + part + "'";
                value = value.substring(part.length);
            } else {
                part = value.substring(0, quot);
                result += '"' + part + '"';
                value = value.substring(part.length);
            }
            result += ',';
        }
        result += ')';
        return result;
    }
};

LocatorBuilders.prototype.xpathHtmlElement = function(name) {
    if (this.window.document.contentType == 'application/xhtml+xml') {
        // "x:" prefix is required when testing XHTML pages
        return "x:" + name;
    } else {
        return name;
    }
};

LocatorBuilders.prototype.relativeXPathFromParent = function(current) {
    var index = this.getNodeNbr(current);
    var currentPath = '/' + this.xpathHtmlElement(current.nodeName.toLowerCase());
    if (index > 0) {
        currentPath += '[' + (index + 1) + ']';
    }
    return currentPath;
};

LocatorBuilders.prototype.getNodeNbr = function(current) {
    var childNodes = current.parentNode.childNodes;
    var total = 0;
    var index = -1;
    for (var i = 0; i < childNodes.length; i++) {
        var child = childNodes[i];
        if (child.nodeName == current.nodeName) {
            if (child == current) {
                index = total;
            }
            total++;
        }
    }
    return index;
};

LocatorBuilders.prototype.getCSSSubPath = function(e) {
    var css_attributes = ['id', 'class', 'name', 'type', 'alt', 'title', 'value'];
    for (var i = 0; i < css_attributes.length; i++) {
        var attr = css_attributes[i];
        var value = e.getAttribute(attr);

        if (attr === 'class') {
            const current = Array.from(e.classList);
            if (hoverMap) {
                const original = hoverMap ? hoverMap.get(e) : undefined;

                if (original) {
                    const filtered = current.filter(x => original.indexOf(x) >= 0);
                    value = filtered.join(' ');
                }
            }
        }

        if (value) {
            if (attr == 'id')
                return '#' + value;
            if (attr == 'class')
                return e.nodeName.toLowerCase() + '.' + value.replace(/\s+/g, ".").replace("..", ".");
            return e.nodeName.toLowerCase() + '[' + attr + '="' + value + '"]';
        }
    }
    if (this.getNodeNbr(e))
        return e.nodeName.toLowerCase() + ':nth-of-type(' + this.getNodeNbr(e) + ')';
    else
        return e.nodeName.toLowerCase();
};

LocatorBuilders.prototype.preciseXPath = function(xpath, e) {
    //only create more precise xpath if needed
    if (!this.findElement(xpath)?.contains(e)) {
        var result = e.ownerDocument.evaluate(xpath, e.ownerDocument, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        //skip first element (result:0 xpath index:1)
        for (var i = 0, len = result.snapshotLength; i < len; i++) {
            var newPath = 'xpath=(' + xpath + ')[' + (i + 1) + ']';
            if (this.findElement(newPath)?.contains(e)) {
                return newPath;
            }
        }
    }
    return xpath;
};

/*
 * ===== builders =====
 */


// LocatorBuilders.add('ui', function(pageElement) {
//     return UIMap.getInstance().getUISpecifierString(pageElement,
//         this.window.document);
// });

function dumpElement(e) {
    const nodeName = e.nodeName.toLowerCase();

    console.group(nodeName);

    if (nodeName === 'textarea' || nodeName === 'input') {
        if (e.labels.length > 0) {
            for (const l of e.labels) {
                console.log('Label:', l.textContent);
            }
        }
        if (e.placeholder) {
            console.log('Placeholder:', e.placeholder);
        }
    }

    if (e.textContent) {
        console.log('TextContent:', e.textContent);
    }

    if (e.title) {
        console.log('Title:', e.title);
    }

    if (e.ariaLabel) {
        console.log('Aria-label:', e.ariaLabel);
    }

    console.groupEnd();
}

// order listed dictates priority
// e.g., 1st listed is top priority

LocatorBuilders.add('css:data-test-id', function (e) {
    const dataAttributes = ['data-test-id', 'data-test'];
    for (let i = 0; i < dataAttributes.length; i++) {
        const attr = dataAttributes[i];
        const value = e.getAttribute(attr);
        if (value) {
            return `css=[${attr}="${value}"]`;
        }
    }
    return null;
});

LocatorBuilders.add('id', function(e) {
    if (e.id) {
        return 'id=' + e.id;
    }
    return null;
});

LocatorBuilders.add('linkText', function(e) {
    if (e.nodeName == 'A') {
        let text = e.textContent;
        if (!text.match(/^\s*$/)) {
            return "linkText=" + text.replace(/\xA0/g, " ").replace(/^\s*(.*?)\s*$/, "$1");
        }
    }
    return null;
});

LocatorBuilders.add('name', function(e) {
    if (e.name) {
        return 'name=' + e.name;
    }
    return null;
});

const dataAttributeFromDatasetProperty = (attr) => `data-${attr.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
  
LocatorBuilders.add('css:data-attr', function (e) {
    const dataKeys = Object.keys(e.dataset || {});
    if (dataKeys.length) {
        const attr = dataKeys[0];
        const value = e.dataset[attr];
        const htmlAttr = dataAttributeFromDatasetProperty(attr);
        if (!value || value === 'true') {
            return `css=[${htmlAttr}]`;
        }
        return `css=[${htmlAttr}="${value}"]`;
    }
    return null;
});

LocatorBuilders.add('css', function(e) {
    let current = e;
    let sub_path = this.getCSSSubPath(e);
    while (this.findElement("css=" + sub_path) != e && current.nodeName.toLowerCase() != 'html') {
        sub_path = this.getCSSSubPath(current.parentNode) + ' > ' + sub_path;
        current = current.parentNode;
    }
    return "css=" + sub_path;
});

LocatorBuilders.add('css:finder', function(e) {
    return 'css=' + finder(e);
});

/*
 * This function is called from DOM locatorBuilders
 */
LocatorBuilders.prototype.findDomFormLocator = function(form) {
    if (form.hasAttribute('name')) {
        let name = form.getAttribute('name');
        let locator = "document." + name;
        if (this.findElement(locator) == form) {
            return locator;
        }
        locator = "document.forms['" + name + "']";
        if (this.findElement(locator) == form) {
            return locator;
        }
    }
    let forms = this.window.document.forms;
    for (let i = 0; i < forms.length; i++) {
        if (form == forms[i]) {
            return "document.forms[" + i + "]";
        }
    }
    return null;
};

LocatorBuilders.add('dom:name', function(e) {
    if (e.form && e.name) {
        let formLocator = this.findDomFormLocator(e.form);
        if (formLocator) {
            let candidates = [formLocator + "." + e.name,
                formLocator + ".elements['" + e.name + "']"
            ];
            for (let c = 0; c < candidates.length; c++) {
                let locator = candidates[c];
                let found = this.findElement(locator);
                if (found) {
                    if (found == e) {
                        return locator;
                    } else if (found instanceof NodeList) {
                        // multiple elements with same name
                        for (let i = 0; i < found.length; i++) {
                            if (found[i] == e) {
                                return locator + "[" + i + "]";
                            }
                        }
                    }
                }
            }
        }
    }
    return null;
});

LocatorBuilders.add('xpath:robust', function(e) {
    const nodeName = e.nodeName.toLowerCase();

    // Not using these locators for specific elements
    if (nodeName === 'iframe' || nodeName === 'select') {
        return null;
    }

    dumpElement(e);

    let locator = null;

    const isInput = nodeName === 'textarea' || nodeName === 'input';

    if (isInput) {
        if (e.placeholder) {
            // generate locator for input/textarea element based on its placeholder text
            locator = `//${nodeName}[@placeholder = "${e.placeholder}"]`;
            // reset the locator if this isn't a reliable xpath locator
            if (!this.getElementByXPath(locator)) {
                locator =  null;
            }
        }
    }

    // If there's a title on the element, but we didn't find other locators yet - use it
    if (e.title && !locator) {
        locator = `//${nodeName}[@title = "${e.title}"]`;
        if (!this.getElementByXPath(locator)) {
            locator =  null;
        }
    }

    const text = e.textContent.trim();

    if (!locator && text) {
        const splitText = text.split('\n');
        const isMultiline = splitText.length > 1;
        if (!isMultiline) {
            locator = `//*[text() = "${text}"]`;
        } else {
            locator = `//*[contains(text(), "${splitText[0]}")]`;
        }

        if (!this.getElementByXPath(locator)) {
            locator =  null;
        }
    }

    // Special case for submit button
    const buttonLikeTypes = ['submit', 'reset', 'button'];
    if (!locator && nodeName === 'input' && buttonLikeTypes.includes(e.type) && e.value) {
        locator = `//input[@value = "${e.value}"]`;
        if (!this.getElementByXPath(locator)) {
            locator =  null;
        }
    }

    // If element has ID, it might be used for labelling other elements
    // Trying to search what is labelled
    if (e.id && !isInput && !locator) {
        const labelled = this.findElement(`//*[contains(@aria-labelledby, "${e.id}")]`);
        if (labelled) {
            const words = labelled.textContent.split('\n');

            for (const word of words.filter(x => x)) {
                if (/^[\s\d]+$/.test(word)) {
                    continue;
                }

                locator = `//*[contains(text(), "${word}")]`;
                if (!this.getElementByXPath(locator)) {
                    locator =  null;
                }
                break;
            }
        }
    }

    let fuzzy = false;

    if (!locator) {
        // Preserve information about 'cursor' property of computed style of the element.
        // What we try to do here is to understand whether we crossed the boundaries of
        // interactive element. For example, if where we clicked has 'cursor: pointer'
        // and we traverse its parents, then the point when cursor will change to something
        // different from 'pointer' means that we came out of "atomic" element boundaries,
        // so we don't want to proceed further
        const clickedCursor = getComputedStyle(e)['cursor'];
        console.log('clickedcursor:', clickedCursor);
        let parent = e.parentElement;

        while (parent) {
            const cursor = getComputedStyle(parent)['cursor'];
            if (cursor !== clickedCursor) {
                break;
            }

            if (parent.title) {
                locator = `//*[@title = "${parent.title}"]`;
                if (!this.getElementByXPath(locator)) {
                    locator =  null;
                }
                fuzzy = true;
                break;
            }

            parent = parent.parentElement;
        }
    }

    if (!locator) {
        return null;
    }

    locator = this.preciseXPath(locator, e);
    if (!this.getElementByXPath(locator)) {
        locator =  null;
    }

    console.log('Locator:', locator);
    return locator;
});

LocatorBuilders.add('xpath:link', function(e) {
    if (e.nodeName == 'A') {
        var text = e.textContent;
        if (!text.match(/^\s*$/)) {
            return this.preciseXPath("//" + this.xpathHtmlElement("a") + "[contains(text(),'" + text.replace(/^\s+/, '').replace(/\s+$/, '') + "')]", e);
        }
    }
    return null;
});

LocatorBuilders.add('xpath:img', function(e) {
    if (e.nodeName == 'IMG') {
        if (e.alt != '') {
            return this.preciseXPath("//" + this.xpathHtmlElement("img") + "[@alt=" + this.attributeValue(e.alt) + "]", e);
        } else if (e.title != '') {
            return this.preciseXPath("//" + this.xpathHtmlElement("img") + "[@title=" + this.attributeValue(e.title) + "]", e);
        } else if (e.src != '') {
            return this.preciseXPath("//" + this.xpathHtmlElement("img") + "[contains(@src," + this.attributeValue(e.src) + ")]", e);
        }
    }
    return null;
});

LocatorBuilders.add('xpath:attributes', function(e) {
    const PREFERRED_ATTRIBUTES = ['id', 'name', 'value', 'type', 'action', 'onclick'];
    var i = 0;

    function attributesXPath(name, attNames, attributes) {
        var locator = "//" + this.xpathHtmlElement(name) + "[";
        for (i = 0; i < attNames.length; i++) {
            if (i > 0) {
                locator += " and ";
            }
            var attName = attNames[i];
            locator += '@' + attName + "=" + this.attributeValue(attributes[attName]);
            if (e.textContent && attName == 'type') {
                locator += " and text()=" + this.attributeValue(e.textContent);
            }
        }
        locator += "]";
        return this.preciseXPath(locator, e);
    }

    if (e.attributes) {
        var atts = e.attributes;
        var attsMap = {};
        for (i = 0; i < atts.length; i++) {
            var att = atts[i];
            attsMap[att.name] = att.value;
        }
        var names = [];
        // try preferred attributes
        for (i = 0; i < PREFERRED_ATTRIBUTES.length; i++) {
            var name = PREFERRED_ATTRIBUTES[i];
            if (attsMap[name] != null) {
                names.push(name);
                var locator = attributesXPath.call(this, e.nodeName.toLowerCase(), names, attsMap);
                if (e == this.findElement(locator)) {
                    return locator;
                }
            }
        }
    }
    return null;
});

LocatorBuilders.add('xpath:idRelative', function(e) {
    var path = '';
    var current = e;
    while (current != null) {
        if (current.parentNode != null) {
            path = this.relativeXPathFromParent(current) + path;
            if (1 == current.parentNode.nodeType && // ELEMENT_NODE
                current.parentNode.getAttribute("id")) {
                return this.preciseXPath("//" + this.xpathHtmlElement(current.parentNode.nodeName.toLowerCase()) +
                    "[@id=" + this.attributeValue(current.parentNode.getAttribute('id')) + "]" +
                    path, e);
            }
        } else {
            return null;
        }
        current = current.parentNode;
    }
    return null;
});

LocatorBuilders.add('xpath:href', function(e) {
    if (e.attributes && e.hasAttribute("href")) {
        href = e.getAttribute("href");
        if (href.search(/^http?:\/\//) >= 0) {
            return this.preciseXPath("//" + this.xpathHtmlElement("a") + "[@href=" + this.attributeValue(href) + "]", e);
        } else {
            // use contains(), because in IE getAttribute("href") will return absolute path
            return this.preciseXPath("//" + this.xpathHtmlElement("a") + "[contains(@href, " + this.attributeValue(href) + ")]", e);
        }
    }
    return null;
});

LocatorBuilders.add('dom:index', function(e) {
    if (e.form) {
        var formLocator = this.findDomFormLocator(e.form);
        if (formLocator) {
            var elements = e.form.elements;
            for (var i = 0; i < elements.length; i++) {
                if (elements[i] == e) {
                    return formLocator + ".elements[" + i + "]";
                }
            }
        }
    }
    return null;
});

LocatorBuilders.add('xpath:position', function(e, opt_contextNode) {
    //this.log.debug("positionXPath: e=" + e);
    var path = '';
    var current = e;
    while (current != null && current != opt_contextNode) {
        var currentPath;
        if (current.parentNode != null) {
            currentPath = this.relativeXPathFromParent(current);
        } else {
            currentPath = '/' + this.xpathHtmlElement(current.nodeName.toLowerCase());
        }
        path = currentPath + path;
        var locator = '/' + path;
        if (e == this.findElement(locator)) {
            return 'xpath=' + locator;
        }
        current = current.parentNode;
        //this.log.debug("positionXPath: current=" + current);
    }
    return null;
});

LocatorBuilders.add('xpath:innerText', function (el) {
    return el.innerText ? `xpath=//${el.nodeName.toLowerCase()}[contains(.,'${el.innerText}')]` : null;
});

// retrieve an element from the DOM using the XPath locator
LocatorBuilders.prototype.getElementByXPath = function(xpath) {
	return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}