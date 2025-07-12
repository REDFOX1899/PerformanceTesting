import classNames from 'classnames';
import React, { useState } from 'react';
import { Key } from './constants';

interface Props {
    nextIndex: number;
    isEnabled: boolean;
    onCreate: (name: string) => void;
}

const NewGroupCreator: React.FC<Props> = ({ nextIndex, onCreate, isEnabled }) => {
    const placeholder = `${nextIndex} Test case / Label`;

    const [name, setName] = useState('');
    const clearName = () => setName('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value);

    const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === Key.Escape) {
            clearName();
        } else if (e.key === Key.Enter) {
            add();
        }
    };

    const isValidName = name.length > 0;

    const add = () => {
        onCreate(name);
        clearName();
    };

    const btnClassName = classNames('new-group__save', {
        disabled: !isValidName,
    });

    return (
        <div className='new-group'>
            <input
                type='text'
                className='new-group__name'
                placeholder={placeholder}
                value={name}
                onChange={handleChange}
                onKeyUp={handleKeyUp}
                disabled={!isEnabled}
            />
            <button className={btnClassName} disabled={!isValidName} onClick={add}>
                Add Step
            </button>
        </div>
    );
};

export default NewGroupCreator;
