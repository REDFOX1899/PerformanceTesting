import React, { useState } from 'react';
import { Key } from './constants';
import { Group } from './types';

interface Props {
    group: Group;
    onRename?: (name: string) => void;
}

const RecorderGroup: React.FC<Props> = ({ group, onRename }) => {
    const [name, setName] = useState(group.name);
    const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === Key.Escape) {
            setName(group.name);
            e.currentTarget.blur();
        } else if (e.key === Key.Enter) {
            if (!name || name.trim().length === 0) {
                setName(group.name);
                e.currentTarget.blur();
                return;
            }

            if (onRename) {
                onRename(name);
            }
            e.currentTarget.blur();
        }
    };

    return (
        <div className='recorder-group'>
            <input
                type='text'
                className='recorder-group__name'
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={(e) => setName(group.name)}
                onKeyUp={handleKeyUp}
            />
            <span className='recorder-group__counters'>
                <span className='recorder-group__ui'>{group.uiCounter}</span>
                <span className='recorder-group__http'>{group.httpCounter}</span>
            </span>
        </div>
    );
};

export default RecorderGroup;
