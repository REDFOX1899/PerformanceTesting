import { Suite, TestCase, TestCommand } from '../types';

export class TestSuite implements Suite {
    public suite_name: string;
    public test_cases: TestCase[];
    public observers: chrome.tabs.Tab[];

    constructor(name: string) {
        this.suite_name = name;
        this.test_cases = [{ testStep: 'Test', commands: [] }];
        this.observers = [];
    }

    public getTestCase(testCase: number) {
        return this.test_cases[testCase];
    }

    public getTestCaseName(testCase: number) {
        return this.test_cases[testCase].testStep;
    }

    public getLastTestCaseIndex() {
        return this.test_cases.length - 1;
    }

    public getSteps(testCase: number) {
        return this.test_cases[testCase].commands;
    }

    public addNewTestCase(name: string) {
        const newTestCase: TestCase = {
            testStep: name,
            commands: [],
        };

        this.test_cases.push(newTestCase);
        this.notifyObservers('addTestCase', { testCaseIndex: this.test_cases.length - 1 });
    }

    public addCommand(testCaseIndex: number, commandIndex: number, command: TestCommand) {
        if (commandIndex >= this.test_cases[testCaseIndex].commands.length) {
            // console.log("addCommandAtIndex: Pushing command");
            this.test_cases[testCaseIndex].commands.push(command);
        } else {
            // console.log("addCommandAtIndex: Splicing command");
            this.test_cases[testCaseIndex].commands.splice(commandIndex, 0, command);
        }
        this.notifyObservers('addCommand', { testCaseIndex, commandIndex });
    }

    public addTestCase(testCaseIndex: number, testCase: TestCase) {
        if (testCaseIndex >= this.test_cases.length) {
            // console.log("addTestCaseAtIndex: Pushing command");
            this.test_cases.push(testCase);
        } else {
            // console.log("addTestCaseAtIndex: Splicing command");
            this.test_cases.splice(testCaseIndex, 0, testCase);
        }
        this.notifyObservers('addTestCase', { testCaseIndex });
    }

    public assignDomToCommand(testCaseIndex: number, commandIndex: number, dom: any) {
        this.test_cases[testCaseIndex].commands[commandIndex].recordedDom = dom;
        this.notifyObservers('assignDomToCommand', { testCaseIndex, commandIndex });
    }

    /**
     *
     * @param {string} id - identifier of screenshot
     * @param {string} image - image for the screenshot in base64
     */
    public addScreenshot(id: string, image: string) {
        for (const testCase of this.test_cases) {
            for (const cmd of testCase.commands) {
                if (cmd.attributes && cmd.attributes.recordId === id) {
                    cmd.attributes.screenshot = image;
                    delete cmd.attributes.recordId;
                    return;
                }
            }
        }
    }

    public deleteTestCase(testCaseIndex: number) {
        this.test_cases.splice(testCaseIndex, 1);
        this.notifyObservers('deleteTestCase', { testCaseIndex });
    }

    public deleteCommmand(testCaseIndex: number, commandIndex: number) {
        this.test_cases[testCaseIndex].commands.splice(commandIndex, 1);
        this.notifyObservers('deleteCommand', { testCaseIndex: testCaseIndex, commandIndex: commandIndex });
    }

    public updateTestCaseName(testCase: number, name: string) {
        this.test_cases[testCase].testStep = name;
        this.notifyObservers('updateTestCaseName', { testCaseIndex: testCase });
    }

    public updateTestCases(testCases: TestCase[]) {
        this.test_cases = testCases;
        this.notifyObservers();
    }

    public updateCommand(testCaseIndex: number, commandIndex: number, command: TestCommand) {
        this.test_cases[testCaseIndex].commands[commandIndex] = command;
        this.notifyObservers('updateCommand', { testCaseIndex, commandIndex });
    }

    public updateCommandProperty(testCaseIndex: number, commandIndex: number, commandProperty: string, value: string) {
        // @ts-ignore
        this.test_cases[testCaseIndex].commands[commandIndex][commandProperty] = value;
        this.notifyObservers('updateCommandProperty', {
            testCaseIndex,
            commandIndex,
            commandProperty,
        });
    }

    public updateCommandIndex(testCaseIndex: number, commandFromIndex: number, commandToIndex: number) {
        this.test_cases[testCaseIndex].commands.splice(commandToIndex, 0, this.test_cases[testCaseIndex].commands.splice(commandFromIndex, 1)[0]);
        this.notifyObservers('updateCommandIndex', {
            testCaseIndex,
            commandFromIndex,
            commandToIndex,
        });
    }

    public exportJSON() {
        return {
            suite_name: this.suite_name,
            test_cases: this.test_cases,
        };
    }

    public loadSuiteJSON(json: TestSuite) {
        this.suite_name = json.suite_name;
        this.test_cases = json.test_cases;
    }

    public addObserver(tab: chrome.tabs.Tab) {
        for (let i = 0; i < this.observers.length; i++) {
            if (this.observers[i].id === tab.id) {
                return false;
            }
        }
        this.observers.push(tab);
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
            // console.log("TEST SUITE: Observer with id: " + id + "not found.");
        }
    }

    public notifyObservers(action?: string, indexes?: object) {
        // console.log("TEST SUITE: Attempting to notify observers: ");
        // console.log(this.observers);
        const notified = [];
        const options = {
            action,
            indexes,
        };
        for (const observer of this.observers) {
            if (notified.indexOf(observer.id) === -1) {
                chrome.tabs.sendMessage(observer.id, {
                    command: 'testSuiteNotification',
                    observable: this,
                    options,
                }).catch(() => {});
                notified.push(observer.id);
            } else {
                // console.log("Observer: " + this.observers[i].id + " already notified");
            }
        }
        // console.log("Observers notified: ");
        // console.log(notified);
    }

    public clearObservers() {
        this.observers = [];
    }
}
