import React, { CSSProperties, MouseEventHandler } from 'react';
import { Transition } from 'react-transition-group';
import { UserNotification } from './types';

const defaultStyle: CSSProperties = {
    transition: `margin-left 500ms ease-in-out`,
    marginLeft: 6000,
};

const transitionStyles: { [key: string]: CSSProperties } = {
    entering: { marginLeft: 6000 },
    entered: { marginLeft: 0 },
    exiting: { marginLeft: 6000 },
    exited: { marginLeft: 6000 },
};

interface IProps {
    onClick: MouseEventHandler;
    notification: UserNotification;
}

const Fade: React.FC<IProps> = ({ onClick, notification }) => {
    const makeStyle = (state: string) => ({
        ...defaultStyle,
        ...transitionStyles[state],
    });

    notification = notification || {
        message: '',
        type: 'success',
        visible: false,
    };

    const className = `msg ${notification.type}`;

    return (
        <Transition in={notification.visible} timeout={0}>
            {(state) => (
                <div className={className} style={makeStyle(state)}>
                    <span>{notification.message}</span>
                    <div className='close' onClick={onClick}>
                        x
                    </div>
                </div>
            )}
        </Transition>
    );
};

export default Fade;
