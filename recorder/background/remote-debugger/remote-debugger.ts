import { RemoteDebuggerSession } from './remote-debugger-session';

const DEBUG_PORT_PREFIX = 'dbg-';

class RemoteDebugger {
    private sessions = new Map<string, RemoteDebuggerSession>();

    constructor(port: chrome.runtime.Port) {
        if (!port.name.startsWith(DEBUG_PORT_PREFIX)) {
            return;
        }

        if (this.sessions.has(port.name)) {
            console.warn('Session already exists', port);
            return;
        }

        console.info('Creating the session', port);
        this.sessions.set(port.name, new RemoteDebuggerSession(port));

        port.onDisconnect.addListener((x: chrome.runtime.Port) => {
            console.info('Deleting the session', x.name);
            this.sessions.delete(x.name);
        });
    }
}

// Every time when extension loads start new session
chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
    console.log("Connected debugger port...!")    
    new RemoteDebugger(port);
});

