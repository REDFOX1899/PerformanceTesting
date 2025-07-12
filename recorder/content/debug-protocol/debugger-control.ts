import {DebuggerPort} from './debugger-port';
import {DapEvent} from './types';

export class DebuggerControl {
    private port: DebuggerPort;
    constructor(id: string) {
        this.port = new DebuggerPort(`dbg-${id}`);
        // Passthrough events to the application
        this.port.listen<DapEvent>(x => window.postMessage(x, location.origin));
    }  

    public onDisconnect(fn: (port: chrome.runtime.Port) => void){
        this.port.handleDisconnect(fn);
        return this;
    }

    public initialize(args: any) {
        const scenario = args.scenario;
        scenario.steps = scenario.scenarioSteps;
        delete scenario.scenarioSteps;
        this.port.send({type: 'request', command: 'initialize', arguments: {...args, scenario}});
    }

    public updateModel(args: any) {
        const scenario = args.scenario;
        scenario.steps = scenario.scenarioSteps;
        delete scenario.scenarioSteps;
        this.port.send({type: 'request', command: 'updateModel', arguments: {...args, scenario}});
    }

    public pause() {
        this.port.send({type: 'request', command: 'pause'});
    }

    public resume() {
        this.port.send({type: 'request', command: 'resume'});
    }

    public terminate() {
        this.port.send({type: 'request', command: 'terminate'});
    }

    public stepIn() {
        this.port.send({type: 'request', command: 'stepIn'});
    }

    public stepOut() {
        this.port.send({type: 'request', command: 'stepOut'});
    }

    public launch() {
        this.port.send({type: 'request', command: 'launch'});
    }

    public next() {
        this.port.send({type: 'request', command: 'next'});
    }

    public continue() {
        this.port.send({type: 'request', command: 'continue'});
    }

    public setBreakpoint(args: any) {
        this.port.send({type: 'request', command: 'setBreakpoint', arguments: {...args}});
    }

    public setIsSkipped(args: any) {
        this.port.send({type: 'request', command: 'setIsSkipped', arguments: {...args}});
    }

    public executeStep(args: any) {
        this.port.send({type: 'request', command: 'executeStep', arguments: {...args}});
    }

    public pickObject() {
        this.port.send({type: 'request', command: 'pickObject'});
    }

    public cancelPickObject() {
        this.port.send({type: 'request', command: 'cancelPickObject'});
    }

    public highlightObject(args: any) {
        this.port.send({type: 'request', command: 'highlightObject', arguments: {...args}});
    }

    public readVariables(args: any) {
        this.port.send({type: 'request', command: 'readVariables', arguments: {...args}});
    }

    public setVariable(args: any) {
        this.port.send({type: 'request', command: 'setVariable', arguments: {...args}});
    }

    public initializePublish(args: any) {
        this.port.send({type: 'request', command: 'initializePublish', arguments: {...args}});
    }
}
