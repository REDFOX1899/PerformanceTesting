/**
 * Simple wrapper for opening and working with long-lived connections in the browser
 */
export class DebuggerPort {
    private port: chrome.runtime.Port;

    /**
     * Create the port with the specified name
     * @param name Name of the port
     */
    constructor(name: string) {
        this.port = chrome.runtime.connect({name});
    }

    public getName(){
      return this.port.name;
    } 

    /**
     * Listen for the messages from the port
     * @param fn Listener function
     */
    public listen<T>(fn: (msg: T) => void) {
        this.port.onMessage.addListener(fn);
    }

    /**
     * Send message to the port
     * @param data Data to be sent over the port
     */
    public send<T extends object>(data: T) {
        this.port.postMessage(data);
    }

    /**
     * Close the port
     */
    public close() {
        this.port.disconnect();
    }

    public handleDisconnect(fn: (port: chrome.runtime.Port) => void) {
        this.port.onDisconnect.addListener(fn);
    }   
}
