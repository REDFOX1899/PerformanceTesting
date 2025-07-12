/*
 * Copyright 2017 SideeX committers
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

let typeTarget;
let typeLock = 0;
let preventType = false;
let enterTarget = null;

// Source: https://stackoverflow.com/a/2117523/1105235
function generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (char) {
        const random = (Math.random() * 16) | 0;
        const value = char === 'x' ? random : (random & 0x3) | 0x8;
        return value.toString(16);
    });
}

/**
 * Method for extracting the locators from the event.
 *
 * It works with event object, since target might be determined in 2 different ways:
 * - from the composed path in case of web-components
 * - from the event target in all other cases
 *
 * @param {Event} event
 */
Recorder.prototype.extractLocators = function(event) {
    const path = event.path || event.composedPath();
    return this.shadowLocatorBuilders.build(path)
        ?? this.locatorBuilders.buildAll(event.target);
};

/**
 *
 * @param {Event} event
 * @returns {EventTarget}
 */
Recorder.prototype.getTarget = function(event) {
    const path = event.composedPath();
    if (path) {
        return path[0];
    } else {
        return event.target;
    }
}

Recorder.inputTypes = [
    'text',
    'password',
    'file',
    'datetime',
    'datetime-local',
    'date',
    'month',
    'time',
    'week',
    'number',
    'range',
    'email',
    'url',
    'search',
    'tel',
    'color',
];

Recorder.interactiveInputTypes = ['submit', 'button', 'image', 'radio', 'checkbox', 'reset'];

const attributesToCapture = ['type'];

Recorder.addEventHandler('type', 'input', function (event) {
    typeTarget = this.getTarget(event);
});


Recorder.addEventHandler('fake', 'focus', shadowFocusHandler, true);

// let currentValue = '';

let focusTarget = null;
let focusValue = null;
let tempValue = null;

Recorder.addEventHandler('fake', '-shadow-focus', function(event) {

    function blurHandler(ev) {
        if (!ev.target.readOnly && focusValue !== ev.target.value) {
            const locators = this.extractLocators(event);
            const attributes = {};
            for (const attr of attributesToCapture) {
                if (ev.target[attr]) {
                    attributes[attr] = ev.target[attr];
                }
            }
            for (const label of ev.target.labels) {
                attributes['label'] = label.innerText;
            }
            const rect = ev.target.getBoundingClientRect();
            const recordId = generateUuid();
            attributes['recordId'] = recordId;
            const value = ev.target.value;
            const action = attributes['type'] === 'password' ? 'typeSecret' : 'type';
            this.recordEx(action, locators, { value, attributes });
            takeScreenshot(rect, 10, recordId);
        }

        focusTarget = null;
        focusValue = null;
        tempValue = null;

        ev.target.removeEventListener('blur', boundHandler);
    }

    const boundHandler = blurHandler.bind(this);

    if (event.detail && event.detail.nodeName) {
        const nodeName = event.detail.nodeName.toLowerCase();

        if (nodeName === 'input' || nodeName === 'textarea') {
            focusTarget = event.detail;
            focusValue = focusTarget.value;
            tempValue = focusValue;
            preventType = false;
            event.detail.addEventListener('blur', boundHandler);
        }
    }
}, true);

Recorder.addEventHandler(
    'hover',
    'mouseover',
    function(event) {
        hoverMap.set(event.target, Array.from(event.target.classList));
    },
    true
);

Recorder.addEventHandler(
    'unhover',
    'mouseout',
    function(event) {
        hoverMap.delete(event.target);
    },
    true
);

// © Jie-Lin You, SideeX Team
let preventClickTwice = false;
let preventClick = false;
Recorder.addEventHandler(
    'clickAt',
    'click',
    function (event) {
        if ((event.button === 0 || event.button === 2) && !preventClick && event.isTrusted) {
            const target = this.getTarget(event);

            if (!preventClickTwice) {
                let top = event.pageY;
                let left = event.pageX;
                let element = target;
                do {
                    top -= element.offsetTop;
                    left -= element.offsetLeft;
                    element = element.offsetParent;
                } while (element);

                const rect = target.getBoundingClientRect();
                const recordId = generateUuid();

                const attributes = { recordId };
                const value = `${left},${top}`;
                const locators = this.extractLocators(event);
                if (event.button === 2) {
                    this.recordEx('contextMenuAt', locators, {value, attributes});
                } else {
                    this.recordEx('click', locators, {value, attributes});
                }
                takeScreenshot(rect, 10, recordId);

                preventClickTwice = true;
            }
            setTimeout(() => preventClickTwice = false, 30);
        }
    },
    true,
);
// END

// © Chen-Chieh Ping, SideeX Team
Recorder.addEventHandler(
    'doubleClickAt',
    'dblclick',
    function (event) {
        const target = this.getTarget(event);
        let top = event.pageY;
        let left = event.pageX;
        let element = target;
        do {
            top -= element.offsetTop;
            left -= element.offsetLeft;
            element = element.offsetParent;
        } while (element);

        const rect = target.getBoundingClientRect();
        const recordId = generateUuid();

        const attributes = {recordId};
        const value = `${left},${top}`;
        const locators = this.extractLocators(event);
        this.recordEx('doubleClick', locators, { value, attributes });

        takeScreenshot(rect, 10, recordId);
    },
    true,
);
// END

Recorder.addEventHandler(
    'contextMenuAt',
    'contextmenu',
    function (event) {
        const target = this.getTarget(event);
        let top = event.pageY;
        let left = event.pageX;
        let element = target;
        do {
            top -= element.offsetTop;
            left -= element.offsetLeft;
            element = element.offsetParent;
        } while (element);

        const rect = target.getBoundingClientRect();
        const recordId = generateUuid();

        const attributes = {recordId};
        const value = `${left},${top}`;
        const locators = this.extractLocators(event);
        this.recordEx('contextMenuAt', locators, {value, attributes});
        takeScreenshot(rect, 10, recordId);
    },
    true,
);

// © Chen-Chieh Ping, SideeX Team
let enterValue = null;
let tabCheck = null;
Recorder.addEventHandler(
    'sendKeys',
    'keydown',
    function (event) {
        const target = this.getTarget(event);
        if (target.tagName) {
            const key = event.keyCode;
            let tagName = target.tagName.toLowerCase();
            let type = target.type;
            if (tagName === 'input' && Recorder.inputTypes.indexOf(type) >= 0) {
                if (key === 13) {
                    enterTarget = target;
                    enterValue = enterTarget.value;
                    if (tempValue === enterTarget.value && tabCheck === enterTarget) {
                        const locators = this.extractLocators(event);
                        this.record('sendKeys', locators, '${KEY_ENTER}');
                        enterTarget = null;
                        preventType = true;
                    } else if (focusValue === enterTarget.value) {
                        let tempTarget = target.parentElement;
                        let formChk = tempTarget.tagName.toLowerCase();
                        while (formChk !== 'form' && formChk !== 'body' && tempTarget.tagName) {
                            tempTarget = tempTarget.parentElement;
                            formChk = tempTarget.tagName.toLowerCase();
                        }
                        if (
                            formChk === 'form' &&
                            (tempTarget.hasAttribute('id') || tempTarget.hasAttribute('name')) &&
                            !tempTarget.hasAttribute('onsubmit')
                        ) {
                            if (tempTarget.hasAttribute('id'))
                                this.record('submit', [['id=' + tempTarget.id, 'id']], '');
                            else if (tempTarget.hasAttribute('name'))
                                this.record('submit', [['name=' + tempTarget.name, 'name']], '');
                        } else {
                            const locators = this.extractLocators(event);
                            this.record('sendKeys', locators, '${KEY_ENTER}');
                        }
                        enterTarget = null;
                    }
                    if (typeTarget.tagName && !preventType && (typeLock = 1)) {
                        // END
                        tagName = typeTarget.tagName.toLowerCase();
                        type = typeTarget.type;
                        if ('input' === tagName && Recorder.inputTypes.indexOf(type) >= 0) {
                            if (typeTarget.value.length > 0) {
                                this.record('type', this.locatorBuilders.buildAll(typeTarget), typeTarget.value);

                                // © Chen-Chieh Ping, SideeX Team
                                if (enterTarget != null) {
                                    let tempTarget = typeTarget.parentElement;
                                    let formChk = tempTarget.tagName.toLowerCase();
                                    while (formChk !== 'form' && formChk !== 'body') {
                                        tempTarget = tempTarget.parentElement;
                                        formChk = tempTarget.tagName.toLowerCase();
                                    }
                                    if (
                                        formChk === 'form' &&
                                        (tempTarget.hasAttribute('id') || tempTarget.hasAttribute('name')) &&
                                        !tempTarget.hasAttribute('onsubmit')
                                    ) {
                                        if (tempTarget.hasAttribute('id'))
                                            this.record('submit', [['id=' + tempTarget.id, 'id']], '');
                                        else if (tempTarget.hasAttribute('name'))
                                            this.record('submit', [['name=' + tempTarget.name, 'name']], '');
                                    } else {
                                        this.record(
                                            'sendKeys',
                                            this.locatorBuilders.buildAll(enterTarget),
                                            '${KEY_ENTER}',
                                        );
                                    }
                                    enterTarget = null;
                                }
                                // END
                            } else {
                                this.record('type', this.locatorBuilders.buildAll(typeTarget), typeTarget.value);
                            }
                        } else if ('textarea' === tagName) {
                            this.record('type', this.locatorBuilders.buildAll(typeTarget), typeTarget.value);
                        }
                    }
                    preventClick = true;
                    setTimeout(function () {
                        preventClick = false;
                    }, 500);
                    setTimeout(function () {
                        if (enterValue !== target.value) {
                            enterTarget = null;
                        }
                    }, 50);
                }

                let tempbool = false;
                if ((key === 38 || key === 40) && target.value !== '') {
                    const locators = this.extractLocators(event);

                    if (focusTarget != null && focusTarget.value !== tempValue) {
                        tempbool = true;
                        tempValue = focusTarget.value;
                    }
                    if (tempbool) {
                        this.record('type', locators, tempValue);
                    }

                    setTimeout(() => {
                        tempValue = focusTarget.value;
                    }, 250);



                    if (key === 38) {
                        this.record('sendKeys', locators, '${KEY_UP}');
                    } else {
                        this.record('sendKeys', locators, '${KEY_DOWN}');
                    }
                    tabCheck = target;
                }
                if (key === 9) {
                    if (tabCheck === target) {
                        const locators = this.extractLocators(event);
                        this.record('sendKeys', locators, '${KEY_TAB}');
                        preventType = true;
                    }
                }
            }
        }
    },
    true,
);
// END

// © Shuo-Heng Shih, SideeX Team
Recorder.addEventHandler(
    'dragAndDrop',
    'mousedown',
    function (event) {
        const self = this;
        if (
            event.clientX < window.document.documentElement.clientWidth &&
            event.clientY < window.document.documentElement.clientHeight
        ) {
            this.mousedown = event;
            this.mouseup = setTimeout(
                function () {
                    delete self.mousedown;
                }.bind(this),
                200,
            );

            this.selectMouseup = setTimeout(
                function () {
                    self.selectMousedown = event;
                }.bind(this),
                200,
            );
        }
        this.mouseoverQ = [];

        if (event.target.nodeName) {
            const tagName = event.target.nodeName.toLowerCase();
            if ('option' === tagName) {
                const parent = event.target.parentNode;
                if (parent.multiple) {
                    const options = parent.options;
                    for (let i = 0; i < options.length; i++) {
                        options[i]._wasSelected = options[i].selected;
                    }
                }
            }
        }
    },
    true,
);
// END

// © Shuo-Heng Shih, SideeX Team
Recorder.addEventHandler(
    'dragAndDrop',
    'mouseup',
    function (event) {
        clearTimeout(this.selectMouseup);
        if (this.selectMousedown) {
            let x = event.clientX - this.selectMousedown.clientX;
            let y = event.clientY - this.selectMousedown.clientY;

            function getSelectionText() {
                let text = '';
                const activeEl = window.document.activeElement;
                const activeElTagName = activeEl ? activeEl.tagName.toLowerCase() : '';
                if (activeElTagName === 'textarea' || activeElTagName === 'input') {
                    text = activeEl.value.slice(activeEl.selectionStart, activeEl.selectionEnd);
                } else if (window.getSelection) {
                    text = window.getSelection().toString();
                }
                return text.trim();
            }

            if (
                this.selectMousedown &&
                event.button === 0 &&
                x + y &&
                event.clientX < window.document.documentElement.clientWidth &&
                event.clientY < window.document.documentElement.clientHeight &&
                getSelectionText() === ''
            ) {
                var sourceRelateX =
                    this.selectMousedown.pageX -
                    this.selectMousedown.target.getBoundingClientRect().left -
                    window.scrollX;
                var sourceRelateY =
                    this.selectMousedown.pageY -
                    this.selectMousedown.target.getBoundingClientRect().top -
                    window.scrollY;
                var targetRelateX, targetRelateY;
                if (
                    !!this.mouseoverQ.length &&
                    this.mouseoverQ[1].relatedTarget == this.mouseoverQ[0].target &&
                    this.mouseoverQ[0].target == event.target
                ) {
                    targetRelateX =
                        event.pageX - this.mouseoverQ[1].target.getBoundingClientRect().left - window.scrollX;
                    targetRelateY =
                        event.pageY - this.mouseoverQ[1].target.getBoundingClientRect().top - window.scrollY;

                    // MODIFIED FUNCTIONAL - Temporal fix for mouseDownAt-mouseMoveAt-mouseUpAt recorded in one single mouse click
                    //    this.record("mouseDownAt", this.locatorBuilders.buildAll(this.selectMousedown.target), sourceRelateX + ',' + sourceRelateY);
                    //    this.record("mouseMoveAt", this.locatorBuilders.buildAll(this.mouseoverQ[1].target), targetRelateX + ',' + targetRelateY);
                    //    this.record("mouseUpAt", this.locatorBuilders.buildAll(this.mouseoverQ[1].target), targetRelateX + ',' + targetRelateY);
                } else {
                    targetRelateX = event.pageX - event.target.getBoundingClientRect().left - window.scrollX;
                    targetRelateY = event.pageY - event.target.getBoundingClientRect().top - window.scrollY;
                    // MODIFIED FUNCTIONAL - Temporal fix for mouseDownAt-mouseMoveAt-mouseUpAt recorded in one single mouse click
                    //    this.record("mouseDownAt", this.locatorBuilders.buildAll(event.target), targetRelateX + ',' + targetRelateY);
                    //    this.record("mouseMoveAt", this.locatorBuilders.buildAll(event.target), targetRelateX + ',' + targetRelateY);
                    //    this.record("mouseUpAt", this.locatorBuilders.buildAll(event.target), targetRelateX + ',' + targetRelateY);
                }
            }
        } else {
            if (this.mousedown) {
                delete this.clickLocator;
                delete this.mouseup;
                let x = event.clientX - this.mousedown.clientX;
                let y = event.clientY - this.mousedown.clientY;

                if (this.mousedown && this.mousedown.target !== event.target && !(x + y)) {
                    // MODIFIED FUNCTIONAL - Temporal fix for mouseDownAt-mouseMoveAt-mouseUpAt recorded in one single mouse click
                    //    this.record("mouseDown", this.locatorBuilders.buildAll(this.mousedown.target), '');
                    //    this.record("mouseUp", this.locatorBuilders.buildAll(event.target), '');
                } else if (this.mousedown && this.mousedown.target === event.target) {
                    var self = this;
                    var target = this.locatorBuilders.buildAll(this.mousedown.target);
                    // setTimeout(function() {
                    //     if (!self.clickLocator)
                    //         this.record("click", target, '');
                    // }.bind(this), 100);
                }
            }
        }
        delete this.mousedown;
        delete this.selectMousedown;
        delete this.mouseoverQ;
    },
    true,
);
// END

// © Shuo-Heng Shih, SideeX Team
Recorder.addEventHandler(
    'dragAndDropToObject',
    'dragstart',
    function (event) {
        var self = this;
        this.dropLocator = setTimeout(
            function () {
                self.dragstartLocator = event;
            }.bind(this),
            200,
        );
    },
    true,
);
// END

// © Shuo-Heng Shih, SideeX Team
Recorder.addEventHandler(
    'dragAndDropToObject',
    'drop',
    function (event) {
        clearTimeout(this.dropLocator);
        if (this.dragstartLocator && event.button === 0 && this.dragstartLocator.target !== event.target) {
            //value no option
            this.record(
                'dragAndDropToObject',
                this.locatorBuilders.buildAll(this.dragstartLocator.target),
                this.locatorBuilders.build(event.target),
            );
        }
        delete this.dragstartLocator;
        delete this.selectMousedown;
    },
    true,
);
// END

// © Shuo-Heng Shih, SideeX Team
let prevTimeOut = null;
Recorder.addEventHandler(
    'runScript',
    'scroll',
    function (event) {
        if (pageLoaded === true) {
            const self = this;
            this.scrollDetector = event.target;
            clearTimeout(prevTimeOut);
            prevTimeOut = setTimeout(
                function () {
                    delete self.scrollDetector;
                }.bind(self),
                500,
            );
        }
    },
    true,
);
// END

// © Shuo-Heng Shih, SideeX Team
let nowNode = 0;
Recorder.addEventHandler(
    'mouseOver',
    'mouseover',
    function (event) {
        if (window.document.documentElement) {
            nowNode = window.document.documentElement.getElementsByTagName('*').length;
        }

        const self = this;
        if (pageLoaded === true) {
            const clickable = this.findClickableElement(event.target);
            if (clickable) {
                this.nodeInsertedLocator = event.target;
                setTimeout(
                    function () {
                        delete self.nodeInsertedLocator;
                    }.bind(self),
                    500,
                );

                this.nodeAttrChange = this.locatorBuilders.buildAll(event.target);
                this.nodeAttrChangeTimeout = setTimeout(
                    function () {
                        delete self.nodeAttrChange;
                    }.bind(self),
                    10,
                );
            }
            //drop target overlapping
            if (this.mouseoverQ) {
                //mouse keep down
                if (this.mouseoverQ.length >= 3) this.mouseoverQ.shift();
                this.mouseoverQ.push(event);
            }
        }
    },
    true,
);
// END

// © Shuo-Heng Shih, SideeX Team
Recorder.addEventHandler(
    'mouseOut',
    'mouseout',
    function (event) {
        if (this.mouseoutLocator !== null && event.target === this.mouseoutLocator) {
            // this.record("mouseOut", this.locatorBuilders.buildAll(event.target), '');
        }
        delete this.mouseoutLocator;
    },
    true,
);
// END

// © Shuo-Heng Shih, SideeX Team
// Recorder.addEventHandler(
//     'mouseOver',
//     'DOMNodeInserted',
//     function (event) {
//         if (pageLoaded === true && window.document.documentElement.getElementsByTagName('*').length > nowNode) {
//             const self = this;
//             if (this.scrollDetector) {
//                 //TODO: fix target
//                 // this.record("runScript", [
//                 //     [
//                 //         ["window.scrollTo(0," + window.scrollY + ")", ]
//                 //     ]
//                 // ], '');
//                 pageLoaded = false;
//                 setTimeout(
//                     function () {
//                         pageLoaded = true;
//                     }.bind(self),
//                     550,
//                 );
//                 delete this.scrollDetector;
//                 delete this.nodeInsertedLocator;
//             }
//             if (this.nodeInsertedLocator) {
//                 // this.record("mouseOver", this.locatorBuilders.buildAll(this.nodeInsertedLocator), '');
//                 this.mouseoutLocator = this.nodeInsertedLocator;
//                 delete this.nodeInsertedLocator;
//                 delete this.mouseoverLocator;
//             }
//         }
//     },
//     true,
// );

Recorder.addMutationObserver(
    'DOMNodeInserted',
    function (mutations) {
        if (pageLoaded === true && window.document.documentElement.getElementsByTagName('*').length > nowNode) {
            const self = this;
            // Get list of inserted nodes from the mutations list to simulate 'DOMNodeInserted'.
            const insertedNodes = mutations.reduce((nodes, mutation) => {
                if (mutation.type === 'childList') {
                    nodes.push.apply(nodes, mutation.addedNodes)
                }
                return nodes
            }, []);
            // If no nodes inserted, just bail.
            if (!insertedNodes.length) {
                return
            }
            if (this.scrollDetector) {
                //TODO: fix target
                // this.record("runScript", [
                //     [
                //         ["window.scrollTo(0," + window.scrollY + ")", ]
                //     ]
                // ], '');
                pageLoaded = false;
                setTimeout(
                    function () {
                        pageLoaded = true;
                    }.bind(self),
                    550,
                );
                delete this.scrollDetector;
                delete this.nodeInsertedLocator;
            }
            if (this.nodeInsertedLocator) {
                // this.record("mouseOver", this.locatorBuilders.buildAll(this.nodeInsertedLocator), '');
                this.mouseoutLocator = this.nodeInsertedLocator;
                delete this.nodeInsertedLocator;
                delete this.mouseoverLocator;
            }
        }
    },
    { childList: true, subtree: true },
);
// END

// © Shuo-Heng Shih, SideeX Team
var readyTimeOut = null;
var pageLoaded = true;
Recorder.addEventHandler(
    'checkPageLoaded',
    'readystatechange',
    function (event) {
        const self = this;
        if (window.document.readyState === 'loading') {
            pageLoaded = false;
        } else {
            pageLoaded = false;
            clearTimeout(readyTimeOut);
            readyTimeOut = setTimeout(
                function () {
                    pageLoaded = true;
                }.bind(self),
                1500,
            ); //setReady after complete 1.5s
        }
    },
    true,
);
// END

// © Ming-Hung Hsu, SideeX Team
Recorder.addEventHandler(
    'contextMenu',
    'contextmenu',
    function (event) {
        const composedPath = event.composedPath();
        const target = composedPath ? composedPath[0] : event.target;

        const myPort = chrome.runtime.connect();
        // Force unfocus element

        target.blur();
        const tmpText = this.extractLocators(event);
        const tmpVal = getText(target);
        const tmpTitle = normalizeSpaces(target.ownerDocument.title);
        const self = this;
        if (myPort) {
            myPort.onMessage.addListener(function portListener(m) {
                if (validateAssert(m.cmd, target, tmpVal)) {
                    if (m.cmd.includes('Text')) {
                        self.record(m.cmd, tmpText, tmpVal);
                    } else if (m.cmd.includes('Title')) {
                        self.record(m.cmd, [[tmpTitle]], '');
                    } else if (m.cmd.includes('Value')) {
                        console.log(getInputValue(target));
                        self.record(m.cmd, tmpText, getInputValue(target));
                    }
                }
                myPort.onMessage.removeListener(portListener);
            });
        }
        chrome.runtime.sendMessage({
            command: 'setContextElement',
            value: target.outerHTML,
        }).catch(() => {});
    },
    true,
);
// END

function validateAssert(command, target, value) {
    switch (command) {
        case 'assertText':
            if (['SELECT'].indexOf(target.tagName) >= 0) {
                showAssertError('Assertion error', 'Select field cannot be asserted by Text');
                return false;
            }
            if (['INPUT'].indexOf(target.tagName) >= 0) {
                if (['checkbox'].indexOf(target.type) >= 0) {
                    showAssertError('Assertion error', 'Checkbox field cannot be asserted by Text');
                    return false;
                }
            }
            break;
    }
    return true;
}

function showAssertError(title, message) {
    chrome.runtime.sendMessage({ command: 'showNotification', title: title, message: message }).catch(() => {});
}

// © Yun-Wen Lin, SideeX Team
let getEle;
let checkFocus = 0;
let contentTest;
Recorder.addEventHandler(
    'editContent',
    '-shadow-focus',
    function (event) {
        const target = this.getTarget(event);

        function blurHandler(ev) {
            if (target.innerHTML !== contentTest) {
                const locators = this.extractLocators(event);
                this.record('editContent', locators, target.innerHTML);
            }

            ev.target.removeEventListener('blur', boundHandler);
        }

        const boundHandler = blurHandler.bind(this);

        const editable = target.contentEditable;
        if (editable === 'true') {
            getEle = target;
            contentTest = target.innerHTML;
            target.addEventListener('blur', boundHandler);
        }
    },
    true,
);
// END

chrome.runtime
    .sendMessage({
        attachRecorderRequest: true,
    })
    .catch(function (reason) {
        // Failed silently if receiveing end does not exist
    });

// Copyright 2005 Shinya Kasatani
Recorder.prototype.getOptionLocator = function (option) {
    const label = option.text.replace(/^ *(.*?) *$/, '$1');
    if (label.match(/\xA0/)) {
        // if the text contains &nbsp;
        return 'label=' + label.replace(/\xA0/g, ' ');
        // return (
        //     'label=regexp:' +
        //     label
        //         .replace(/[\(\)\[\]\\\^\$\*\+\?\.\|\{\}]/g, function (str) {
        //             return '\\' + str;
        //         })
        //         .replace(/\s+/g, function (str) {
        //             if (str.match(/\xA0/)) {
        //                 if (str.length > 1) {
        //                     return '\\s+';
        //                 } else {
        //                     return '\\s';
        //                 }
        //             } else {
        //                 return str;
        //             }
        //         })
        // );
    } else {
        return 'label=' + label;
    }
};

Recorder.prototype.findClickableElement = function (e) {
    if (!e.tagName) {
        return null;
    }

    const tagName = e.tagName.toLowerCase();
    const hasOnClick = e.hasAttribute('onclick');
    const hasHref = e.hasAttribute('href');
    const isButton = tagName === 'button';
    const isInput = tagName === 'input';
    const isInteractiveInput = isInput && Recorder.interactiveInputTypes.includes(e.type);

    if (hasOnClick || hasHref || isButton || isInteractiveInput) {
        return e;
    }

    if (e.parentNode == null) {
        return null;
    }

    return this.findClickableElement(e.parentNode);
};

//select / addSelect / removeSelect
Recorder.addEventHandler(
    'select',
    'focus',
    function (event) {
        const target = this.getTarget(event);

        // if (!event.target.nodeName) {
        //     return;
        // }

        const tagName = target.nodeName.toLowerCase();
        if (tagName === 'select' && target.multiple) {
            const options = target.options;
            for (let i = 0; i < options.length; i++) {
                if (options[i]._wasSelected == null) {
                    // is the focus was gained by mousedown event, _wasSelected would be already set
                    options[i]._wasSelected = options[i].selected;
                }
            }
        }
    },
    true,
);

// Roman Peshkov 2020
Recorder.addEventHandler(
    'select',
    'input',
    function (event) {
        const target = this.getTarget(event);
        if (target.nodeName.toLowerCase() === 'select') {
            const locators = this.extractLocators(event);

            if (!target.multiple) {
                const option = target.options[target.selectedIndex];
                const rect = target.getBoundingClientRect();
                const value = this.getOptionLocator(option);
                const recordId = generateUuid();
                const attributes = { recordId };
                this.recordEx('select', locators, { value, attributes });
                takeScreenshot(rect, 10, recordId);
            } else {
                const options = target.options;
                for (let i = 0; i < options.length; i++) {
                    if (options[i]._wasSelected == null) {
                    }
                    if (options[i]._wasSelected !== options[i].selected) {
                        const value = this.getOptionLocator(options[i]);
                        if (options[i].selected) {
                            this.record('addSelection', locators, value);
                        } else {
                            this.record('removeSelection', locators, value);
                        }
                        options[i]._wasSelected = options[i].selected;
                    }
                }
            }
        }
    },
    true,
);
// END
