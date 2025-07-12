import { createMenus, removeMenus } from '../background-common';
import { checkForForbiddenDomain } from '../forbidden-domains';
import { create_notification } from '../notifications';
import { TestCase, TestCommand } from '../types';
import { checkUrlsMatch } from '../url-utils';
import { TestSuite } from './bg-testsuite';
import Tab = chrome.tabs.Tab;
import TabRemoveInfo = chrome.tabs.TabRemoveInfo;
import WebNavigationSourceCallbackDetails = chrome.webNavigation.WebNavigationSourceCallbackDetails;
import TabActiveInfo = chrome.tabs.TabActiveInfo;

// declare var debug: boolean;

// TODO: mv3. Should be global
const debug = false;

export class BackgroundRecorderUI {
    public recording: string;
    public recordingTab: Tab | null;
    public editorTabId: number | null;
    public debuggerTab: Tab | null;
    public observers: Tab[];
    public transactions: any[]; // TODO: Provide type
    public currentSuite: TestSuite;
    public defaultTestName: string | null;
    public replayStatus: string;
    public countClicks: number;
    public replayWindowId: number | null;
    public currentRecordingTabId: number | null;
    public currentRecordingWindowId: number | null;
    public currentRecordingFrameLocation: string | null;
    public openedTabNames: { [key: string]: number };
    public openedTabIds: { [key: number]: string };
    public openedTabCount: number;
    public openedWindowIds: { [key: number]: boolean };
    public contentWindowId: number;
    public selfWindowId: number;
    public attached: boolean;
    public recordedDomSet: Set<string>;
    public recordedDomMapping: any[]; // TODO: Provide type
    public structuredModel: any; // TODO: Provide type
    private currentUrl: string;
    private initialRecordingWindowId: number;
    private interactableActions: Set<string>;

    constructor() {
        this.recording = 'stopped';
        this.recordingTab = null;
        this.editorTabId = null;
        this.debuggerTab = null;
        this.observers = [];
        this.transactions = [];
        this.currentSuite = null;
        this.defaultTestName = null;
        this.replayStatus = 'stopped';
        this.countClicks = 0;
        this.replayWindowId = null;
        this.currentRecordingTabId = null;
        this.currentRecordingWindowId = null;
        this.currentRecordingFrameLocation = null;
        this.openedTabNames = {};
        this.openedTabIds = {};
        this.openedTabCount = 0;
        this.openedWindowIds = {};
        this.contentWindowId = -1;
        this.selfWindowId = -1;
        this.attached = false;
        this.recordedDomSet = new Set();
        this.recordedDomMapping = [];
        this.structuredModel = undefined;
        this.interactableActions = new Set([
            'assertText', 'assertValue', 'click', 'contextClick', 'doubleClick',
            'dragAndDropObject', 'editContent', 'sendKeys', 'storeText', 'storeValue',
            'mouseDownAt', 'mouseMoveAt', 'mouseUpAt', 'mouseOut', 'mouseOver',
            'submit', 'select', 'type', 'typeSecret'
        ]);
        this.rebind();
    }

    public startRecording(name: string, tab: Tab) {
        chrome.tabs.sendMessage(tab.id, {
            command: 'attachPrompt',
        }).catch(() => {});
        this.attachPrompt();
        // Create contextual menus
        createMenus();
        if (debug) {
            console.log('Starting recorder.');
            console.log('New suite name: ' + name);
        }
        this.clearRecordedDom();
        this.cleanRecording();
        this.switchRecordingState('record');
        this.currentSuite = new TestSuite(name);
        this.recordingTab = tab;
        this.initialRecordingWindowId = tab.windowId;
        this.openedWindowIds[tab.windowId] = true;
        this.currentRecordingTabId = tab.id;
        this.currentRecordingWindowId = tab.windowId;
        // tslint:disable-next-line:no-string-literal
        this.openedTabNames['win_ser_local'] = tab.id;
        this.openedTabIds[tab.id] = 'win_ser_local';
        this.openedTabCount = 1;
        this.currentRecordingFrameLocation = 'root';
        if (debug) {
            console.log('Attempting to start recorder on tab id: ' + tab);
        }
        chrome.tabs.sendMessage(tab.id, { attachRecorder: true }).catch(() => {});
        chrome.tabs.sendMessage(this.recordingTab.id, { msg: 'addTransactionPopupUi' }).catch(() => {});
        this.addObserver(tab);
        this.currentSuite.addObserver(tab);
        // Attach listeners
        this.attach();

        const viewportSize = [tab.width, tab.height];
        const viewportString = viewportSize.join(',');

        this.recordCommand({
            command: 'resizeWindow',
            value: viewportString,
            target: '',
            targetOptions: [],
        });

        // Save starting url for further checking for url changing
        // for "open" command logic
        this.currentUrl = this.recordingTab.url;
        // if url in array of forbidden to record domains not record it
        checkForForbiddenDomain(tab.url).then((isForbiddenDomain) => {
            if (!isForbiddenDomain) {
                // Record open command at first time
                this.recordCommand({ command: 'open', target: this.recordingTab.url, value: '', targetOptions: [] });
            }
        });
    }

    public attachPrompt() {
        for (const tab of Object.keys(this.openedTabIds)) {
            chrome.tabs.sendMessage(Number(tab), {
                command: 'attachPrompt',
            }).catch(() => {});
        }
    }

    public detachPrompt() {
        for (const tab of Object.keys(this.openedTabIds)) {
            chrome.tabs.sendMessage(Number(tab), {
                command: 'detachPrompt',
            }).catch(() => {});
        }
    }

    public endRecording(closeRecordingWindow?: boolean) {
        this.detachPrompt();
        this.switchRecordingState('stopped');

        this.removeObserver(this.recordingTab.id);
        for (const item of Object.keys(this.openedTabIds)) {
            this.removeObserver(Number(item));
        }
        this.currentSuite.clearObservers();
        // Remove context menus
        removeMenus();
        chrome.tabs.query({}, (tabs) => {
            for (const item of tabs) {
                chrome.tabs.sendMessage(item.id, { detachRecorder: true }).catch(() => {});
                chrome.tabs.sendMessage(item.id, { msg: 'removeTransactionPopupUi' }).catch(() => {});
            }
        });
        this.detach();

        if (closeRecordingWindow && this.recordingTab.windowId === this.initialRecordingWindowId) {
            chrome.windows.remove(this.recordingTab.windowId);
        }
    }

    public pauseRecording() {
        if (debug) {
            console.log('Pausing the recorder');
        }
        this.switchRecordingState('pause');
    }

    public resumeRecording() {
        if (debug) {
            console.log('Resuming the recorder');
        }
        this.switchRecordingState('record');
        chrome.tabs.sendMessage(this.recordingTab.id, { attachRecorder: true }).catch(() => {});
    }

    public cleanRecording() {
        this.countClicks = 0;
        this.switchRecordingState('stopped');
        this.currentSuite = null;
        chrome.action.setBadgeText({
            text: '',
        });

        for (const tabId of Object.keys(this.openedTabIds)) {
            chrome.tabs.sendMessage(Number(tabId), { detachRecorder: true }).catch(() => {});
            chrome.tabs.sendMessage(Number(tabId), { msg: 'removeTransactionPopupUi' }).catch(() => {});
        }

        this.recordingTab = null;

        if (this.debuggerTab) {
            chrome.tabs.remove(this.debuggerTab.id, () => {
                this.debuggerTab = null;
                if (debug) {
                    console.log('Removed the debugger tab');
                }
            });
        }
        if (this.editorTabId) {
            chrome.tabs.remove(this.editorTabId, () => {
                this.editorTabId = null;
                if (debug) {
                    console.log('Removed the editor tab: ');
                }
            });
        }

        this.clearRecordedDom();

        this.currentRecordingTabId = null;
        this.currentRecordingWindowId = null;
        this.currentRecordingFrameLocation = null;
        this.openedTabNames = {};
        this.openedTabIds = {};
        this.openedTabCount = 0;
        this.openedWindowIds = {};
        this.contentWindowId = -1;
        this.selfWindowId = -1;
        // this.attached = false;
        this.detach();
    }

    public recordCommand(command: TestCommand) {
        if (this.applyFilters(command)) {
            if (this.recording === 'record' || (this.recording === 'pause' && command.command.startsWith('assert'))) {
                this.notifyObservers();
                if (!this.currentSuite) {
                    this.currentSuite = new TestSuite('New Test Suite');
                }
                this.countClicks++;
                const lastTestCaseIndex = this.currentSuite.getLastTestCaseIndex();
                const lastCommandIndex = this.currentSuite.test_cases[lastTestCaseIndex].commands.length;
                if (command.command.match(/OnNext/i)) {
                    this.currentSuite.addCommand(lastTestCaseIndex, lastCommandIndex - 1, command);
                } else {
                    this.currentSuite.addCommand(lastTestCaseIndex, lastCommandIndex, command);
                }
            } else {
                if (debug) {
                    console.log('Command received, but recording status is: ' + this.recording);
                }
            }
        } else {
            if (debug) {
                console.log('Command blocked by filter. Command: ' + command);
            }
        }
    }

    public addCommand(testCaseIndex: number, commandIndex: number, command: TestCommand) {
        this.currentSuite.addCommand(testCaseIndex, commandIndex, command);
    }

    public addTestCase(testCaseIndex: number, testCase: TestCase) {
        this.currentSuite.addTestCase(testCaseIndex, testCase);
    }

    public exportJson() {
        // if option selected
        this.currentSuite.test_cases.forEach((testCase, testCaseIndex) => {
            testCase.commands.forEach((command, commandIndex) => {
                const collectionIndex =
                    this.recordedDomMapping[testCaseIndex] && this.recordedDomMapping[testCaseIndex][commandIndex];
                this.currentSuite.assignDomToCommand(
                    testCaseIndex,
                    commandIndex,
                    Array.from(this.recordedDomSet)[collectionIndex],
                );
            });
        });

        return this.currentSuite.exportJSON();
    }

    public applyFilters(command: TestCommand) {
        if (command.command) {
            const targetOptions = command.targetOptions as string[][];
            for (const item of targetOptions) {
                if (item) {
                    // Save filters on file
                    // The id of the popup-ui
                    if (item[0].includes('5c32565c-a0ba-42be-8060-34d2cf2285fa')) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    public updateSuiteName(name: string) {
        if (this.currentSuite) {
            this.currentSuite.suite_name = name;
        }
    }

    // TODO: data is supposed to be of type TestCase[], but for some reason this method tries to access suite_name...
    public updateTestCases(data: any) {
        if (!this.currentSuite) {
            this.currentSuite = new TestSuite(data.suite_name);
        }
        this.currentSuite.updateTestCases(data);
    }

    public getSuiteName() {
        return this.currentSuite.suite_name;
    }

    public getTransactions() {
        return this.currentSuite.test_cases.map((x) => ({
            name: x.testStep,
            counter: x.commands.length,
        }));
    }

    public getTransactionsCommands() {
        return this.currentSuite.test_cases.map((x) => ({
            name: x.testStep,
            counter: x.commands.length,
            commands: x.commands,
        }));
    }

    public totalCommandsCount() {
        let counter = 0;
        for (const testCase of this.currentSuite.test_cases) {
            for (const command of testCase.commands) {
                counter++;
            }
        }
        return counter;
    }

    public updateTransactions(transactions: any[]) {
        this.transactions = transactions;
    }

    public addNewTestCase(name: string) {
        this.currentSuite.addNewTestCase(name);
    }

    public updateTestCaseName(testCase: number, name: string) {
        this.currentSuite.updateTestCaseName(testCase, name);
    }

    public updateCommandIndex(testCaseIndex: number, commandFromIndex: number, commandToIndex: number) {
        this.currentSuite.updateCommandIndex(testCaseIndex, commandFromIndex, commandToIndex);
    }

    public getTestCase(testCase: number) {
        return this.currentSuite.getTestCase(testCase);
    }

    public deleteCommmand(testCaseIndex: number, commandIndex: number) {
        this.currentSuite.deleteCommmand(testCaseIndex, commandIndex);
    }

    public addObserver(tab: Tab) {
        // Check if the observer is already on the list
        for (const observer of this.observers) {
            if (observer.id === tab.id) {
                return false;
            }
        }
        this.observers.push(tab);
        return true;
    }

    public getAllObservers() {
        return this.observers;
    }

    public deleteTestCase(testCaseIndex: number) {
        this.currentSuite.deleteTestCase(testCaseIndex);
    }

    public removeObserver(id: number) {
        let targetObserverIndex;
        for (let i = 0; i < this.observers.length; i++) {
            if (this.observers[i].id === id) {
                targetObserverIndex = i;
            }
        }
        if (targetObserverIndex) {
            this.observers.splice(targetObserverIndex, 1);
        } else {
            if (debug) {
                console.log('Observer with id: ' + id + 'not found.');
            }
        }
    }

    public notifyObservers() {
        if (debug) {
            console.log('Attempting to notify observers: ');
            console.log('observers', this.observers);
        }
        for (const item of this.observers) {
            chrome.tabs.sendMessage(item.id, {
                command: 'recorderNotification',
                observable: this,
            }).catch(() => {});
        }
        if (debug) {
            console.log('Observers notified');
        }
    }

    public switchRecordingState(recordingState: string) {
        if (debug) {
            console.log('Switching recording state: ' + recordingState);
        }
        this.recording = recordingState;
        this.notifyObservers();
    }

    public updateBadgeCounter(counter: number) {
        if (debug) {
            console.log('Going to update the new badge counter to: ' + counter);
        }
        this.countClicks = counter;
        chrome.action.setBadgeText({ text: '' + this.countClicks + '' });
    }

    public updateCommand(testCaseIndex: number, commandIndex: number, command: TestCommand) {
        this.currentSuite.updateCommand(testCaseIndex, commandIndex, command);
    }

    public updateCommandProperty(testCaseIndex: number, commandIndex: number, commandProperty: string, value: any) {
        this.currentSuite.updateCommandProperty(testCaseIndex, commandIndex, commandProperty, value);
    }

    public loadStructuredModel(model: any) {
        this.structuredModel = model;
    }

    public loadSuiteJSON(json: any) {
        if (!this.currentSuite) {
            this.currentSuite = new TestSuite(json.suite_name);
        }
        this.currentSuite.loadSuiteJSON(json);
        // let counter = this.totalCommandsCount();
        // console.log("Counter commands: " + counter);
        // this.updateBadgeCounter(counter);
    }

    /**
     *
     * @param {string} commandName
     * @param {*} commandTarget
     * @param {*} commandValue
     * @param {Object} [extra] - Extra information about the action
     */
    public addCommandAuto(commandName: string, commandTarget: string[][], commandValue: string, extra?: any) {
        let command: any; // TODO: Need normal type resolve
        if (commandTarget.constructor === Array) {
            command = {
                command: commandName,
                target: commandTarget[0][0],
                value: commandValue,
                attributes: extra ? extra.attributes : undefined,
                targetOptions: commandTarget,
            };
        } else {
            command = {
                command: commandName,
                target: commandTarget,
                value: commandValue,
                attributes: extra ? extra.attributes : undefined,
                targetOptions: [],
            };
        }
        // if the current command is an action that needs the element to be interactable,
        // put in a waitFor command before it to ensure that it can be interacted with
        if (this.interactableActions.has(command.command)) {
            const waitForInteractableCommand: TestCommand = {
                command: 'waitFor',
                value: 'Clickable',
                target: command.target,
                targetOptions: command.targetOptions,
            };
            this.recordCommand(waitForInteractableCommand);
        }
        this.recordCommand(command);
    }

    public addCommandBeforeLastCommand(commandName: string, commandTarget: string[][], commandValue: string) {
        if (debug) {
            console.log('Attempting to add command before last');
        }
        const command = {
            command: commandName,
            target: commandTarget[0][0],
            value: commandValue,
            targetOptions: commandTarget,
        };
        const lastTestCaseIndex = this.currentSuite.getLastTestCaseIndex();
        const lastCommandIndex = this.currentSuite.test_cases[lastTestCaseIndex].commands.length - 1;
        this.addCommand(lastTestCaseIndex, lastCommandIndex - 1, command);
    }

    // Handler for tabs.onActivated event
    // Fires when the active tab in a window changes

    public activatedListener(activeInfo: TabActiveInfo) {
        chrome.tabs.get(activeInfo.tabId).then((tab) => {
            // if url in array of forbidden to record domains not record it
            checkForForbiddenDomain(tab.url).then((isForbiddenDomain) => {
                if (!isForbiddenDomain) {
                    // record command only if tab not exists in array of known for record tabs
                    if (!this.openedTabIds.hasOwnProperty(tab.id)) {
                        const targetUrl = tab.url === 'chrome://newtab/' ? '""' : tab.url;
                        this.recordCommand({ command: 'openWindow', target: targetUrl, value: '', targetOptions: [] });
                        // attaching all the necessary for recording to new tab
                        this.changeRecordingTab(tab);
                    }
                    // adding command selectWindow each time new recording tab activated
                    this.addCommandAuto('selectWindow', [[this.openedTabIds[tab.id]]], '');
                    // change current url for new ones as it was changed
                    // for further checking for url changing in checkUrlsMatch function
                    this.currentUrl = tab.url;
                }
            });
        });
    }

    public addCommandMessageHandler(message: any, sender: any, sendRequest: Function) {
        message = message.step;
        if (!message.command || this.openedWindowIds[sender.tab.windowId] == null) {
            return;
        }

        if (Object.keys(this.openedTabIds).length === 0) {
            this.openedTabIds = {};
            this.openedTabNames = {};
            this.currentRecordingFrameLocation = 'root';
            this.currentRecordingTabId = sender.tab.id;
            this.currentRecordingWindowId = sender.tab.windowId;
            this.openedTabCount = 1;
        }
        if (Object.keys(this.openedTabIds).length === 0) {
            this.currentRecordingTabId = sender.tab.id;
            this.currentRecordingWindowId = sender.tab.windowId;
            // tslint:disable-next-line:no-string-literal
            this.openedTabNames['win_ser_local'] = sender.tab.id;
            this.openedTabIds[sender.tab.id] = 'win_ser_local';
        }

        if (this.openedTabIds[sender.tab.id] == null) {
            return;
        }

        if (message.frameLocation.location !== this.currentRecordingFrameLocation) {
            const newFrameLevels = message.frameLocation.location.split(':');
            const newFrameLocators = message.frameLocation.locators;
            const oldFrameLevels = this.currentRecordingFrameLocation.split(':');
            while (oldFrameLevels.length > newFrameLevels.length) {
                this.addCommandAuto('selectFrame', [['relative=parent']], '');
                oldFrameLevels.pop();
            }
            while (
                oldFrameLevels.length !== 0 &&
                oldFrameLevels[oldFrameLevels.length - 1] !== newFrameLevels[oldFrameLevels.length - 1]
                ) {
                this.addCommandAuto('selectFrame', [['relative=parent']], '');
                oldFrameLevels.pop();
            }
            while (oldFrameLevels.length < newFrameLevels.length) {
                this.addCommandAuto('selectFrame', [[newFrameLocators[oldFrameLevels.length - 1]]], '');

                oldFrameLevels.push(newFrameLevels[oldFrameLevels.length]);
            }
            this.currentRecordingFrameLocation = message.frameLocation.location;
        }
        if (message.command.includes('Value') && typeof message.value === 'undefined') {
            // Handle error and show message to user
            create_notification('Assertion error', "This element does not have property 'value'.");
            // console.log("Error: This element does not have property 'value'.");
            return;
        } else if (message.command.includes('Text') && message.value === '') {
            // Handle error and show message to user
            create_notification('Assertion error', "This element does not have property 'Text'.");
            // console.log("Error: This element does not have property 'Text'.");
            return;
        } else if (message.command.includes('store')) {
            // In Google Chrome, window.prompt() must be triggered in
            // an actived tabs of front window, so we let panel window been focused
            // chrome.windows.update(this.selfWindowId, {focused: true})
            // .then(function() {

            // Even if window has been focused, window.prompt() still failed.
            // Delay a little time to ensure that status has been updated
            setTimeout(() => {
                message.value = prompt('Enter the name of the variable');
                if (message.insertBeforeLastCommand) {
                    this.addCommandBeforeLastCommand(message.command, message.targetOptions, message.value);
                } else {
                    // notification(message.command, message.target, message.value);
                    this.addCommandAuto(message.command, message.targetOptions, message.value);
                }
            }, 100);
            return;
        }
        // handle choose ok/cancel confirm
        this.addCommandAuto(message.command, message.targetOptions, message.value, { attributes: message.attributes });
    }

    public rebind() {
        // this.tabsOnActivatedHandler = this.tabsOnActivatedHandler.bind(this);
        this.activatedListener = this.activatedListener.bind(this);
        this.openListener = this.openListener.bind(this);
        this.windowsOnFocusChangedHandler = this.windowsOnFocusChangedHandler.bind(this);
        this.tabsOnRemovedHandler = this.tabsOnRemovedHandler.bind(this);
        this.webNavigationOnCreatedNavigationTargetHandler = this.webNavigationOnCreatedNavigationTargetHandler.bind(
            this,
        );
        this.addCommandMessageHandler = this.addCommandMessageHandler.bind(this);
    }

    public attach() {
        if (this.attached) {
            return;
        }
        this.attached = true;
        // chrome.tabs.onActivated.addListener(this.tabsOnActivatedHandler);
        // Fired when a tab is updated
        chrome.tabs.onUpdated.addListener(this.openListener);
        // Fires when the active tab in a window changes
        chrome.tabs.onActivated.addListener(this.activatedListener);
        chrome.windows.onFocusChanged.addListener(this.windowsOnFocusChangedHandler);
        chrome.tabs.onRemoved.addListener(this.tabsOnRemovedHandler);
        chrome.webNavigation.onCreatedNavigationTarget.addListener(this.webNavigationOnCreatedNavigationTargetHandler);
        // chrome.runtime.onMessage.addListener(this.addCommandMessageHandler);
    }

    public detach() {
        if (!this.attached) {
            return;
        }
        this.attached = false;
        // chrome.tabs.onActivated.removeListener(this.tabsOnActivatedHandler);
        chrome.tabs.onUpdated.removeListener(this.openListener);
        chrome.tabs.onActivated.removeListener(this.activatedListener);
        chrome.windows.onFocusChanged.removeListener(this.windowsOnFocusChangedHandler);
        chrome.tabs.onRemoved.removeListener(this.tabsOnRemovedHandler);
        chrome.webNavigation.onCreatedNavigationTarget.removeListener(
            this.webNavigationOnCreatedNavigationTargetHandler,
        );
        // chrome.runtime.onMessage.removeListener(this.addCommandMessageHandler);
    }

    public setOpenedWindow(windowId: number) {
        this.openedWindowIds[windowId] = true;
    }

    public setSelfWindowId(windowId: number) {
        this.selfWindowId = windowId;
    }

    public getSelfWindowId() {
        return this.selfWindowId;
    }

    /**
     * Handler for tabs.onUpdated event
     * Fires when a tab is updated
     * @param tabId
     * @param changeInfo
     * @param tab
     * @private
     */
    private openListener(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) {
        if (changeInfo.url != null) {
            // if url (domain) was changed do open command recording logic
            const urlChangeFlag = checkUrlsMatch(this.currentUrl, changeInfo.url);
            // if url in array of forbidden to record domains not record it
            checkForForbiddenDomain(tab.url).then((isForbiddenDomain) => {
                if (!urlChangeFlag && !isForbiddenDomain) {
                    // checking for new tab was opened
                    if (changeInfo.url === 'chrome://newtab/') {
                        // openWindow recording in activatedListener
                    } else {
                        this.recordCommand({ command: 'open', target: changeInfo.url, value: '', targetOptions: [] });
                    }
                    // change current url for new ones as it was changed
                    // for further checking for url changing in checkUrlsMatch function
                    this.currentUrl = changeInfo.url;
                }
            });
        }
    }

    /**
     * Sideex Listener. Not Using at the moment
     * Sideex record.js
     * TODO: rename testCaseId to something with what to identify the current recording
     * TODO: rename method
     * @param activeInfo
     * @private
     */
    private tabsOnActivatedHandler(activeInfo: TabActiveInfo) {
        if (Object.keys(this.openedTabIds).length === 0) {
            return;
        }
        // Because event listener is so fast that selectWindow command is added
        // before other commands like clicking a link to browse in new tab.
        // Delay a little time to add command in order.
        setTimeout(() => {
            if (
                this.currentRecordingTabId === activeInfo.tabId &&
                this.currentRecordingWindowId === activeInfo.windowId
            ) {
                return;
            }
            // If no command has been recorded, ignore selectWindow command
            // until the user has select a starting page to record the commands
            if (this.totalCommandsCount() === 0) {
                return;
            }
            // Ignore all unknown tabs, the activated tab may not derived from
            // other opened tabs, or it may managed by other SideeX panels
            if (this.openedTabIds[activeInfo.tabId] === undefined) {
                return;
            }

            // Tab information has existed, add selectWindow command
            this.currentRecordingTabId = activeInfo.tabId;
            this.currentRecordingWindowId = activeInfo.windowId;
            this.currentRecordingFrameLocation = 'root';
            this.addCommandAuto('selectWindow', [[this.openedTabIds[activeInfo.tabId]]], '');
        }, 150);
    }

    private windowsOnFocusChangedHandler(windowId: number) {
        if (Object.keys(this.openedTabIds).length === 0) {
            return;
        }
        if (windowId === chrome.windows.WINDOW_ID_NONE) {
            // In some Linux window managers, WINDOW_ID_NONE will be listened before switching
            // See MDN reference :
            // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/windows/onFocusChanged
            return;
        }
        // If the activated window is the same as the last, just do nothing
        // selectWindow command will be handled by tabs.onActivated listener
        // if there also has a event of switching a activated tab
        if (this.currentRecordingWindowId === windowId) {
            return;
        }

        chrome.tabs.query({ windowId, active: true }).then((tabs) => {
            if (tabs.length === 0 || this.isPrivilegedPage(tabs[0].url)) {
                return;
            }
            // The activated tab is not the same as the last
            if (tabs[0].id !== this.currentRecordingTabId) {
                // If no command has been recorded, ignore selectWindow command
                // until the user has select a starting page to record commands
                if (this.totalCommandsCount() === 0) {
                    return;
                }

                // Ignore all unknown tabs, the activated tab may not derived from
                // other opened tabs, or it may managed by other SideeX panels
                if (this.openedTabIds[tabs[0].id] === undefined) {
                    return;
                }

                // Tab information has existed, add selectWindow command
                this.currentRecordingWindowId = windowId;
                this.currentRecordingTabId = tabs[0].id;
                this.currentRecordingFrameLocation = 'root';
                this.addCommandAuto('selectWindow', [[this.openedTabIds[tabs[0].id]]], '');
            }
        });
    }

    private tabsOnRemovedHandler(tabId: number, removeInfo: TabRemoveInfo) {
        if (Object.keys(this.openedTabIds).length === 0) {
            return;
        }
        if (this.openedTabIds[tabId] !== undefined) {
            if (this.currentRecordingTabId !== tabId) {
                this.addCommandAuto('selectWindow', [[this.openedTabIds[tabId]]], '');
                this.addCommandAuto('close', [[this.openedTabIds[tabId]]], '');
                this.addCommandAuto('selectWindow', [[this.openedTabIds[this.currentRecordingTabId]]], '');
            } else {
                this.addCommandAuto('close', [[this.openedTabIds[tabId]]], '');
            }
            // Remove tab observers
            this.removeObserver(tabId);
            this.currentSuite.removeObserver(tabId);
            delete this.openedTabNames[this.openedTabIds[tabId]];
            delete this.openedTabIds[tabId];
            this.currentRecordingFrameLocation = 'root';
        }
    }

    private webNavigationOnCreatedNavigationTargetHandler(details: WebNavigationSourceCallbackDetails) {
        if (this.openedTabIds[details.sourceTabId] !== undefined) {
            this.openedTabNames['win_ser_' + this.openedTabCount] = details.tabId;
            this.openedTabIds[details.tabId] = 'win_ser_' + this.openedTabCount;

            chrome.tabs.get(details.tabId).then((tabInfo) => {
                this.setOpenedWindow(tabInfo.windowId);
                // Observer
                this.currentSuite.addObserver(tabInfo);
                this.addObserver(tabInfo);
            });

            this.openedTabCount++;
            this.attachPrompt();
        }
    }

    private isPrivilegedPage(url: string) {
        if (url.substr(0, 13) === 'moz-extension' || url.substr(0, 16) === 'chrome-extension') {
            return true;
        }
        return false;
    }

    private clearRecordedDom() {
        this.recordedDomMapping = [];
        this.recordedDomSet.clear();
    }

    private changeRecordingTab(tab: chrome.tabs.Tab) {
        chrome.tabs.sendMessage(tab.id, {
            command: 'attachPrompt',
        }).catch(() => {});
        this.attachPrompt();
        this.recordingTab = tab;
        this.openedWindowIds[tab.windowId] = true;
        this.currentRecordingTabId = tab.id;
        this.currentRecordingWindowId = tab.windowId;
        // Storing tab ids and Tab names. Using in multiple tabs recording
        // Tab Names Unique Ids are made by counting of Tabs where was recording
        const winSerName = 'win_ser_' + this.openedTabCount;
        if (!this.openedTabIds.hasOwnProperty(tab.id)) {
            this.openedTabNames[winSerName] = tab.id;
            this.openedTabIds[tab.id] = winSerName;
            this.currentRecordingFrameLocation = 'root';
            this.openedTabCount++;
        }
        chrome.tabs.sendMessage(tab.id, { attachRecorder: true }).catch(() => {});
        chrome.tabs.sendMessage(this.recordingTab.id, { msg: 'addTransactionPopupUi' }).catch(() => {});
        this.addObserver(tab);
        this.currentSuite.addObserver(tab);
    }
}
