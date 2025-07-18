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

var selenium = new Selenium(BrowserBot.createForWindow(window));
var locatorBuilders = new LocatorBuilders(window);
var shadowLocatorBuilder = new ShadowLocatorBuilder(window);

function doCommands(request, sender, sendResponse, type) {
    if (request.commands) {
        //console.log("indoCommands: " + request.commands);
        if (request.commands == "waitPreparation") {
            selenium["doWaitPreparation"]("", selenium.preprocessParameter(""));
            console.log('here');
            sendResponse({"ok": "ok"});
        } else if (request.commands == "prePageWait") {
            selenium["doPrePageWait"]("", selenium.preprocessParameter(""));
            sendResponse({new_page: window.sideex_new_page});
        } else if (request.commands == "pageWait") {
            selenium["doPageWait"]("", selenium.preprocessParameter(""));
            sendResponse({page_done: window.sideex_page_done});
        } else if (request.commands == "ajaxWait") {
            selenium["doAjaxWait"]("", selenium.preprocessParameter(""));
            sendResponse({ajax_done: window.sideex_ajax_done});
        } else if (request.commands == "domWait") {
            selenium["doDomWait"]("", selenium.preprocessParameter(""));
            sendResponse({dom_time: window.sideex_dom_time});
        } else {
            var upperCase = request.commands.charAt(0).toUpperCase() + request.commands.slice(1);
            if (selenium["do" + upperCase] != null) {
                try {
                    document.body.setAttribute("SideeXPlayingFlag", true);
                    let returnValue = selenium["do" + upperCase](request.target, selenium.preprocessParameter(request.value));
                    if (returnValue instanceof Promise) {
                        // The command is a asynchronous function
                        returnValue.then(function (value) {
                            // Asynchronous command completed successfully
                            document.body.removeAttribute("SideeXPlayingFlag");
                            sendResponse({result: "success", value});
                        }).catch(function (reason) {
                            // Asynchronous command failed
                            document.body.removeAttribute("SideeXPlayingFlag");
                            sendResponse({result: reason});
                        });
                    } else {
                        // Synchronous command completed successfully
                        document.body.removeAttribute("SideeXPlayingFlag");
                        sendResponse({result: "success", value: returnValue});
                    }
                } catch (e) {
                    // Synchronous command failed
                    document.body.removeAttribute("SideeXPlayingFlag");
                    sendResponse({status: 'failed', result: e.message});
                }
            } else {
                sendResponse({result: "Unknown command: " + request.commands});
            }
        }

        return true;
    }
    // TODO: refactoring
    if (request.selectMode) {
        // console.log("Received request to enter select mode");
        if (request.selecting) {
            document.addEventListener('keydown', function cancelSelection(e) {
                    if (e.keyCode == 27) {
                        //Esc cancels selection
                        chrome.runtime.sendMessage({
                            cancelSelectTarget: true
                        }).catch(function (err) {
                        });
                        document.removeEventListener('keydown', cancelSelection);
                    }
                }
            );
            targetSelecter = new TargetSelecter(function (element, win, event) {
                if (element && win) {
                    //var locatorBuilders = new LocatorBuilders(win);
                    const path = event.path || event.composedPath();

                    var target = shadowLocatorBuilder.build(path)
                        ?? locatorBuilders.buildAll(element);

                    locatorBuilders.detach();
                    if (target != null && target instanceof Array) {
                        if (target) {
                            //self.editor.treeView.updateCurrentCommand('targetCandidates', target);
                            chrome.runtime.sendMessage({
                                selectTarget: true,
                                target: target
                            }).catch(() => {});
                        } else {
                            //alert("LOCATOR_DETECTION_FAILED");
                        }
                    }

                }
                targetSelecter = null;
            }, function () {
            });
        }
        else {
            if (targetSelecter) {
                targetSelecter.cleanup();
                targetSelecter = null;
                return;
            }
        }
    }
    // TODO: code refactoring
    if (request.attachRecorder) {
        recorder.attach();

    } else if (request.detachRecorder) {
        recorder.detach();

    }
}

chrome.runtime.onMessage.addListener(doCommands);
