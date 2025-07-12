import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { act } from 'react-dom/test-utils';
import Header from './header';

let container: HTMLDivElement;

beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
});

afterEach(() => {
    unmountComponentAtNode(container);
    container.remove();
    container = null;
});

test('Close button should close the page', () => {
    const spy = jest.spyOn(window, 'close').mockImplementation(() => undefined);

    act(() => {
        render(<Header />, container);
    });

    const closeBtn = container.querySelector('.close-page');
    expect(closeBtn).toBeDefined();

    act(() => {
        closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(spy).toHaveBeenCalled();
});
