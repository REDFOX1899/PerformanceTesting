/**
 * Generic message handler signature
 */
export type HandlerFn = <T extends MessageEvent>(e: T) => void;

/* DAP (Debug adapter protocol) section. For specification
please see: https://microsoft.github.io/debug-adapter-protocol/specification */
export interface DapMessage {
    type: string;
}

export interface DapEvent extends DapMessage {
    type: 'event';
    event: string;
    body?: any;
}

export interface DapRequest extends DapMessage {
    data: {
        type: 'request'
        /**
         * The command to execute.
         */
        command: string;
        /**
         * Object containing arguments for the command.
         */
        arguments?: any;
    };
}
