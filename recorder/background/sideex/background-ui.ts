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
import { getNameSeleniumFile } from '../files-names-formats';
import { getSuiteYAML } from '../generate-yaml';
import { create_notification } from '../notifications';
import { BackgroundRecorderUI } from './bg-recorder-ui';
import MessageSender = chrome.runtime.MessageSender;

const GLOBAL = { } as any;


GLOBAL.cRecorder = new BackgroundRecorderUI();

let port: chrome.runtime.Port;

const manifest = chrome.runtime.getManifest();

chrome.action.setBadgeText({
    text: '',
});

chrome.action.setBadgeBackgroundColor({
    color: '#d90a16',
});

chrome.contextMenus.onClicked.addListener((info) => {
    if (port) {
        port.postMessage({ cmd: info.menuItemId });
    }
});

chrome.runtime.onConnect.addListener((m) => {
    port = m;
});

function backgroundMessageHandler(request: any, sender: MessageSender, sendResponse: (response?: any) => void) {
    if (request.command) {
        // Do action depending on the request
        const targetRecorder = getRecorder(request);
        switch (request.command) {
            case 'start_recording':
                if (request.suite_name && request.recordingTab) {
                    targetRecorder.startRecording(request.suite_name, request.recordingTab);
                } else {
                    sendResponse({ status: 'Bad Request', error: true });
                }
                sendResponse({ status: 'ok', error: false });
                break;
            case 'pause_recording':
                targetRecorder.pauseRecording();
                sendResponse({ status: 'ok', error: false });
                break;
            case 'resume_recording':
                targetRecorder.resumeRecording();
                sendResponse({ status: 'ok', error: false });
                break;
            case 'reset_recording':
                targetRecorder.cleanRecording();
                sendResponse({ status: 'ok', error: false });
                break;
            case 'recordCommand':
                targetRecorder.addCommandMessageHandler(request, sender, sendResponse);
                break;
            case 'recordDom':
                console.log('reqdom: ', request.dom);
                // add dom to collection (dom will be unique)
                targetRecorder.recordedDomSet.add(request.dom);

                // find indexes and do mapping
                const lastTestCaseIndex = targetRecorder.currentSuite.test_cases.length - 1;
                const lastCommandIndex = targetRecorder.currentSuite.test_cases[lastTestCaseIndex].commands.length - 1;

                targetRecorder.recordedDomMapping[lastTestCaseIndex] = targetRecorder.recordedDomMapping[lastTestCaseIndex] || [];
                targetRecorder.recordedDomMapping[lastTestCaseIndex][lastCommandIndex] = Array.from(targetRecorder.recordedDomSet).indexOf(request.dom);
            case 'add_step_atindex':
                if (request.testCaseIndex && request.commandIndex && request.step) {
                    targetRecorder.addCommand(request.testCaseIndex, request.commandIndex, request.step);
                    sendResponse({ status: 'ok', error: false });
                } else {
                    sendResponse({ status: 'Bad request', error: true });
                }
                break;
            case 'check_status':
                let senderRecording = false;
                if (sender.tab && sender.tab.id && targetRecorder.recordingTab) {
                    if (targetRecorder.recordingTab.id === sender.tab.id) {
                        senderRecording = true;
                    } else if (targetRecorder.openedTabIds) {
                        if (targetRecorder.openedTabIds[sender.tab.id] !== undefined) {
                            senderRecording = true;
                        }
                    }
                }
                sendResponse({
                    status: 'ok',
                    recording: targetRecorder.recording,
                    recordingTab: targetRecorder.recordingTab,
                    isThisTabRecording: senderRecording,
                    replayStatus: targetRecorder.replayStatus,
                    error: false,
                });
                break;
            case 'open_debugger':
                targetRecorder.debuggerTab = sender.tab;
                targetRecorder.currentSuite.addObserver(sender.tab);
                targetRecorder.addObserver(sender.tab);
                sendResponse({ status: 'ok', error: false });
                break;
            case 'close_debugger':
                targetRecorder.debuggerTab = null;
                targetRecorder.removeObserver(sender.tab.id);
                targetRecorder.currentSuite.removeObserver(sender.tab.id);
                sendResponse({ status: 'ok', error: false });
                break;
            case 'get_debuggerTab':
                sendResponse({ status: 'ok', debuggerTab: targetRecorder.debuggerTab, error: false });
                break;
            case 'getCurrentSuite':
                sendResponse({ status: 'ok', suite: targetRecorder.currentSuite, error: false });
                break;
            case 'dumpCurrentSuiteYaml':
                getSuiteYAML(targetRecorder.currentSuite, true).then(output => {
                    const filename = getNameSeleniumFile();
                    sendResponse({status: 'ok', filename, yaml: output});
                });
                return true;
            case 'getExportJsonSuite':
                sendResponse({ status: 'ok', suite: targetRecorder.exportJson(), error: false });
                break;
            case 'updateSuiteName':
                if (request.suiteName) {
                    targetRecorder.updateSuiteName(request.suiteName);
                    sendResponse({ status: 'ok', error: false });
                } else {
                    sendResponse({ status: 'Bad request', error: true });
                }
                break;
            case 'updateTestCases':
                if (request.testCases) {
                    targetRecorder.updateTestCases(request.testCases);
                    sendResponse({ status: 'ok', error: false });
                } else {
                    sendResponse({ status: 'Bad request', error: true });
                }
                break;
            case 'getTransactions':
                const transactions = targetRecorder.getTransactions();
                sendResponse({ status: 'ok', transactions, error: false });
                break;
            case 'addTestCase':
                if (request.testCaseName) {
                    targetRecorder.addNewTestCase(request.testCaseName);
                    sendResponse({ status: 'ok', error: false });
                } else {
                    sendResponse({ status: 'Bad request', error: true });
                }
                break;
            case 'updateTestCaseName':
                if (request.testCaseName != null && request.testCaseIndex != null) {
                    targetRecorder.updateTestCaseName(request.testCaseIndex, request.testCaseName);
                    sendResponse({ status: 'ok', error: false });
                } else {
                    sendResponse({ status: 'Bad request', error: true });
                }
                break;
            case 'addObserverRecorder':
                // Added if no already on the list
                targetRecorder.addObserver(sender.tab);
                sendResponse({ status: 'ok', error: false });
                break;
            case 'removeObserverRecorder':
                targetRecorder.removeObserver(sender.tab.id);
                sendResponse({ status: 'ok', error: false });
                break;
            case 'updateBadgeCounter':
                if (request.badgeCounter) {
                    targetRecorder.updateBadgeCounter(request.badgeCounter);
                    sendResponse({ status: 'ok', error: false });
                } else {
                    sendResponse({ status: 'Bad request', error: true });
                }
                break;
            case 'getReplayWindowId':
                sendResponse({ status: 'ok', error: false, replayWindowId: targetRecorder.replayWindowId });
                break;
            case 'setReplayWindowId':
                if (request.replayWindowId) {
                    targetRecorder.replayWindowId = request.replayWindowId;
                    sendResponse({ status: 'ok', error: false });
                } else {
                    sendResponse({ status: 'Bad request', error: true });
                }
                break;
            case 'updateCommandProperty':
                if (request.testCaseIndex && request.commandIndex && request.commandProperty && request.value) {
                    targetRecorder.updateCommandProperty(request.testCaseIndex, request.commandIndex, request.commandProperty, request.value);
                    sendResponse({ status: 'ok', error: false });
                } else {
                    sendResponse({ status: 'Bad request', error: true });
                }
                break;
            case 'deleteCommand':
                if (request.testCaseIndex && request.commandIndex) {
                    targetRecorder.deleteCommand(request.testCaseIndex, request.commandIndex);
                    sendResponse({ status: 'ok', error: false });
                } else {
                    sendResponse({ status: 'Bad request', error: true });
                }
                break;
            case 'updateCommandIndex':
                if (request.testCaseIndex && request.commandToIndex && request.commandFromIndex) {
                    targetRecorder.updateCommandIndex(request.testCaseIndex, request.commandFromIndex, request.commandToIndex);
                    sendResponse({ status: 'ok', error: false });
                } else {
                    sendResponse({ status: 'Bad request', error: true });
                }
                break;
            case 'deleteTestCase':
                if (request.testCaseIndex) {
                    targetRecorder.deleteTestCase(request.testCaseIndex);
                    sendResponse({ status: 'ok', error: false });
                } else {
                    sendResponse({ status: 'Bad request', error: true });
                }
                break;
            case 'addTestCaseAtIndex':
                if (request.testCaseIndex && request.testCase) {
                    targetRecorder.addTestCase(request.testCaseIndex, request.testCase);
                    sendResponse({ status: 'ok', error: false });
                } else {
                    sendResponse({ status: 'Bad request', error: true });
                }
                break;
            case 'showNotification':
                if (request.message && request.title) {
                    create_notification(request.title, request.message);
                } else {
                    sendResponse({ status: 'Bad request', error: true });
                }
                break;
        }

        // Send response if not sent before
        sendResponse({ status: 'ok', error: false });
    } else if (request.attachRecorderRequest) {
        // Repeated code to avoid unneccessary re-assignment
        const targetRecorder = getRecorder(request);
        if (targetRecorder.recording === 'record') {
            if (targetRecorder.openedTabIds[sender.tab.id] !== undefined) {
                chrome.tabs.sendMessage(sender.tab.id, { attachRecorder: true }).catch(() => {});
            }
        }
        return;
    }
}

chrome.runtime.onMessage.addListener(backgroundMessageHandler);

export function getRecorder(request: any) {
    return GLOBAL.cRecorder;
}
