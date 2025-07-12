import React from 'react';
import { helpText } from './constants';

interface Props {
    count: number;
}

const RecorderGroupsHeader: React.FC<Props> = ({ count }) => {
    return (
        <div className='recorder-groups-header'>
            <span className='recorder-groups-header__title'>
                <label className='recorder-groups-header__label'>{count} Test case(s) / Label(s)</label>
                <i className='hint fa fa-info-circle' title={helpText} />
            </span>
            <span className='recorder-groups-header__counters'>UI | JMX</span>
        </div>
    );
};

export default RecorderGroupsHeader;
