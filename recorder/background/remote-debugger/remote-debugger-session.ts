import { forAllTabs } from '../../common/utils';
import { ExtCommand } from '../ext-command';
import { PlaybackApi, Status } from '../playback-api';
import { getRecorder } from '../sideex/background-ui';
import { globalState } from '../state';
import CreateData = chrome.windows.CreateData;
import UpdateInfo = chrome.windows.UpdateInfo;

const backgroundRecorder = getRecorder({});

type Variables = Record<string, any>;
type Entities = Record<string, any>;

interface DapRequest {
    type: string;
    command: string;
    arguments?: { [key: string]: any };
}

interface UpdateStatusData {
    identifier?: string[];
    status: Status;
    reason?: string;
    nextStepId?: string[];
    successLocator?: string;
}

export class RemoteDebuggerSession {
    private replayingWindow: number;
    private variables: Variables = {};
    private structuredVariables: Entities = {};
    private initialVariables: Variables = {};
    private readonly playback: PlaybackApi;
    private readonly extCommand: ExtCommand;
    private platFormInfo: chrome.runtime.PlatformInfo;
    private publishUrl: string;
    private publishSessionId: string;

    constructor(private port: chrome.runtime.Port) {
        port.onMessage.addListener(msg => this.listener(msg));
        port.onDisconnect.addListener(this.handlePortDisconnection);
        this.extCommand = new ExtCommand();
        this.playback = new PlaybackApi(
            this.extCommand,
            {
                updateCommandStatus: this.updateCommandStatus.bind(this),
                updateStatus: this.updateStatus.bind(this),
                successFullReplay: this.successFullReplay.bind(this),
                failedReplay: this.failedReplay.bind(this),
                switchOnReplayStatus: this.switchOnReplayStatus.bind(this),
            },
        );

        chrome.runtime.onMessage.addListener(this.messageListener);
    }

    public handlePortDisconnection = () => {
        console.info("Disconnected port ", this.port);
        chrome.runtime.onMessage.removeListener(this.messageListener)
    }

    private messageListener = (request: any) => {
        if (request.selectTarget) {
            this.objectPicked(request);
            return;
        }

        if (request.cancelSelectTarget) {
            // When received request to cancel object picking
            // - Send broadcast to all tabs
            // - Inform outer systems about the cancellation
            forAllTabs(tab => chrome.tabs.sendMessage(tab.id, { selectMode: true, selecting: false }).catch(() => {}));
            this.port.postMessage({
                type: 'event',
                event: 'pickerCancel',
            });
            return;
        }

        if (!request.command || !this.replayingWindow) {
            return;
        }

        switch (request.command) {
            case 'changeWindowSize':
                const [width, height] = request.value;
                this.resizeWindow(this.replayingWindow, width, height);
                break;
            case 'maximizeWindow':
                this.maximizeWindow(this.replayingWindow);
                break;
        }
    };

    public async startReplay() {
        backgroundRecorder.replayStatus = 'replaying';
        const replayWindowId = await this.initReplayWindow();
        chrome.tabs.onActivated.addListener(this.tabsOnActivatedHandler);
        await this.extCommand.init();
        await this.attachPrompt(replayWindowId);
        await this.switchToWindow(replayWindowId);
        this.replayingWindow = replayWindowId;
        await this.playback.playSuite(undefined, 0);
    }

    public stopReplay() {
        backgroundRecorder.replayStatus = 'stopped';
        this.playback.stop();
        // Remove pending status commands
        this.playback.replayStatus = 'stop';

        this.detachPromptAllTabs();
        chrome.tabs.onActivated.removeListener(this.tabsOnActivatedHandler);
        this.closeReplayWindow();
        this.switchOnReplayStatus('stopped');
    }


    private async attachPrompt(windowId: number) {
        const tabs = await chrome.tabs.query({ windowId, active: true });
        const firstTab = tabs[0];
        await chrome.tabs.sendMessage(firstTab.id, { command: 'attachPrompt' }).catch(() => {});
    }

    private detachPromptAllTabs() {
        chrome.tabs.query({}).then((tabs) => {
            for (const tab of tabs) {
                chrome.tabs.sendMessage(tab.id, { command: 'detachPrompt' }).catch(() => {});
            }
        });
    }

    private async switchToWindow(windowId: number) {
        await chrome.windows.update(windowId, { focused: true });
    }

    private resizeWindow(windowId: number, width: number, height: number) {
        const updatedOptions: UpdateInfo = {
            state: 'normal',
            left: 0,
            top: 0,
            width,
            height,
        };

        return chrome.windows.update(windowId, updatedOptions);
    }

    private maximizeWindow(windowId: number) {
        const options: UpdateInfo = { state: 'maximized' };
        return chrome.windows.update(windowId, options);
    }

    private async setPlatFormInfo() {
        return new Promise((resolve) => {
            chrome.runtime.getPlatformInfo((platformInfo)=>{
                this.platFormInfo = platformInfo;
                resolve(platformInfo);
            });
        });
    }

    private isMacOs() {
      return this.platFormInfo.os === 'mac';
    } 

    private async initReplayWindow() {
        const newWindowParams: CreateData = {
            top: 0,
            left: 0,
            state: 'normal',
        };

        await this.setPlatFormInfo();

        const window = await chrome.windows.create(newWindowParams);
        this.extCommand.setContentWindowId(window.id);
        chrome.windows.onRemoved.addListener(windowId => {
            if (windowId === window.id && this.playback.replayStatus !== 'stop') {
                this.stopReplay();
            }
        });
        return window.id;
    }

    private async closeReplayWindow() {
        if (this.replayingWindow) {
            await chrome.windows.remove(this.replayingWindow);
            this.replayingWindow = undefined;
        }
    }

    private listener(msg: DapRequest) {
        if (msg.type !== 'request') {
            return;
        }

        switch (msg.command) {
            case 'initialize':
                this.playback.setModel(msg.arguments.scenario);
                this.initialVariables = msg.arguments.variables;
                this.variables = msg.arguments.variables;
                this.structuredVariables = msg.arguments.structuredVariables;
                this.playback.breakPoints = [];
                this.playback.skippedSteps = [];
                break;
            case 'initializePublish':
                console.log(msg);
                this.publishUrl = msg.arguments.publishUrl;
                this.publishSessionId = msg.arguments.sessionId;
                break;
            case 'updateModel':
                this.playback.setModel(msg.arguments.scenario);
                break;
            case 'terminate':
                this.stopReplay();
                break;
            case 'pause':
                this.playback.pause();
                break;
            case 'resume':
                this.playback.resume();
                break;
            case 'stepIn':
                if (this.shouldInitTest()) {
                    this.initTest();
                    globalState.declaredVars = {
                        ...this.variables,
                        structuredVariables: this.structuredVariables,
                    };
                } else {
                    this.playback.stepIn();
                }
                break;
            case 'stepOut':
                if (this.shouldInitTest()) {
                    this.initTest();
                    globalState.declaredVars = {
                        ...this.variables,
                        'structuredVariables': this.structuredVariables,
                        '@@publish-url': this.publishUrl,
                        '@@publish-session-id': this.publishSessionId,
                    };
                } else {
                    this.playback.stepOut();
                }
                break;
            case 'launch':
                if (this.playback.replayStatus === 'pause' || this.playback.replayStatus === 'breakpoint') {
                    this.playback.resume();
                } else {
                    this.variables = {...this.initialVariables};
                    globalState.declaredVars = {
                        ...this.variables,
                        'structuredVariables': this.structuredVariables,
                        '@@publish-url': this.publishUrl,
                        '@@publish-session-id': this.publishSessionId,
                    };
                    this.startReplay();
                }
                break;
            case 'next':
                if (this.shouldInitTest()) {
                    this.initTest();
                    globalState.declaredVars = {
                        ...this.variables,
                        'structuredVariables': this.structuredVariables,
                        '@@publish-url': this.publishUrl,
                        '@@publish-session-id': this.publishSessionId,
                    };
                } else {
                    this.playback.next();
                }
                break;
            case 'continue':
                this.playback.resume();
                break;
            case 'setIsSkipped':
                if (!!msg.arguments.value) {
                    this.playback.skippedSteps.push(msg.arguments.compositeId);
                } else {
                    this.playback.skippedSteps = this.playback.skippedSteps.filter(x => JSON.stringify(x) !== JSON.stringify(msg.arguments.compositeId));
                }
                break;
            case 'setBreakpoint':
                if (!!msg.arguments.value) {
                    this.playback.breakPoints.push(msg.arguments.compositeId);
                } else {
                    this.playback.breakPoints = this.playback.breakPoints.filter(x => JSON.stringify(x) !== JSON.stringify(msg.arguments.compositeId));
                }
                break;
            case 'executeStep':
                this.playback.playSingleCommand(msg.arguments.compositeId);
                break;

            case 'pickObject':
                forAllTabs(tab => chrome.tabs.sendMessage(tab.id, { selectMode: true, selecting: true }).catch(() => {}));
                break;
            case 'cancelPickObject':
                forAllTabs(tab => chrome.tabs.sendMessage(tab.id, { selectMode: true, selecting: false }).catch(() => {}));
                break;
            case 'highlightObject':
                forAllTabs(tab => chrome.tabs.sendMessage(tab.id, msg).catch(() => {}));
                break;
            case 'readVariables':
                const result = [];
                for (const variable of msg.arguments.variables) {
                    const variableName = variable.substring(2, variable.length - 1);
                    if (variableName) {
                        result.push({ name: variableName, value: this.variables[variableName] });
                    }
                }
                this.variablesRead(result);
                break;
            case 'setVariable':
                this.variables[msg.arguments.variable.name] = msg.arguments.variable.value;
                break;
            default:
                console.log('Wat?', msg.command);
        }
    }

    private successFullReplay() {
        this.port.postMessage({
            type: 'event',
            event: 'exited',
            body: {
                exitCode: 0,
            },
        });
        this.playback.replayStatus = 'stop';
        this.closeReplayWindow();
    }

    private failedReplay(reason: any) {
        this.port.postMessage({
            type: 'event',
            event: 'exited',
            body: {
                exitCode: 1,
                reason,
            },
        });
        this.playback.replayStatus = 'stop';
        this.closeReplayWindow();
    }

    private updateCommandStatus(data: UpdateStatusData) {
        this.port.postMessage({
            type: 'event',
            event: 'status',
            body: {
                identifier: data.identifier,
                status: data.status,
                error: data.reason,
                nextStepId: data.nextStepId,
                successLocator: data.successLocator,
            },
        });
    }

    private updateStatus(status: string) {
        this.port.postMessage({
            event: 'updateStatus',
            status,
        });
    }

    private switchOnReplayStatus(status: string) {
        this.port.postMessage({
            type: 'event',
            event: 'playbackStatus',
            body: {
                status,
            },
        });
    }

    private objectPicked(request: object) {
        this.port.postMessage({
            type: 'event',
            event: 'objectPicked',
            body: request,
        });
        forAllTabs(tab => chrome.tabs.sendMessage(tab.id, { selectMode: true, selecting: false }).catch(() => {}));
    }

    private variablesRead(request: object) {
        this.port.postMessage({
            type: 'event',
            event: 'variablesRead',
            body: request,
        });
    }

    private tabsOnActivatedHandler(activeInfo: { tabId: number }) {
        chrome.tabs.sendMessage(activeInfo.tabId, {
            command: 'attachPrompt',
        }).catch(() => {});
    }

    private shouldInitTest() {
        return !this.playback.frames.length && this.playback.replayStatus === 'stop';
    }

    private initTest() {
        this.variables = {...this.initialVariables};
        chrome.tabs.onActivated.addListener(this.tabsOnActivatedHandler);

        this.initReplayWindow().then(windowId => {
            this.attachPrompt(windowId);
            this.switchToWindow(windowId);
            this.replayingWindow = windowId;
            this.playback.initSuite();
        });
    }
}
