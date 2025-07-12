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

var extCommand = new ExtCommand();

class OldPlaybackApi {
    constructor(callbacks) {
        this.currentPlayingCommandIndex = -1;
        this.isPlaying = false;
        this.isPause = false;
        this.pageCount = 0;
        this.pageTime = "";
        this.ajaxCount = 0;
        this.ajaxTime = "";
        this.domCount = 0;
        this.domTime = "";
        this.implicitCount = 0;
        this.implicitTime = "";
        this.caseFailed = false;
        this.currentPlayingTestCaseIndex = -1;
        this.currentSuite = null;
        this.skipNextBreakpoint = false;
        this.callbacks = callbacks;
        this.replayDelay = 500;
        this.breakPoints = [];
    }

    async play() {
        try {
            await this.initializePlayingProgress();
            await this.executionLoop();
            this.finalizePlayingProgress();
        } catch (reason) {
            this.catchPlayingError(reason);
        }
    }

    stop() {
        if (this.isPause) {
            this.isPause = false;
        }
        this.isPlaying = false;
        this.finalizePlayingProgress();
    }

    pause() {
        if (this.isPlaying) {
            this.isPause = true;
            this.isPlaying = false;
            // No need to detach
            // prevent from missing status info
            //extCommand.detach();
        }
    }

    async resume() {
        if (this.isPause) {
            this.isPlaying = true;
            this.isPause = false;
            extCommand.attach();
            try {
                await this.executionLoop();
                this.finalizePlayingProgress();
                // .catch(this.catchPlayingError);
            }
            catch (ex) {
                this.catchPlayingError(ex);
                //Temporal fix for resume failing when between test cases
                // It looks scary
                try {
                    await this.executionLoop();
                    this.finalizePlayingProgress();
                } catch (reason) {
                    this.catchPlayingError(reason);
                }
            }
        }
    }

    async playSuite(suite, i) {
        this.currentSuite = suite;
        this.currentPlayingTestCaseIndex = i;

        try {
            await this.initializePlayingProgress();
            await this.executionLoop();
            this.finalizePlayingProgress();
        } catch (reason) {
            this.catchPlayingError(reason);
        }
    }

    async executionLoop() {
        let commands = this.currentSuite.test_cases[this.currentPlayingTestCaseIndex].commands;

        // Here the replay jumped to a new testcase
        if (this.currentPlayingCommandIndex + 1 >= commands.length) {
            this.currentPlayingTestCaseIndex++;
            // Next test case exists
            if (this.currentSuite.test_cases[this.currentPlayingTestCaseIndex] !== undefined) {
                commands = this.currentSuite.test_cases[this.currentPlayingTestCaseIndex].commands;
                this.currentPlayingCommandIndex = -1;
            }
            else {
                // Check if failed /Remove?
                if (!this.caseFailed) {
                    // WARN: Global reference
                    declaredVars = {};
                    console.log("Test case passed");
                    this.callbacks.updateTestCaseStatus(this.currentPlayingTestCaseIndex, "success");
                    this.callbacks.successFullReplay();
                    return true;
                } else {
                    this.caseFailed = false;
                }
            }
            // return true;
        }
        let nextCommand = this.getNextCommand();
        if (nextCommand) {
            if (this.checkIfBreakpoint(nextCommand.testCaseIndex, nextCommand.commandIndex)) {
                this.callbacks.switchOnReplayStatus('pause');
                this.callbacks.updateStatus('Paused on breakpoint', 'info');
                this.pause();
                // WARN: Global reference
                replayStatus = 'breakpoint';
                return Promise.reject("shutdown");
            }
        }

        if (!this.isPlaying) {
            return Promise.reject("shutdown");
        }

        if (this.isPause) {
            return Promise.reject("shutdown");
        }

        this.currentPlayingCommandIndex++;
        this.callbacks.updateCommandStatus(this.currentPlayingTestCaseIndex, this.currentPlayingCommandIndex, "pending");

        let commandName = commands[this.currentPlayingCommandIndex].command;
        let commandTarget = commands[this.currentPlayingCommandIndex].target;
        let commandValue = commands[this.currentPlayingCommandIndex].value;

        if (commandName === "") {
            return Promise.reject("no command name");
        }

        let speed = this.replayDelay;
        if (commandName === 'assertAlert' || commandName === 'assertConfirmation' || commandName === 'assertPrompt' || commandName === 'assertDialog') {
            speed = 50;
        }
        return delay(speed).then(async () => {
            if (ExtCommand.isExtCommand(commandName)) {
                console.log("Executing: | " + commandName + " | " + commandTarget + " | " + commandValue + " |");
                let upperCase = commandName.charAt(0).toUpperCase() + commandName.slice(1);
                try {
                    await extCommand["do" + upperCase](commandTarget, commandValue);
                    this.callbacks.updateCommandStatus(this.currentPlayingTestCaseIndex, this.currentPlayingCommandIndex, "success");

                } catch (reason) {
                    //Ext command failed?
                    console.log(reason);
                    this.callbacks.updateCommandStatus(this.currentPlayingTestCaseIndex, this.currentPlayingCommandIndex, "fail");
                    this.callbacks.updateTestCaseStatus(this.currentPlayingTestCaseIndex, "fail");
                    console.log("Test case failed");
                    this.callbacks.failedReplay(reason);
                    this.stop();
                }

                return await this.executionLoop();
            } else {
                await this.doPreparation();
                await this.doPrePageWait();
                await this.doPageWait();
                await this.doAjaxWait();
                await this.doDomWait();
                await this.doCommand();
                return await this.executionLoop();
            }
        });
    }

    // private
    getNextCommand() {
        const testCaseIndex = this.currentPlayingTestCaseIndex;
        const commandIndex = this.currentPlayingCommandIndex;
        if (this.currentSuite.test_cases[testCaseIndex].commands[commandIndex + 1]) {
            return {testCaseIndex: testCaseIndex, commandIndex: commandIndex + 1};
        }
        else if (this.currentSuite.test_cases[testCaseIndex + 1]) {
            if (this.currentSuite.test_cases[testCaseIndex + 1].commands) {
                return {testCaseIndex: testCaseIndex + 1, commandIndex: 0}
            }
        }
        return null;
    }

    checkIfBreakpoint(testCaseIndex, commandIndex) {
        if (this.skipNextBreakpoint) {
            this.skipNextBreakpoint = false;
            return false;
        }

        return this.breakPoints.some(x => x.testCaseIndex === testCaseIndex && x.commandIndex === commandIndex);
    }

    async playAfterConnectionFailed() {
        if (!this.isPlaying) {
            return;
        }

        try {
            this.initializeAfterConnectionFailed();
            await this.executionLoop();
            this.finalizePlayingProgress();
        } catch (reason) {
            this.catchPlayingError(reason);
        }
    }

    initializeAfterConnectionFailed() {
        this.isPlaying = true;
        this.cleanTimeouts();
        this.caseFailed = false;
    }

    // private
    initializePlayingProgress() {
        this.isPlaying = true;
        this.currentPlayingCommandIndex = -1;
        this.cleanTimeouts();
        this.caseFailed = false;

        return extCommand.init();
    }

    // private
    catchPlayingError(reason) {
        // doCommands is depend on test website, so if make a new page,
        // doCommands function will fail, so keep retrying to get connection
        if (isReceivingEndError(reason)) {
            setTimeout(async () => {
                this.currentPlayingCommandIndex--;
                await this.playAfterConnectionFailed();
            }, 100);
        } else if (reason === "shutdown") {

        } else {
            extCommand.clear();
            console.log(reason);

            if (this.currentPlayingCommandIndex >= 0) {
                this.callbacks.updateCommandStatus(this.currentPlayingTestCaseIndex, this.currentPlayingCommandIndex, "fail");
            }

            this.callbacks.updateTestCaseStatus(this.currentPlayingTestCaseIndex, "fail");
            console.log("Test case failed");

            this.callbacks.failedReplay(reason);

            /* Clear the flag, reset to recording phase */
            /* A small delay for preventing recording events triggered in playing phase*/
            setTimeout(() => this.isPlaying = false, 500);
        }
    }

    // private
    doPreparation() {
        if (!this.isPlaying) {
            this.currentPlayingCommandIndex--;
            return Promise.reject("shutdown");
        }

        return extCommand.sendCommand("waitPreparation", "", "").then(() => true);
    }

    async doPrePageWait() {
        if (!this.isPlaying) {
            this.currentPlayingCommandIndex--;
            return Promise.reject("shutdown");
        }
        //console.log("in prePageWait");
        const response = await extCommand.sendCommand("prePageWait", "", "");
        if (response && response.new_page) {
            return await this.doPrePageWait();
        } else {
            return true;
        }
    }

    async doPageWait() {
        if (!this.isPlaying) {
            this.currentPlayingCommandIndex--;
            return Promise.reject("shutdown");
        }
        //console.log("in pageWait");
        const response = await extCommand.sendCommand("pageWait", "", "");
        if (this.pageTime && (Date.now() - this.pageTime) > 30000) {
            console.log("Page Wait timed out after 30000ms");
            this.pageCount = 0;
            this.pageTime = "";
            return true;
        } else if (response && response.page_done) {
            this.pageCount = 0;
            this.pageTime = "";
            return true;
        } else {
            this.pageCount++;
            if (this.pageCount === 1) {
                this.pageTime = Date.now();
                console.log("Wait for the new page to be fully loaded");
            }
            return await this.doPageWait();
        }
    }

    async doAjaxWait() {
        if (!this.isPlaying) {
            this.currentPlayingCommandIndex--;
            return Promise.reject("shutdown");
        }
        const response = await extCommand.sendCommand("ajaxWait", "", "");
        if (this.ajaxTime && (Date.now() - this.ajaxTime) > 30000) {
            console.log("Ajax Wait timed out after 30000ms");
            this.ajaxCount = 0;
            this.ajaxTime = "";
            return true;
        } else if (response && response.ajax_done) {
            this.ajaxCount = 0;
            this.ajaxTime = "";
            return true;
        } else {
            this.ajaxCount++;
            if (this.ajaxCount === 1) {
                this.ajaxTime = Date.now();
                console.log("Wait for all ajax requests to be done");
            }
            return await this.doAjaxWait();
        }
    }

    async doDomWait() {
        if (!this.isPlaying) {
            this.currentPlayingCommandIndex--;
            return Promise.reject("shutdown");
        }
        //console.log("in domWait");
        const response = await extCommand.sendCommand("domWait", "", "");
        if (this.domTime && (Date.now() - this.domTime) > 30000) {
            console.log("DOM Wait timed out after 30000ms");
            this.domCount = 0;
            this.domTime = "";
            return true;
        } else if (response && (Date.now() - response.dom_time) < 400) {
            this.domCount++;
            if (this.domCount === 1) {
                this.domTime = Date.now();
                console.log("Wait for the DOM tree modification");
            }
            return await this.doDomWait();
        } else {
            this.domCount = 0;
            this.domTime = "";
            return true;
        }
    }

    doCommand() {
        let commands = this.currentSuite.test_cases[this.currentPlayingTestCaseIndex].commands;
        const command = commands[this.currentPlayingCommandIndex];
        let commandName = command.command;
        let commandTarget = command.target;
        let commandValue = command.value;
        let timeout = 10000;
        if (commandName === 'waitFor') {
            [commandValue, timeout] = commandValue.split(':', 2);
            timeout = timeout || 10000;
        }
        //console.log("in common");

        if (this.implicitCount === 0) {
            console.log("Executing: | " + commandName + " | " + commandTarget + " | " + commandValue + " |");
        }

        if (!this.isPlaying) {
            this.currentPlayingCommandIndex--;
            return Promise.reject("shutdown");
        }

        let p = new Promise((resolve, reject) => {
            let count = 0;
            let interval = setInterval(() => {
                if (!this.isPlaying) {
                    this.currentPlayingCommandIndex--;
                    reject("shutdown");
                    clearInterval(interval);
                }
                if (count > 60) {
                    console.log("Timed out after 30000ms");
                    reject("Window not Found");
                    clearInterval(interval);
                }
                if (!extCommand.getPageStatus()) {
                    if (count === 0) {
                        console.log("Wait for the new page to be fully loaded");
                    }
                    count++;
                } else {
                    resolve();
                    clearInterval(interval);
                }
            }, 500);
        });
        return p.then(() => {
            if (commandValue.indexOf("${") !== -1) {
                commandValue = convertVariableToString(commandValue);
            }
            if (commandTarget.indexOf("${") !== -1) {
                commandTarget = convertVariableToString(commandTarget);
            }
            if (isWindowMethodCommand(commandName)) {
                return extCommand.sendCommand(commandName, commandTarget, commandValue, true);
            }
            return extCommand.sendCommand(commandName, commandTarget, commandValue);
        }).then(result => {
            if (result.result !== "success") {
                // implicit
                if (result.status === 'failed' || result.result.match(/Element[\s\S]*?not found/)) {
                    if (this.implicitTime && (Date.now() - this.implicitTime > timeout)) {
                        console.log(`Implicit Wait timed out after ${timeout}ms`);
                        this.implicitCount = 0;
                        this.implicitTime = "";
                    } else {
                        this.implicitCount++;
                        if (this.implicitCount === 1) {
                            console.log("Wait until the element is found");
                            this.implicitTime = Date.now();
                        }
                        return this.doCommand();
                    }
                }
                this.implicitCount = 0;
                this.implicitTime = "";

                this.callbacks.failedReplay(result.result);

                this.callbacks.updateCommandStatus(this.currentPlayingTestCaseIndex, this.currentPlayingCommandIndex, "fail");

                if (commandName.includes("verify") && result.result.includes("did not match")) {
                } else {
                    console.log("Test case failed");
                    this.caseFailed = true;
                    this.currentPlayingCommandIndex = commands.length;

                    this.callbacks.updateTestCaseStatus(this.currentPlayingTestCaseIndex, "fail");
                    this.stop();
                }
            } else {
                this.callbacks.updateCommandStatus(this.currentPlayingTestCaseIndex, this.currentPlayingCommandIndex, "success");
            }
        })
    }

    // private
    finalizePlayingProgress() {
        if (!this.isPause) {
            extCommand.clear();
        }
        this.currentPlayingCommandIndex = 0;
        this.currentPlayingTestCaseIndex = 0;
        setTimeout(() => this.isPlaying = false, 500);
    }

    cleanTimeouts() {
        this.pageCount = 0;
        this.ajaxCount = 0;
        this.domCount = 0;
        this.implicitCount = 0;
        this.pageTime = "";
        this.ajaxTime = "";
        this.domTime = "";
        this.implicitTime = "";
    }

    playSingleCommand(suite, testCaseIndex, commandIndex) {
        this.initializePlayingProgress().then(() => {
            let command = suite.test_cases[testCaseIndex].commands[commandIndex];
            let commandName = command.command;
            let commandTarget = command.target;
            let commandValue = command.value;
            let timeout = 10000;
            if (commandName === 'waitFor') {
                [commandValue, timeout] = commandValue.split(':', 2);
                timeout = timeout || 10000;
            }

            this.callbacks.updateCommandStatus(testCaseIndex, commandIndex, 'pending');

            if (ExtCommand.isExtCommand(commandName)) {
                console.log("Executing: | " + commandName + " | " + commandTarget + " | " + commandValue + " |");
                let upperCase = commandName.charAt(0).toUpperCase() + commandName.slice(1);
                extCommand["do" + upperCase](commandTarget, commandValue).then(() => {
                    this.callbacks.updateCommandStatus(testCaseIndex, commandIndex, "success");
                }, (reason) => {
                    //Ext command failed?
                    console.log(reason);
                    this.callbacks.updateCommandStatus(testCaseIndex, commandIndex, "fail");
                });
            } else {
                if (commandValue.indexOf("${") !== -1) {
                    commandValue = convertVariableToString(commandValue);
                }
                if (commandTarget.indexOf("${") !== -1) {
                    commandTarget = convertVariableToString(commandTarget);
                }
                if (isWindowMethodCommand(commandName)) {
                    return extCommand.sendCommand(commandName, commandTarget, commandValue, true);
                }
                extCommand.sendCommand(commandName, commandTarget, commandValue).then((result) => {
                    if (result.result !== "success") {
                        // implicit
                        if (result.status === 'failed' || result.result.match(/Element[\s\S]*?not found/)) {
                            if (this.implicitTime && (Date.now() - this.implicitTime > timeout)) {
                                console.log(`Implicit Wait timed out after ${timeout}ms`);
                                this.implicitCount = 0;
                                this.implicitTime = "";
                            } else {
                                this.implicitCount++;
                                if (this.implicitCount === 1) {
                                    console.log("Wait until the element is found");
                                    this.implicitTime = Date.now();
                                }
                                return this.doCommand();
                            }
                        }
                        this.implicitCount = 0;
                        this.implicitTime = "";

                        this.callbacks.updateCommandStatus(testCaseIndex, commandIndex, "fail");
                    } else {
                        this.callbacks.updateCommandStatus(testCaseIndex, commandIndex, "success");
                    }
                })
            }
        }).then(() => this.finalizePlayingProgress());
    }
}

function delay(t) {
    return new Promise(function (resolve) {
        setTimeout(resolve, t)
    });
}


function isReceivingEndError(reason) {
    return reason === "TypeError: response is undefined"
        || reason === "Error: Could not establish connection. Receiving end does not exist."
        // Below message is for Google Chrome
        || reason.message === "Could not establish connection. Receiving end does not exist."
        // Google Chrome misspells "response"
        || reason.message === "The message port closed before a reponse was received."
        || reason.message === "The message port closed before a response was received.";

}

function isWindowMethodCommand(command) {
    return command === 'answerOnNextPrompt'
        || command === 'chooseCancelOnNextPrompt'
        || command === 'assertPrompt'
        || command === 'chooseOkOnNextConfirmation'
        || command === 'chooseCancelOnNextConfirmation'
        || command === 'assertConfirmation'
        || command === 'assertAlert'
        || command === 'assertDialog'
        || command === 'answerDialog';
}

/**
 * Substitutes all the variables into the string.
 * Variables are taken from global object 'declaredVars'.
 * If some variable is not present - xlateArguments will fail!
 *
 * @param variable
 * @returns {string}
 */
function convertVariableToString(variable) {
    let frontIndex = variable.indexOf("${");
    let newStr = "";
    while (frontIndex !== -1) {
        let prefix = variable.substring(0, frontIndex);
        let suffix = variable.substring(frontIndex);
        let tailIndex = suffix.indexOf("}");
        let suffix_front = suffix.substring(0, tailIndex + 1);
        let suffix_tail = suffix.substring(tailIndex + 1);
        newStr += prefix + xlateArgument(suffix_front);
        variable = suffix_tail;
        frontIndex = variable.indexOf("${");
    }
    return newStr + variable;
}
