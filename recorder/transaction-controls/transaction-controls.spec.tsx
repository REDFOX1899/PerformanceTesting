import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { act } from 'react-dom/test-utils';
import TransactionControls from './transaction-controls';

const backgroundPageMock = {
    functionalIconBlinkMode: false,
};

jest.mock('../common/extension', () => ({
    getBackgroundPage: () => backgroundPageMock,
}));

declare var global: any;

global.chrome = {
    runtime: {
        sendMessage: jest.fn(),
        onMessage: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
    },
};

const mockCheckStatus = (response: object) => {
    global.chrome.runtime.sendMessage.mockImplementation((msg: any, callback: (args: object) => void) => {
        if (msg.command === 'check_status') {
            callback(response);
        }
    });
};

const queryAllButtons = (c: HTMLDivElement) => {
    return {
        stop: c.querySelector('.btn-stop'),
        pause: c.querySelector('.btn-pause'),
        resume: c.querySelector('.btn-resume'),
    };
};


let container: HTMLDivElement;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});

afterEach(() => {
    unmountComponentAtNode(container);
    container.remove();
    container = null;
});

test('Paused state', () => {
    mockCheckStatus({recording: 'pause'});

    act(() => {
        render(<TransactionControls />, container);
    });

    const {stop, pause, resume} = queryAllButtons(container);
    expect(stop).toBeDefined();
    expect(pause).toBeNull();
    expect(resume).toBeDefined();

    act(() => {
        resume.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({command: 'resume_recording'}, expect.any(Function));
    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({type: 'start_traffic'}, expect.any(Function));
});

test('Record state', () => {
    mockCheckStatus({recording: 'record'});
    act(() => {
        render(<TransactionControls />, container);
    });

    const {stop, pause, resume} = queryAllButtons(container);

    expect(stop).toBeDefined();
    expect(pause).toBeDefined();
    expect(resume).toBeNull();

    act(() => {
        pause.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({command: 'pause_recording'}, expect.any(Function));
    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({type: 'pause_traffic'}, expect.any(Function));

    act(() => {
        stop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({command: 'stop_recording'}, expect.any(Function));
    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({type: 'stop_traffic'}, expect.any(Function));
});

test('Stopped state', () => {
    mockCheckStatus({recording: 'stopped'});
    act(() => {
        render(<TransactionControls />, container);
    });

    const {stop, pause, resume} = queryAllButtons(container);

    expect(stop).toBeNull();
    expect(pause).toBeNull();
    expect(resume).toBeNull();
});

test('Listener', () => {
    mockCheckStatus({recording: 'pause'});

    let registeredListener: (message: any) => void;
    global.chrome.runtime.onMessage.addListener.mockImplementation((listener: (message: any) => void) => {
        registeredListener = listener;
    });

    act(() => {
        render(<TransactionControls />, container);
    });

    act(() => {
        registeredListener({command: 'recorderNotification', observable: {recording: 'stopped'}});
    });

    {
        const {stop, pause, resume} = queryAllButtons(container);

        expect(stop).toBeNull();
        expect(pause).toBeNull();
        expect(resume).toBeNull();
    }
});

