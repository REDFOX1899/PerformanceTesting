import {DEBUGGER_PONG_V2} from '../messages';
import { pingv2Handler } from './pingv2';

window.postMessage = jest.fn();

test('Ping.v2 message handler', () => {
    pingv2Handler();

    expect(window.postMessage).toBeCalledWith({
        type: DEBUGGER_PONG_V2,
    }, window.location.origin);
});

