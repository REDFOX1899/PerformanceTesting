import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React from 'react';
import RecorderGroupsHeader from './recorder-groups-header';

describe('Recorder Groups Header', () => {
    it('should display the amount', () => {
        const { getByText } = render(<RecorderGroupsHeader count={5} />);
        expect(getByText('5 Test case(s) / Label(s)')).toBeInTheDocument();
    });
});
