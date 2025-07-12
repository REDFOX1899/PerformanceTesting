import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import NewGroupCreator from './new-group-creator';

describe('New Group Creator', () => {
    it('should display proper placeholder', () => {
        const { getByRole } = render(<NewGroupCreator nextIndex={5} isEnabled={true} onCreate={() => {}} />);

        expect(getByRole('textbox')).toHaveAttribute('placeholder', '5 Test case / Label');
    });

    it('should disable', () => {
        const { getByRole } = render(<NewGroupCreator nextIndex={5} isEnabled={false} onCreate={() => {}} />);

        const input = getByRole('textbox');
        expect(input).toBeDisabled();

        const button = getByRole('button');
        expect(button).toBeDisabled();
        expect(button).toHaveClass('disabled');
    });

    it('should enable input', () => {
        const { getByRole } = render(<NewGroupCreator nextIndex={5} isEnabled={true} onCreate={() => {}} />);

        const input = getByRole('textbox');
        expect(input).toBeEnabled();

        const button = getByRole('button');
        expect(button).toBeDisabled();
        expect(button).toHaveClass('disabled');
    });

    it('should enable button when name is populated', () => {
        const { getByRole } = render(<NewGroupCreator nextIndex={5} isEnabled={true} onCreate={() => {}} />);

        const input = getByRole('textbox');
        fireEvent.change(input, { target: { value: 'New Transaction' } });

        const button = getByRole('button');
        expect(button).toBeEnabled();
        expect(button).not.toHaveClass('disabled');
    });

    it('should fire event and clear when button is clicked', () => {
        const onCreate = jest.fn();

        const { getByRole } = render(<NewGroupCreator nextIndex={5} isEnabled={true} onCreate={onCreate} />);

        const input = getByRole('textbox');
        fireEvent.change(input, { target: { value: 'New Transaction' } });

        const button = getByRole('button');
        fireEvent.click(button);

        expect(onCreate).toHaveBeenCalledWith('New Transaction');
        expect(input).toHaveValue('');
    });

    it('should fire event and clear when Enter pressed', () => {
        const onCreate = jest.fn();

        const { getByRole } = render(<NewGroupCreator nextIndex={5} isEnabled={true} onCreate={onCreate} />);

        const input = getByRole('textbox');
        fireEvent.change(input, { target: { value: 'New Transaction' } });
        fireEvent.keyUp(input, { key: 'Enter' });

        expect(onCreate).toHaveBeenCalledWith('New Transaction');
        expect(input).toHaveValue('');
    });

    it('should clear the field when Escape pressed', () => {
        const { getByRole } = render(<NewGroupCreator nextIndex={5} isEnabled={true} onCreate={() => {}} />);

        const input = getByRole('textbox');
        fireEvent.change(input, { target: { value: 'New Transaction' } });
        expect(input).toHaveValue('New Transaction');
        fireEvent.keyUp(input, { key: 'Escape' });
        expect(input).toHaveValue('');
    });
});
