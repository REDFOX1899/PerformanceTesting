import { generateUuid } from '../../common/uuid-utils';
import { BZM_DOMAIN_COM, BZM_DOMAIN_NET } from './constants';
import {
    CANCEL_PICK_OBJECT,
    CONTINUE,
    EXECUTE_STEP,
    HIGHLIGHT_OBJECT,
    INITIALIZE, INITIALIZE_PUBLISH,
    LAUNCH,
    NEXT,
    PAUSE,
    PICK_OBJECT,
    READ_VARIABLES,
    RESUME,
    SET_BREAKPOINT,
    SET_IS_SKIPPED,
    SET_VARIABLE,
    STEP_IN,
    STEP_OUT,
    TERMINATE,
    UPDATE_MODEL,
} from './dapCommands';
import { DebuggerControl } from './debugger-control';
import { pingv2Handler } from './handlers/pingv2';
import { DEBUGGER_PING_V2, REQUEST, SCRIPTLESS_START_RECORDING } from './messages';
import { DapRequest, HandlerFn } from './types';

export class Application {
    private uuid: string;
    private debugger: DebuggerControl;
    private isActive = false;

    private handleCommand = (e: DapRequest) => {
        const command: string = e.data.command;
        const commandHandlers: { [key: string]: () => void } = {
            [PAUSE]: () => this.debugger.pause(),
            [RESUME]: () => this.debugger.resume(),
            [STEP_IN]: () => this.debugger.stepIn(),
            [STEP_OUT]: () => this.debugger.stepOut(),
            [TERMINATE]: () => this.debugger.terminate(),
            [NEXT]: () => this.debugger.next(),
            [CONTINUE]: () => this.debugger.continue(),
            [LAUNCH]: () => this.debugger.launch(),
            [SET_BREAKPOINT]: () => this.debugger.setBreakpoint(e.data.arguments),
            [SET_IS_SKIPPED]: () => this.debugger.setIsSkipped(e.data.arguments),
            [INITIALIZE]: () => this.debugger.initialize(e.data.arguments),
            [UPDATE_MODEL]: () => this.debugger.updateModel(e.data.arguments),
            [EXECUTE_STEP]: () => this.debugger.executeStep(e.data.arguments),
            [PICK_OBJECT]: () => this.debugger.pickObject(),
            [CANCEL_PICK_OBJECT]: () => this.debugger.cancelPickObject(),
            [HIGHLIGHT_OBJECT]: () => this.debugger.highlightObject(e.data.arguments),
            [READ_VARIABLES]: () => this.debugger.readVariables(e.data.arguments),
            [SET_VARIABLE]: () => this.debugger.setVariable(e.data.arguments),
            [INITIALIZE_PUBLISH]: () => this.debugger.initializePublish(e.data.arguments),
        };
        const commandHandler = commandHandlers[command];
        if (commandHandler) {
            commandHandler();
        }
    };

    private messageHandlers: { [key: string]: HandlerFn } = {
        [DEBUGGER_PING_V2]: pingv2Handler,
        [REQUEST]: this.handleCommand,
        [SCRIPTLESS_START_RECORDING]: (e) => {
            chrome.runtime.sendMessage({ ...e.data }).catch(() => {});
        },
    };

    private handleDisconnect(port: chrome.runtime.Port){
        console.info("Disconnected from port...!", port.name);
        this.isActive = false;
    }

    public initialiseDebugger(state: string) {
        console.info("Debugger Initialized...", state)
        this.uuid = generateUuid();
        this.isActive = true;
        this.debugger = new DebuggerControl(this.uuid).onDisconnect(this.handleDisconnect.bind(this));
    }


    public run() {
       
       console.info("Running Debug Protocol...")
        
       this.initialiseDebugger('on-start');

        chrome.runtime.onMessage.addListener((message, sender) => {
            if (message.type === 'refresh') {
                window.postMessage({ ...message }, document.location.origin);
            } else if (message.type === 'stopped_recording') {
                window.postMessage({ ...message }, document.location.origin);
            } else if (message.type === 'scriptless/start-recording-failed') {
                window.postMessage({ ...message }, document.location.origin);
            }
        });

        window.addEventListener('message', (e) => {
           
            if (!(e.origin.endsWith(BZM_DOMAIN_COM) || e.origin.endsWith(BZM_DOMAIN_NET))) {
                return;
            } else if (e.data && e.data.type) {
                console.info("Message received ", e);
                const handler = this.messageHandlers[e.data.type];
                try {
                    if (handler) {
                        if (!this.isActive) {
                            console.info("Found inactive debugger!! initializing again");
                            this.initialiseDebugger('on-message');
                        }
                        handler(e);
                    }
                } catch (ex) {
                    console.error(ex);
                }
            }
        });
    }
}
