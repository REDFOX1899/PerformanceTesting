/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Source: https://gist.github.com/samthor/7b307408e73784971ef0fcf4a8af6edd
 * @fileoverview Listener to provide Shadow DOM focus events, even inside shadow roots
 *
 * Normally, listening for focus with Shadow DOM will just return the top-most 'host' with a shadow
 * root. That may not be a problem! But if you want to find the 'real' focused element...
 *
 * To use this library, add this after the script is included-
 *   document.addEventListener('focus', shadowFocusHandler, true);
 *
 * You can then listen for `-shadow-focus` events, which will return the furthest focused element-
 *   document.addEventListener('-shadow-focus', function(ev) {
 *     console.info('got focused element', ev.detail, '..inside outer-most shadow root', ev.target);
 *   });
 */

const shadowFocusHandler = (function() {
    const eventName = '-shadow-focus';
    const dispatch = function(target) {
        const args = {composed: true, bubbles: true, detail: target};
        const customEvent = new CustomEvent(eventName, args);
        target.dispatchEvent(customEvent);
    };

    if (!window.WeakSet || !window.ShadowRoot) {
        return event => dispatch(event.target);
    }

    const focusHandlerSet = new WeakSet();

    /**
     * @param {Node} target to work on
     * @param {function(!FocusEvent)} callback to invoke on focus change
     */
    function _internal(target, callback) {
        let currentFocus = target;  // save real focus

        // #1: get the nearest ShadowRoot
        while (!(target instanceof ShadowRoot)) {
            if (!target) { return; }
            target = target.parentNode;
        }

        // #2: are we already handling it?
        if (focusHandlerSet.has(target)) { return; }
        focusHandlerSet.add(target);

        // #3: setup focus/blur handlers
        const hostEl = target.host;
        const focusinHandler = function(ev) {
            if (ev.target !== currentFocus) {  // prevent dup calls for same focus
                currentFocus = ev.target;
                callback(ev);
            }
        };
        const blurHandler = function(ev) {
            hostEl.removeEventListener('blur', blurHandler, false);
            target.removeEventListener('focusin', focusinHandler, true);
            focusHandlerSet.delete(target);
        };

        // #3: add blur handler to host element
        hostEl.addEventListener('blur', blurHandler, false);

        // #4: add focus handler within shadow root, to observe changes
        target.addEventListener('focusin', focusinHandler, true);

        // #5: find next parent SR, do it again
        _internal(target.host, callback);
    }

    /**
     * @param {!FocusEvent} event to process
     */
    function shadowFocusHandler(event) {
        const target = (event.composedPath ? event.composedPath()[0] : null) || event.target;
        _internal(target, shadowFocusHandler);
        dispatch(target);
    }

    return shadowFocusHandler;
}());
