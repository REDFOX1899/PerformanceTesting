import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import RecorderGroup from './recorder-group';
import { Group } from './types';

describe('Recorder Group', () => {
    const data: Group = {
        name: 'Test',
        uiCounter: 10,
        httpCounter: 20,
    };

    it('should display the data', () => {
        const { getByText, getByDisplayValue } = render(<RecorderGroup group={data} />);
        expect(getByDisplayValue('Test')).toBeInTheDocument();
        expect(getByText('10')).toBeInTheDocument();
        expect(getByText('20')).toBeInTheDocument();
    });

    it('should allow changing the name', () => {
        const { getByRole } = render(<RecorderGroup group={data} />);
        const input = getByRole('textbox');
        fireEvent.change(input, { target: { value: 'New Name' } });
        expect(input).toHaveValue('New Name');
    });

    it('should reset name on Escape', () => {
        const { getByRole } = render(<RecorderGroup group={data} />);
        const input = getByRole('textbox');
        fireEvent.change(input, { target: { value: 'New Name' } });
        fireEvent.keyUp(input, { key: 'Escape' });
        expect(input).toHaveValue('Test');
        expect(input).not.toHaveFocus();
    });

    it('should trigger onRename on Enter key press', () => {
        const rename = jest.fn();

        const { getByRole } = render(<RecorderGroup group={data} onRename={rename} />);

        const input = getByRole('textbox');
        fireEvent.change(input, { target: { value: 'New Name' } });
        fireEvent.keyUp(input, { key: 'Enter' });

        expect(rename).toHaveBeenCalledWith('New Name');
        expect(input).not.toHaveFocus();
    });

    it('should revert the changes on Enter when new name is empty', () => {
        const { getByRole } = render(<RecorderGroup group={data} />);

        const input = getByRole('textbox');
        fireEvent.change(input, { target: { value: '' } });
        fireEvent.keyUp(input, { key: 'Enter' });

        expect(input).toHaveValue('Test');
        expect(input).not.toHaveFocus();
    });

    it('should not fail when onRename callback is not assigned', () => {
        const { getByRole } = render(<RecorderGroup group={data} />);

        const input = getByRole('textbox');
        fireEvent.change(input, { target: { value: 'New Name' } });
        fireEvent.keyUp(input, { key: 'Enter' });

        expect(input).not.toHaveFocus();
    });
});
