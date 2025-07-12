/*
 * Copyright 2017 SideeX committers
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

var hoverMap = new WeakMap();

class Recorder {
    constructor(window) {
        this.window = window;
        this.attached = false;
        this.locatorBuilders = new LocatorBuilders(window);
        this.shadowLocatorBuilders = new ShadowLocatorBuilder(window);
        this.frameLocation = this.getFrameLocation();

        this.window.addEventListener('message', ev => {
            if (ev.data.type === 'get-locators') {
                console.log(`Received from "${ev.data.frame}" in "${this.frameLocation.location}"`);

                const parts = ev.data.frame.split(':');
                const last = Number(parts[parts.length - 1]);

                const frm = this.window.frames[last];

                const frames = this.window.document.getElementsByTagName('iframe');
                for (let i = 0; i < frames.length; ++i) {
                    const frame = frames.item(i);
                    if (frm === frame.contentWindow) {
                        const locators = this.locatorBuilders.buildAll(frame);
                        if (locators && locators.length > 0) {
                            let retries = 20;
                            const interval = setInterval(() => {
                                if (this.frameLocation.locators.length === 0 && parts.length > 2) {
                                    if (retries > 0) {
                                        --retries;
                                        console.log('Waiting for parent locators to be resolved');
                                    } else {
                                        console.log('Giving up waiting for parent locators');
                                        clearInterval(interval);
                                    }
                                    return;
                                }
                                clearInterval(interval);

                                frm.postMessage({
                                    type: 'set-locators',
                                    locators: [...this.frameLocation.locators, locators[0][0]]
                                }, '*');
                            }, 100);
                        }
                    }
                }
            } else if (ev.data.type === 'set-locators') {
                console.log(`Received locators in '${this.frameLocation.location}'`, ev.data.locators);
                this.frameLocation = {
                    ...this.frameLocation,
                    locators: ev.data.locators
                };
                console.log(`FrameLocation updated to`, this.frameLocation);
            }
        });

        if (this.window !== window.top) {
            // We have a parent, so we will post him a message
            // At this state frame was already loaded
            setTimeout(() => {
                this.window.parent.postMessage({
                    type: 'get-locators',
                    frame: this.frameLocation.location
                }, {targetOrigin: '*'});
            }, 100);

        }

        chrome.runtime
            .sendMessage({
                frameLocation: this.frameLocation.location,
            })
            .catch(function (reason) {
                // Failed silently if receiving end does not exist
            });
    }

    // This part of code is copyright by Software Freedom Conservancy(SFC)
    parseEventKey(eventKey) {
        if (eventKey.match(/^C_/)) {
            return { eventName: eventKey.substring(2), capture: true };
        } else {
            return { eventName: eventKey, capture: false };
        }
    }

    // This part of code is copyright by Software Freedom Conservancy(SFC)
    attach() {
        if (this.attached) {
            return;
        }
        this.attached = true;
        this.eventListeners = {};
        var self = this;
        for (let eventKey in Recorder.eventHandlers) {
            var eventInfo = this.parseEventKey(eventKey);
            var eventName = eventInfo.eventName;
            var capture = eventInfo.capture;

            // create new function so that the variables have new scope.
            function register() {
                var handlers = Recorder.eventHandlers[eventKey];
                var listener = function (event) {
                    for (var i = 0; i < handlers.length; i++) {
                        handlers[i].call(self, event);
                    }
                };
                this.window.document.addEventListener(eventName, listener, capture);
                this.eventListeners[eventKey] = listener;
            }

            register.call(this);
        }
    }

    // This part of code is copyright by Software Freedom Conservancy(SFC)
    detach() {
        if (!this.attached) {
            return;
        }
        this.attached = false;
        for (let eventKey in this.eventListeners) {
            var eventInfo = this.parseEventKey(eventKey);
            var eventName = eventInfo.eventName;
            var capture = eventInfo.capture;
            this.window.document.removeEventListener(eventName, this.eventListeners[eventKey], capture);
        }
        delete this.eventListeners;
    }

    getFrameLocation() {
        let frameLocators = [];
        let currentWindow = window;
        let currentParentWindow;
        let frameLocation = '';
        let i = 0;
        while (currentWindow !== window.top) {
            currentParentWindow = currentWindow.parent;
            for (let idx = 0; idx < currentParentWindow.frames.length; idx++) {
                if (currentParentWindow.frames[idx] === currentWindow) {
                    frameLocation = ':' + idx + frameLocation;
                    currentWindow = currentParentWindow;
                    break;
                }
            }
            if (i > 100) {
                break;
            }
            i++;
        }
        console.log('root' + frameLocation);
        return {
            location: 'root' + frameLocation,
            locators: frameLocators
        };
    }

    /**
     *
     * @param {string} command
     * @param target
     * @param {Object} meta
     */
    recordEx(command, target, meta) {
        const message = {
            command: 'recordCommand',
            step: {
                command: command,
                target: target[0][0],
                value: meta.value,
                attributes: {
                    ...meta.attributes,
                    'page-title': document.title,
                    'page-url': window.location.href,
                },
                targetOptions: target,
                frameLocation: this.frameLocation,
            },
            url: window.location.href,
            label: document.title,
        };

        chrome.runtime.sendMessage(message).catch(() => {});
    }

    /**
     *
     * @param {string} command
     * @param target
     * @param value
     * @param {boolean} [insertBeforeLastCommand]
     * @param {string} [actualFrameLocation]
     */
    record(command, target, value, insertBeforeLastCommand, actualFrameLocation) {
        //Fix for html selector bug
        let c = command.toLowerCase();
        if (c.includes('click')) {
            for (let i = 0; i < target.length; i++) {
                if (['css=html', '//html'].indexOf(target[i][0]) >= 0) {
                    target[i][0] = target[i][0].replace('html', 'body');
                }
            }
        }
        var message = {
            command: 'recordCommand',
            step: {
                command: command,
                target: target[0][0],
                value: value,
                targetOptions: target,
                attributes: {
                    'page-title': document.title,
                    'page-url': window.location.href,
                },
                insertBeforeLastCommand: insertBeforeLastCommand,
                frameLocation: actualFrameLocation != undefined ? actualFrameLocation : this.frameLocation,
            },
            url: window.location.href,
            label: document.title,
        };
        chrome.runtime.sendMessage(message).catch(function (reason) {
            //Fail silently
        });

        let recordedDom = null;
        target.forEach((option) => {
            if (option[1] === 'xpath:position') {
                recordedDom = document.evaluate(option[0], document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
                    .singleNodeValue.outerHTML;
            }
        });
        if (recordedDom) {
            chrome.runtime.sendMessage({
                command: 'recordDom',
                dom: recordedDom,
            }).catch(() => {});
        }
    }
}

Recorder.eventHandlers = {};

/**
 *
 * @param {string} handlerName
 * @param {string} eventName
 * @param {Function} handler
 * @param {boolean} [options]
 */
Recorder.addEventHandler = function (handlerName, eventName, handler, options) {
    handler.handlerName = handlerName;
    if (!options) {
        options = false;
    }
    let key = options ? 'C_' + eventName : eventName;
    if (!this.eventHandlers[key]) {
        this.eventHandlers[key] = [];
    }
    this.eventHandlers[key].push(handler);
};

Recorder.mutationObservers = {};

/**
 * @param {string} observerName
 * @param {MutationCallback} callback
 * @param {any} config
 */
Recorder.addMutationObserver = function(observerName, callback, config) {
    const observer = new MutationObserver(callback.bind(this));
    observer.observerName = observerName;
    observer.config = config;
    this.mutationObservers[observerName] = observer;
};

// TODO: new by another object
var recorder = new Recorder(window);

// TODO: move to appropriate file
// show element
function startShowElement(message, sender, sendResponse) {
    if (message.showElement) {
        const result = selenium['doShowElement'](message.targetValue);
        return Promise.resolve({ result });
    }
}

chrome.runtime.onMessage.addListener(startShowElement);
