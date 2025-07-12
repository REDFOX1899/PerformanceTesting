import React, { useEffect, useState } from 'react';
import Fade from './fade';
import { UserNotification, UserNotificationType } from './types';

export const useNotifications = () => {
    const [notification, setNotification] = useState<UserNotification>(null);

    const showNotification = (message: string, type: UserNotificationType) => {
        setNotification({ message, type, visible: true});
    };

    const hideNotification = () => setNotification(x => ({...x, visible: false}));

    const component = <Fade onClick={hideNotification} notification={notification} />;

    useEffect(() => {
        const timer = setTimeout(() => hideNotification(), 3000);
        return () => clearTimeout(timer);
    }, [notification]);

    return {
        showNotification,
        component,
    };
};
